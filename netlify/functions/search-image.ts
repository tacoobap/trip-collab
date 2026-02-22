import type { Handler } from '@netlify/functions'

interface UnsplashPhoto {
  urls: { regular: string; full: string }
  links: { html: string; download_location: string }
  user: { name: string; links: { html: string } }
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[]
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'UNSPLASH_ACCESS_KEY not configured' }) }
  }

  const query = event.queryStringParameters?.query
  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query parameter' }) }
  }

  try {
    const searchUrl = new URL('https://api.unsplash.com/search/photos')
    searchUrl.searchParams.set('query', query)
    searchUrl.searchParams.set('per_page', '1')
    searchUrl.searchParams.set('orientation', 'landscape')
    searchUrl.searchParams.set('content_filter', 'high')

    const res = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
    })

    if (!res.ok) {
      throw new Error(`Unsplash API error: ${res.status} ${await res.text()}`)
    }

    const data = (await res.json()) as UnsplashSearchResponse
    const photo = data.results?.[0]

    if (!photo) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No images found for this query' }),
      }
    }

    // Required by Unsplash API guidelines: trigger download event when photo is used
    fetch(photo.links.download_location, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    }).catch(() => { /* fire-and-forget */ })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: photo.urls.regular,
        attribution: `Photo by ${photo.user.name} on Unsplash`,
        photographer_url: photo.user.links.html,
        unsplash_url: photo.links.html,
      }),
    }
  } catch (err) {
    console.error('[search-image]', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Image search failed', detail: String(err) }),
    }
  }
}
