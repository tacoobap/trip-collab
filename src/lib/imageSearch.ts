export interface ImageSearchResult {
  url: string
  attribution: string      // "Photo by Name on Unsplash"
  photographer_url: string
  unsplash_url: string
}

interface UnsplashPhoto {
  urls: { regular: string }
  links: { html: string; download_location: string }
  user: { name: string; links: { html: string } }
}

export async function searchImage(query: string): Promise<ImageSearchResult> {
  // In production, use Netlify function so Unsplash key stays server-side (UNSPLASH_ACCESS_KEY in Netlify env)
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    const base = window.location.origin
    const res = await fetch(
      `${base}/.netlify/functions/search-image?query=${encodeURIComponent(query)}`
    )
    const data = (await res.json()) as
      | { url: string; attribution: string; photographer_url: string; unsplash_url: string }
      | { error: string }
    if (!res.ok) {
      const msg = 'error' in data ? data.error : `Image search failed: ${res.status}`
      throw new Error(msg)
    }
    if (!('url' in data)) throw new Error('Invalid response from image search')
    return {
      url: data.url,
      attribution: data.attribution,
      photographer_url: data.photographer_url,
      unsplash_url: data.unsplash_url,
    }
  }

  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string
  if (!accessKey) throw new Error('VITE_UNSPLASH_ACCESS_KEY is not set in .env')

  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '20')
  url.searchParams.set('orientation', 'landscape')
  url.searchParams.set('content_filter', 'high')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
  })

  if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`)

  const data = await res.json() as { results: UnsplashPhoto[] }
  if (!data.results?.length) throw new Error(`No images found for query: "${query}"`)
  const photo = data.results[Math.floor(Math.random() * data.results.length)]

  // Required by Unsplash API guidelines: trigger download event when photo is used
  fetch(`${photo.links.download_location}?client_id=${accessKey}`).catch(() => { /* fire-and-forget */ })

  return {
    url: photo.urls.regular,
    attribution: `Photo by ${photo.user.name} on Unsplash`,
    photographer_url: photo.user.links.html,
    unsplash_url: photo.links.html,
  }
}
