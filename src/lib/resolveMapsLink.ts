export interface ResolvedPlace {
  latitude: number
  longitude: number
  placeName: string | null
  /** The expanded link, when a short link was followed. */
  url?: string
  /** 'link' — read off the link. 'search' — a name lookup, so it may be wrong. */
  source: 'link' | 'search'
}

/**
 * Work out where a place is when its Google Maps link doesn't say.
 *
 * Runs server-side: expanding a short link needs a redirect the browser won't
 * follow cross-origin, and the geocoder wants an identifying User-Agent. That
 * means it only works where the Netlify functions run — under a plain
 * `npm run dev` it fails, and the caller treats the place as un-pinnable,
 * exactly as before this existed.
 */
export async function resolvePlaceLocation(
  { url, query }: { url?: string | null; query?: string | null },
  getToken?: () => Promise<string | null>
): Promise<ResolvedPlace> {
  const params = new URLSearchParams()
  if (url) params.set('url', url)
  if (query) params.set('q', query)

  const headers: Record<string, string> = {}
  if (getToken) {
    const token = await getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(
    `${window.location.origin}/.netlify/functions/resolve-maps-link?${params}`,
    { headers }
  )
  const data = (await res.json().catch(() => null)) as
    | ResolvedPlace
    | { error: string }
    | null

  if (!res.ok || !data || !('latitude' in data)) {
    const message =
      data && 'error' in data ? data.error : `Could not locate that place (${res.status})`
    throw new Error(message)
  }
  return data
}
