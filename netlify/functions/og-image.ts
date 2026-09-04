import type { Handler } from '@netlify/functions'
import { initCardRenderer, renderCard, type CardFonts } from './lib/ogCard'
import { cardMeta, originFrom, parseKind } from './lib/tripPreview'
import { lookupTrip } from './lib/tripLookup'

/**
 * The 1200x630 image behind a shared Trip link, drawn from the trip's own
 * cover photo.
 *
 * Called by link-preview crawlers, never by the app. The URL carries a version
 * hash of everything drawn on the card, so it can be cached hard and still
 * change the moment someone swaps the cover photo.
 */

const CARD_W = 1200
const CARD_H = 630
/** A cover photo is stored at up to 3840px wide; refuse to decode a huge one. */
const MAX_HERO_BYTES = 8 * 1024 * 1024

let assets: Promise<{ fonts: CardFonts }> | null = null

/**
 * Fonts and resvg's wasm ship as static assets and are pulled from the same
 * CDN the site is served from, once per container. Bundling them instead would
 * mean `included_files` paths that differ between local dev and Lambda.
 */
function loadAssets(origin: string): Promise<{ fonts: CardFonts }> {
  if (!assets) {
    assets = (async () => {
      const get = async (file: string): Promise<ArrayBuffer> => {
        const res = await fetch(`${origin}/og/${file}`)
        if (!res.ok) throw new Error(`Could not load /og/${file} (${res.status})`)
        return res.arrayBuffer()
      }
      const [playfair400, playfair600, dmSans400, wasm] = await Promise.all([
        get('playfair-400.ttf'),
        get('playfair-600.ttf'),
        get('dmsans-400.ttf'),
        get('resvg.wasm'),
      ])
      await initCardRenderer(new Uint8Array(wasm))
      return { fonts: { playfair400, playfair600, dmSans400 } }
    })().catch((err) => {
      // Don't cache a failed load — the next invocation should try again
      assets = null
      throw err
    })
  }
  return assets
}

/**
 * Fetch the cover photo already cropped to the card, via Netlify's image CDN.
 * Falls back to the original file, which resvg will scale itself.
 */
async function heroDataUri(origin: string, heroUrl: string): Promise<string | null> {
  const resized =
    `${origin}/.netlify/images?url=${encodeURIComponent(heroUrl)}` +
    `&w=${CARD_W}&h=${CARD_H}&fit=cover&position=center&fm=jpg&q=72`

  for (const url of [resized, heroUrl]) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length || buf.length > MAX_HERO_BYTES) continue
      const type = res.headers.get('content-type') || ''
      const mime = type.startsWith('image/') ? type.split(';')[0] : 'image/jpeg'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      // try the next source
    }
  }
  return null
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const origin = originFrom(event)
  const kind = parseKind(event.queryStringParameters?.kind)
  const id = event.queryStringParameters?.id?.trim() ?? ''

  // Anything we can't draw falls back to the static card rather than to no
  // image at all, which would leave the link with a blank preview.
  const fallback = {
    statusCode: 302,
    headers: { Location: `${origin}/og-image.png`, 'Cache-Control': 'public, max-age=300' },
    body: '',
  }

  if (!kind || !id) return fallback

  try {
    const trip = await lookupTrip(kind, id)
    if (!trip) return fallback

    const { fonts } = await loadAssets(origin)
    const hero = trip.imageUrl ? await heroDataUri(origin, trip.imageUrl) : null
    const jpeg = await renderCard({ hero, name: trip.name, meta: cardMeta(trip) }, fonts)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        // The `v` param changes whenever the card would, so this can sit in a
        // crawler's cache for a long time.
        'Cache-Control': 'public, max-age=86400',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=604800',
      },
      body: jpeg.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (err) {
    console.error('og-image failed', err)
    return fallback
  }
}
