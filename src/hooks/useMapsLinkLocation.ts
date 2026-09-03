import { useEffect, useRef, useState } from 'react'
import { parseGoogleMapsUrl } from '@/lib/parseGoogleMapsUrl'
import { resolvePlaceLocation, type ResolvedPlace } from '@/lib/resolveMapsLink'

export interface MapsLinkPosition {
  latitude: number
  longitude: number
  placeName: string | null
}

export interface MapsLinkLocation {
  /** The link as it should be saved — expanded, when a short link was followed. */
  effectiveUrl: string
  /** Where the link points, however that was arrived at. */
  position: MapsLinkPosition | null
  /** A lookup is in flight for the link currently in the field. */
  resolving: boolean
  /** 'link' — read off the link. 'search' — a name lookup, so it may be wrong. */
  source: 'link' | 'search' | null
  /** Set when the current link can't be located at all. */
  error: string | null
}

export interface UseMapsLinkLocationOptions {
  /** The raw contents of the link field. */
  url: string
  getToken?: () => Promise<string | null>
  /**
   * A name to fall back on when the link itself carries no position. Read when
   * a lookup starts, never used as a trigger — a name typed after the link
   * shouldn't restart the request on every keystroke.
   */
  lookupQuery?: string | null
  /** Changing this restarts the lookup, e.g. the user picked a different city. */
  lookupKey?: string | null
  /** Called when an expanded link turned out to carry a place name of its own. */
  onLinkName?: (placeName: string) => void
}

/**
 * Work out where a pasted Google Maps link points.
 *
 * Most links say so themselves and are read on the spot. Some carry no
 * position — a shortened link is only an id, and a `cid=` or name-only link
 * never had coordinates — and those are worked out server-side. Results are
 * tagged with the URL they were fetched for, so a stale answer for a link the
 * user has since edited is simply ignored.
 */
export function useMapsLinkLocation({
  url,
  getToken,
  lookupQuery,
  lookupKey,
  onLinkName,
}: UseMapsLinkLocationOptions): MapsLinkLocation {
  const [resolved, setResolved] = useState<{ forUrl: string; place: ResolvedPlace } | null>(null)
  const [failed, setFailed] = useState<{ forUrl: string; message: string } | null>(null)

  // Read at request time rather than depended on, so neither retriggers a
  // lookup. Synced in an effect declared before the lookup below, so that one
  // always sees the values from the render it fired on.
  const lookupQueryRef = useRef(lookupQuery)
  const onLinkNameRef = useRef(onLinkName)
  useEffect(() => {
    lookupQueryRef.current = lookupQuery
    onLinkNameRef.current = onLinkName
  })

  const trimmedUrl = url.trim()
  const fromLink = trimmedUrl ? parseGoogleMapsUrl(trimmedUrl) : null
  // Only worth asking the server when the link itself doesn't say where it is.
  const needsResolving = !!trimmedUrl && !fromLink
  const place = resolved?.forUrl === trimmedUrl ? resolved.place : null
  const resolving =
    needsResolving && resolved?.forUrl !== trimmedUrl && failed?.forUrl !== trimmedUrl

  useEffect(() => {
    if (!needsResolving) return
    let cancelled = false
    resolvePlaceLocation(
      { url: trimmedUrl, query: lookupQueryRef.current?.trim() || null },
      getToken
    )
      .then((next) => {
        if (cancelled) return
        setResolved({ forUrl: trimmedUrl, place: next })
        // An expanded link is often the first thing that knows the name.
        if (next.source === 'link' && next.placeName) onLinkNameRef.current?.(next.placeName)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setFailed({
          forUrl: trimmedUrl,
          message: err instanceof Error ? err.message : 'Could not locate that place',
        })
      })
    return () => {
      cancelled = true
    }
  }, [trimmedUrl, needsResolving, getToken, lookupKey])

  return {
    effectiveUrl: place?.url ?? trimmedUrl,
    position:
      fromLink ??
      (place
        ? {
            latitude: place.latitude,
            longitude: place.longitude,
            placeName: place.placeName,
          }
        : null),
    resolving,
    source: fromLink ? 'link' : (place?.source ?? null),
    error:
      !resolving && !fromLink && !place && failed?.forUrl === trimmedUrl
        ? failed.message
        : null,
  }
}
