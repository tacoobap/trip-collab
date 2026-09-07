import type { Handler, HandlerEvent } from '@netlify/functions'
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

/**
 * How long a fetched shell may be reused. This is the whole reason the cache is
 * time-bounded rather than permanent: `index.html` names the build's hashed
 * asset URLs, and a container that cached one deploy's copy went on serving
 * those URLs after the next deploy had deleted them. The browser then asked for
 * an asset that no longer existed, fell through the `/*` catch-all to
 * `index.html`, and refused the HTML it got back where it expected a module —
 * so every direct load of `/trip/:slug` and `/i/:token` rendered a blank page
 * until that container happened to be recycled.
 */
const SHELL_TTL_MS = 60_000

let shell: { html: Promise<string>; fetchedAt: number } | null = null

/** The built `index.html`, with its hashed asset URLs. Re-read once a minute. */
function loadShell(origin: string): Promise<string> {
  if (shell && Date.now() - shell.fetchedAt < SHELL_TTL_MS) return shell.html

  // `no-cache` so the re-read can't itself be answered with the previous
  // build's copy from the edge, which would just re-pin the same stale hashes.
  const entry: { html: Promise<string>; fetchedAt: number } = {
    fetchedAt: Date.now(),
    html: fetch(`${origin}/index.html`, { headers: { 'Cache-Control': 'no-cache' } })
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the app shell (${res.status})`)
        return res.text()
      })
      .catch((err) => {
        // Don't let a failed read serve as the cached answer for a minute.
        if (shell === entry) shell = null
        throw err
      }),
  }
  shell = entry
  return entry.html
}

const pathOf = (url: string | undefined): string | null => {
  try {
    return url ? new URL(url).pathname : null
  } catch {
    return null
  }
}

/** A slug rides in the path, so it arrives percent-encoded; a bad escape is not a trip. */
const decodeId = (value: string): string => {
  try {
    return decodeURIComponent(value).trim()
  } catch {
    return ''
  }
}

/**
 * Which trip this request is asking about.
 *
 * The **path is authoritative**, not the query string. `netlify.toml` rewrites
 * both links here with `kind` and `id` written into the target, but a rewrite
 * doesn't carry them — which is why every link pasted into a chat got the
 * generic card while calling this function directly worked perfectly, and why
 * the two look identical from the outside. Reading the address the request
 * actually arrived on doesn't depend on that behaviour either way.
 *
 * The query string is still honoured when the path holds no link, so addressing
 * the function directly — how `curl` reaches it when verifying — keeps working.
 * It is the fallback rather than the first choice because a rewrite that passed
 * the placeholder through un-substituted would look like a perfectly good `id`.
 */
function target(event: HandlerEvent): { kind: PreviewKind; id: string } | null {
  for (const path of [event.path, pathOf(event.rawUrl)]) {
    const match = /^\/(trip|i)\/([^/?#]+)/.exec(path ?? '')
    if (match) {
      const id = decodeId(match[2])
      if (id) return { kind: match[1] === 'trip' ? 'trip' : 'share', id }
    }
  }

  const kind = parseKind(event.queryStringParameters?.kind)
  const id = event.queryStringParameters?.id?.trim()
  return kind && id ? { kind, id } : null
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
  const link = target(event)

  // A browser never needs the trip data — the app fetches it itself — so skip
  // straight past Firestore, and past importing the Admin SDK at all.
  if (!link || !isCrawler(ua)) {
    return html(shellHtml, 'public, max-age=0, must-revalidate')
  }
  const { kind, id } = link

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
