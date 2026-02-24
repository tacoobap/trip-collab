/**
 * Parse Google Maps URLs to extract latitude, longitude, and optionally place name.
 * Supports: /place/Name/@lat,lng, /search/Name/@lat,lng, ?q=lat,lng, ?q=Name@lat,lng
 */
export interface ParsedMapsResult {
  latitude: number
  longitude: number
  placeName: string | null
}

function decodePlaceSegment(seg: string): string {
  return decodeURIComponent(seg.replace(/\+/g, ' ')).trim() || ''
}

export function parseGoogleMapsUrl(url: string): ParsedMapsResult | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    // /@lat,lng or /@lat,lng,zoom — extract coords first
    const atMatch = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (atMatch) {
      const lat = parseFloat(atMatch[1])
      const lng = parseFloat(atMatch[2])
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        let placeName: string | null = null
        // /place/Place+Name/ or /place/Place+Name/@...
        const placeMatch = trimmed.match(/\/place\/([^/]+?)(?:\/|@|$)/)
        if (placeMatch) placeName = decodePlaceSegment(placeMatch[1])
        // /search/Place+Name/ (e.g. maps/search/A.+Wong/@...)
        if (!placeName) {
          const searchMatch = trimmed.match(/\/search\/([^/]+?)(?:\/|@|$)/)
          if (searchMatch) placeName = decodePlaceSegment(searchMatch[1])
        }
        return { latitude: lat, longitude: lng, placeName: placeName || null }
      }
    }

    // ?q=lat,lng or ?q=Place+Name@lat,lng
    const qMatch = trimmed.match(/[?&]q=([^&]+)/)
    if (qMatch) {
      const q = decodeURIComponent(qMatch[1].replace(/\+/g, ' '))
      const atInQ = q.indexOf('@')
      const coordsPart = atInQ >= 0 ? q.slice(atInQ + 1) : q
      const placePart = atInQ >= 0 ? q.slice(0, atInQ) : null
      const [latStr, lngStr] = coordsPart.split(',')
      const lat = parseFloat(latStr)
      const lng = parseFloat(lngStr)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const placeName =
          placePart && placePart.trim().length > 0 ? placePart.trim() : null
        return { latitude: lat, longitude: lng, placeName }
      }
    }

    return null
  } catch {
    return null
  }
}
