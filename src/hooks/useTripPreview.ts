import { useEffect, useState } from 'react'

export interface TripPreview {
  name: string
  slug: string
  destinations: string[]
  imageUrl: string | null
  startDate: string | null
  endDate: string | null
}

/**
 * The handful of fields that describe a trip, for someone who isn't signed in.
 *
 * They come from the public `trip-preview` function, not Firestore — an
 * unauthenticated browser can't read a trip, and shouldn't be able to. The
 * function returns exactly what pasting the link into a chat already shows in
 * the preview card, so this reveals nothing new about the trip.
 *
 * The result carries the slug it was fetched for, which is what makes `loading`
 * derivable: a slug with no matching result yet is still loading, so nothing
 * has to be set synchronously as the effect runs.
 */
export function useTripPreview(slug: string | undefined) {
  const [result, setResult] = useState<{ slug: string; preview: TripPreview | null } | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetch(`/.netlify/functions/trip-preview?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? (res.json() as Promise<TripPreview>) : null))
      .catch(() => null)
      .then((preview) => {
        // A missing preview isn't an error worth showing — the sign-in prompt
        // still works without it.
        if (!cancelled) setResult({ slug, preview })
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  // Not `result?.slug === slug`: with both undefined that compares equal, and
  // TypeScript rightly won't narrow `result` to non-null through it.
  const settled = result !== null && result.slug === slug
  return { preview: settled ? result.preview : null, loading: !!slug && !settled }
}
