/**
 * Pull latitude, longitude and a place name out of a Google Maps URL.
 *
 * Google hands out several shapes depending on where you copied from, and they
 * carry coordinates in different places:
 *   /place/Name/@lat,lng,17z            desktop address bar
 *   /place/Name/data=…!3d<lat>!4d<lng>  share link — the place's own position
 *   ?ll=lat,lng                         legacy maps.google.com
 *   ?q=lat,lng  /  ?api=1&query=lat,lng explicit coordinate links
 *
 * Shortened links (maps.app.goo.gl/…, goo.gl/maps/…) carry no coordinates at
 * all — they have to be followed first. See `isShortMapsUrl`.
 */
export interface ParsedMapsResult {
  latitude: number
  longitude: number
  placeName: string | null
}

function decodePlaceSegment(seg: string): string {
  return decodeURIComponent(seg.replace(/\+/g, ' ')).trim() || ''
}

function toCoords(latStr: string, lngStr: string): { lat: number; lng: number } | null {
  const lat = parseFloat(latStr)
  const lng = parseFloat(lngStr)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  // Reject anything outside the globe — a stray number match, not a location.
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

/** A shortened link, which has to be followed before it means anything. */
export function isShortMapsUrl(url: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url.trim())
}

function extractCoords(url: string): { lat: number; lng: number } | null {
  // /@lat,lng — the map viewport, present on any link copied from the address bar.
  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (at) {
    const coords = toCoords(at[1], at[2])
    if (coords) return coords
  }

  // !3d<lat>!4d<lng> — the place's own position, on share links with no /@.
  const data = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/)
  if (data) {
    const coords = toCoords(data[1], data[2])
    if (coords) return coords
  }

  // ll= / sll= on legacy maps.google.com links.
  const ll = url.match(/[?&]s?ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (ll) {
    const coords = toCoords(ll[1], ll[2])
    if (coords) return coords
  }

  // ?q= or ?query= holding coordinates, optionally after a place name.
  const q = url.match(/[?&](?:q|query)=([^&]+)/)
  if (q) {
    const value = decodeURIComponent(q[1].replace(/\+/g, ' '))
    const afterAt = value.indexOf('@')
    const coordsPart = afterAt >= 0 ? value.slice(afterAt + 1) : value
    const [latStr, lngStr] = coordsPart.split(',')
    if (latStr && lngStr) {
      const coords = toCoords(latStr, lngStr)
      if (coords) return coords
    }
  }

  return null
}

function extractPlaceName(url: string): string | null {
  // /place/Place+Name/ or /search/Place+Name/
  const path = url.match(/\/(?:place|search)\/([^/?]+?)(?:\/|@|$)/)
  if (path) {
    const name = decodePlaceSegment(path[1])
    // "?api=1" style links put a literal "" segment here; and a bare
    // coordinate pair is a location, not a name.
    if (name && !/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(name)) return name
  }

  // ?q=Name or ?query=Name (skip when it is just coordinates).
  const q = url.match(/[?&](?:q|query)=([^&]+)/)
  if (q) {
    const value = decodeURIComponent(q[1].replace(/\+/g, ' ')).trim()
    const beforeAt = value.indexOf('@') >= 0 ? value.slice(0, value.indexOf('@')).trim() : value
    if (beforeAt && !/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(beforeAt)) return beforeAt
  }

  return null
}

export function parseGoogleMapsUrl(url: string): ParsedMapsResult | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const coords = extractCoords(trimmed)
    if (!coords) return null
    return {
      latitude: coords.lat,
      longitude: coords.lng,
      placeName: extractPlaceName(trimmed),
    }
  } catch {
    return null
  }
}
