/**
 * The place field on the collection and stay forms takes either a Google Maps
 * link or a plain address, and this works out which one it got.
 *
 * The two resolve differently. A link usually carries its own coordinates and
 * only needs parsing (see `parseGoogleMapsUrl`); an address never does, so it
 * has to be geocoded, which is a network round trip and a guess. Telling them
 * apart up front is what lets the form say which of those is happening.
 *
 * Whatever is typed, what gets saved is always a URL — `google_maps_url` is
 * rendered as an `href` on the map pins and in the stays list — so an address
 * is stored as a Google Maps search link for it.
 */

export type PlaceInputKind = 'empty' | 'url' | 'address'

/** Only http(s) counts as a link. A `javascript:` string must never become an href. */
const HTTP_SCHEME = /^https?:\/\//i

/**
 * Maps links people paste with the scheme left off. Nothing else schemeless is
 * treated as a link: "St. Louis" is a place, not a hostname, and guessing at
 * bare domains is exactly how you get that wrong.
 */
const BARE_MAPS_HOST =
  /^(?:www\.)?(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z][a-z.]*|google\.[a-z][a-z.]*\/maps)(?:[/?]|$)/i

export function classifyPlaceInput(value: string): PlaceInputKind {
  const trimmed = value.trim()
  if (!trimmed) return 'empty'
  if (HTTP_SCHEME.test(trimmed) || BARE_MAPS_HOST.test(trimmed)) return 'url'
  return 'address'
}

/** A pasted link with the scheme people leave off put back on. */
export function normalizePlaceUrl(value: string): string {
  const trimmed = value.trim()
  return HTTP_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
}

const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query='

/** A Google Maps search link for an address, so what we save is a real link. */
export function mapsSearchUrl(address: string): string {
  return MAPS_SEARCH_BASE + encodeURIComponent(address.trim())
}

const BARE_COORDS = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/

/**
 * Coordinates typed straight into the field — "42.3601, -71.0589". Worth
 * spotting, because they are already the answer and asking a geocoder about
 * them only risks a worse one.
 */
export function parseCoordinatePair(
  value: string
): { latitude: number; longitude: number } | null {
  const match = value.match(BARE_COORDS)
  if (!match) return null
  const latitude = parseFloat(match[1])
  const longitude = parseFloat(match[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  // Outside the globe means it was never a location.
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

/**
 * What to show in the field for a place that is already saved.
 *
 * An address we turned into a search link reads back as the address, so
 * re-opening an edit form shows what was typed rather than the URL it became.
 * Only an exact `?api=1&query=<text>` link round-trips this way — anything
 * carrying more (a `query_place_id`, a viewport) is left as it is, since
 * decoding it would throw that away.
 */
export function placeFieldValue(savedUrl: string | null | undefined): string {
  const url = savedUrl?.trim() || ''
  if (!url.startsWith(MAPS_SEARCH_BASE)) return url
  const query = url.slice(MAPS_SEARCH_BASE.length)
  if (!query || query.includes('&') || query.includes('#')) return url
  let decoded: string
  try {
    decoded = decodeURIComponent(query)
  } catch {
    return url
  }
  // A coordinate pair is a location, not something anyone typed as an address.
  if (!decoded.trim() || parseCoordinatePair(decoded)) return url
  return decoded
}
