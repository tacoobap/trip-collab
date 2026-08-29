import type { Handler } from '@netlify/functions'
import { getAuthUidFromEvent, requireAuthResponse } from './lib/verifyAuth'
import { parseGoogleMapsUrl } from '../../src/lib/parseGoogleMapsUrl'

/**
 * Work out where a saved place actually is, for links that don't say.
 *
 * Two routes, tried in order:
 *
 *  1. A shortened link (maps.app.goo.gl/…) is only an id. Asked with a browser
 *     User-Agent, Google answers with a JavaScript interstitial; asked with a
 *     plain one, it answers with an ordinary 30x to the full URL — which does
 *     carry coordinates. So we deliberately don't pretend to be a browser.
 *
 *  2. Links like `?cid=…` or `/maps/place/Name` never carried a position, and
 *     fetching them server-side doesn't help: Google returns a JavaScript shell
 *     whose only coordinates are a default viewport. The place is resolved in
 *     the browser. So instead we look the name up in Nominatim, OpenStreetMap's
 *     geocoder. That is a search, not a fact about the link, and the response
 *     says so via `source` — the caller is expected to tell the user.
 */

// Only Google's shorteners. Without this the function is an open proxy that
// will fetch any URL a caller names.
const SHORTENER_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl'])

const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 8000
const CONTACT = 'trup-trip-planner/1.0 (+https://lets-plan-a-trip.netlify.app)'

export interface ResolvedPlace {
  latitude: number
  longitude: number
  placeName: string | null
  /** The expanded link, when a short link was followed. */
  url?: string
  /** 'link' — read off the link itself. 'search' — a name lookup, so it may be wrong. */
  source: 'link' | 'search'
}

export function isShortenerUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    if (!SHORTENER_HOSTS.has(url.hostname)) return false
    // goo.gl shortens more than maps; only take its maps path.
    if (url.hostname === 'goo.gl' && !url.pathname.startsWith('/maps/')) return false
    return true
  } catch {
    return false
  }
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Follow Location headers until we land somewhere that isn't a redirect. */
export async function expandShortLink(start: string): Promise<string | null> {
  let current = start
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    let res: Response
    try {
      res = await timedFetch(current, {
        redirect: 'manual',
        headers: { 'User-Agent': CONTACT, Accept: 'text/html,application/xhtml+xml' },
      })
    } catch {
      return null
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return null
      current = new URL(location, current).toString()
      continue
    }
    if (res.status >= 400) return null
    return current
  }
  return null
}

/** Best-effort name lookup against OpenStreetMap's geocoder. */
export async function geocode(query: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', query)
  try {
    const res = await timedFetch(url.toString(), {
      // Nominatim's policy requires an identifying User-Agent.
      headers: { 'User-Agent': CONTACT, Accept: 'application/json' },
    })
    if (!res.ok) return null
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[]
    const hit = rows?.[0]
    if (!hit) return null
    const lat = parseFloat(hit.lat)
    const lon = parseFloat(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return { lat, lon, name: hit.display_name }
  } catch {
    return null
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const uid = await getAuthUidFromEvent(event)
  const authError = requireAuthResponse(uid)
  if (authError) {
    return {
      statusCode: authError.statusCode,
      body: authError.body,
      headers: { 'Content-Type': 'application/json' },
    }
  }

  const json = (statusCode: number, body: unknown) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

  const link = event.queryStringParameters?.url?.trim() || ''
  const query = event.queryStringParameters?.q?.trim() || ''
  if (!link && !query) return json(400, { error: 'Give a url or a q to look up' })

  // 1. A short link can be expanded into one that carries coordinates.
  if (link && isShortenerUrl(link)) {
    const expanded = await expandShortLink(link)
    if (expanded) {
      const parsed = parseGoogleMapsUrl(expanded)
      if (parsed) {
        return json(200, {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          placeName: parsed.placeName,
          url: expanded,
          source: 'link',
        } satisfies ResolvedPlace)
      }
    }
  }

  // 2. Otherwise the position was never in the link — look the name up.
  if (query) {
    const hit = await geocode(query)
    if (hit) {
      return json(200, {
        latitude: hit.lat,
        longitude: hit.lon,
        placeName: hit.name,
        source: 'search',
      } satisfies ResolvedPlace)
    }
  }

  return json(404, { error: 'Could not work out where that is' })
}
