import type { Handler } from '@netlify/functions'
import {
  canonicalUrl,
  cardUrl,
  description,
  originFrom,
  parseKind,
  version,
  type PreviewKind,
} from './lib/tripPreview'

/**
 * Serves `/trip/:slug` and `/i/:token` with meta tags describing that trip.
 *
 * The app is a single static `index.html` behind a catch-all redirect, so every
 * URL used to hand crawlers the same generic card. This sits in front of the two
 * addresses people actually paste into a chat and rewrites the tags for them.
 *
 * Only crawlers pay for that. A real browser gets the untouched shell straight
 * back, and the Firebase Admin SDK — the slow part of a cold start — is imported
 * lazily so it never loads on that path.
 */

/**
 * iMessage identifies itself as `facebookexternalhit/1.1 Facebot Twitterbot/1.0`,
 * so the Facebook and Twitter entries cover Apple's fetcher too.
 */
const CRAWLERS = [
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'slackbot',
  'slack-imgproxy',
  'linkedinbot',
  'whatsapp',
  'discordbot',
  'telegrambot',
  'applebot',
  'googlebot',
  'google-inspectiontool',
  'bingbot',
  'duckduckbot',
  'yandexbot',
  'baiduspider',
  'redditbot',
  'pinterest',
  'skypeuripreview',
  'vkshare',
  'embedly',
  'iframely',
  'quora link preview',
  'nuzzel',
  'bitlybot',
  'mastodon',
  'bluesky',
  'signal',
  'snapchat',
  'viber',
  'line-podcast',
  'w3c_validator',
]

const isCrawler = (ua: string): boolean => {
  const lower = ua.toLowerCase()
  return CRAWLERS.some((bot) => lower.includes(bot))
}

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

let shell: Promise<string> | null = null

/** The built `index.html`, with its hashed asset URLs, fetched once per container. */
function loadShell(origin: string): Promise<string> {
  if (!shell) {
    shell = fetch(`${origin}/index.html`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the app shell (${res.status})`)
        return res.text()
      })
      .catch((err) => {
        shell = null
        throw err
      })
  }
  return shell
}

const html = (body: string, cache: string) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache },
  body,
})

/**
 * Swap the tags `index.html` ships with for this trip's. The title stays the
 * wordmark on every link by design, so the trip's own name rides in the
 * description and on the card itself.
 */
function withTags(
  shellHtml: string,
  fields: { image: string; url: string; description: string }
): string {
  const stripped = shellHtml
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '')

  const desc = escapeAttr(fields.description)
  const tags = `
    <title>Trup</title>
    <meta name="description" content="${desc}" />
    <meta name="robots" content="noindex" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Trup" />
    <meta property="og:title" content="Trup" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${escapeAttr(fields.url)}" />
    <meta property="og:image" content="${escapeAttr(fields.image)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${desc}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Trup" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${escapeAttr(fields.image)}" />
  `

  return stripped.replace(/<\/head>/i, `${tags}</head>`)
}

export const handler: Handler = async (event) => {
  const origin = originFrom(event)

  let shellHtml: string
  try {
    shellHtml = await loadShell(origin)
  } catch (err) {
    // Without the shell there is no page to serve; let the CDN retry shortly
    console.error('link-preview could not load the app shell', err)
    return { statusCode: 502, body: 'Bad Gateway' }
  }

  const ua = event.headers?.['user-agent'] ?? ''
  const kind = parseKind(event.queryStringParameters?.kind) as PreviewKind | null
  const id = event.queryStringParameters?.id?.trim() ?? ''

  // A browser never needs the trip data — the app fetches it itself — so skip
  // straight past Firestore, and past importing the Admin SDK at all.
  if (!kind || !id || !isCrawler(ua)) {
    return html(shellHtml, 'public, max-age=0, must-revalidate')
  }

  try {
    const { lookupTrip } = await import('./lib/tripLookup')
    const trip = await lookupTrip(kind, id)
    if (!trip) return html(shellHtml, 'public, max-age=0, must-revalidate')

    return html(
      withTags(shellHtml, {
        image: cardUrl(origin, kind, id, version(trip)),
        url: canonicalUrl(origin, kind, id),
        description: description(trip),
      }),
      'public, max-age=300'
    )
  } catch (err) {
    // A preview is not worth failing the page over
    console.error('link-preview could not describe the trip', err)
    return html(shellHtml, 'public, max-age=0, must-revalidate')
  }
}
