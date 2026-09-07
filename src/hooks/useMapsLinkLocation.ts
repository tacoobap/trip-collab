import { useEffect, useRef, useState } from 'react'
import { parseGoogleMapsUrl } from '@/lib/parseGoogleMapsUrl'
import {
  classifyPlaceInput,
  mapsSearchUrl,
  normalizePlaceUrl,
  parseCoordinatePair,
  type PlaceInputKind,
} from '@/lib/placeInput'
import { resolvePlaceLocation, type ResolvedPlace } from '@/lib/resolveMapsLink'

/**
 * A link arrives in one paste; an address arrives one keystroke at a time, and
 * the geocoder is a shared public service with a rate limit. So wait for the
 * typing to stop, and don't ask about a fragment too short to mean anything.
 */
const ADDRESS_DEBOUNCE_MS = 700
const MIN_ADDRESS_LENGTH = 4

export interface MapsLinkPosition {
  latitude: number
  longitude: number
  placeName: string | null
}

/**
 * How the position was arrived at:
 * 'link'    — read off the link itself, so it is exactly where it says.
 * 'address' — geocoded from a typed address, or typed as coordinates.
 * 'search'  — a link with no position, looked up by name, so it may be wrong.
 * 'saved'   — already stored against this place, and the field hasn't changed.
 */
export type MapsLinkSource = 'link' | 'address' | 'search' | 'saved'

export interface MapsLinkLocation {
  /** The link as it should be saved — an address becomes a Maps search link. */
  effectiveUrl: string
  /** Where the place is, however that was arrived at. */
  position: MapsLinkPosition | null
  /** A lookup is in flight (or pending) for what is currently in the field. */
  resolving: boolean
  source: MapsLinkSource | null
  /** Set when what's in the field can't be located at all. */
  error: string | null
  /** What the field holds, so callers can word themselves accordingly. */
  kind: PlaceInputKind
}

/** A position already stored for this place, from a previous save. */
export interface SavedPlacePosition {
  /** The value the field was seeded with, so an edit invalidates this. */
  value: string
  latitude?: number | null
  longitude?: number | null
  placeName?: string | null
}

export interface UseMapsLinkLocationOptions {
  /** The raw contents of the field: a Maps link, or an address. */
  value: string
  getToken?: () => Promise<string | null>
  /**
   * A name to fall back on when a *link* carries no position of its own. Read
   * when a lookup starts, never used as a trigger — a name typed after the
   * link shouldn't restart the request on every keystroke. Not used for a
   * typed address, which is its own query.
   */
  lookupQuery?: string | null
  /** Changing this restarts the lookup, e.g. the user picked a different city. */
  lookupKey?: string | null
  /** Called when an expanded link turned out to carry a place name of its own. */
  onLinkName?: (placeName: string) => void
  /** What is already saved, so re-opening an edit form doesn't look it up again. */
  saved?: SavedPlacePosition | null
}

/**
 * Work out where the place in a form's location field is.
 *
 * Most Maps links say so themselves and are read on the spot. The rest are
 * worked out server-side: a shortened link is only an id, a `cid=` link never
 * had coordinates, and a typed address has to be geocoded. Results are tagged
 * with the value they were fetched for, so a stale answer for something the
 * user has since edited is simply ignored.
 */
export function useMapsLinkLocation({
  value,
  getToken,
  lookupQuery,
  lookupKey,
  onLinkName,
  saved,
}: UseMapsLinkLocationOptions): MapsLinkLocation {
  const [resolved, setResolved] = useState<{ forValue: string; place: ResolvedPlace } | null>(null)
  const [failed, setFailed] = useState<{ forValue: string; message: string } | null>(null)

  // Read at request time rather than depended on, so neither retriggers a
  // lookup. Synced in an effect declared before the lookup below, so that one
  // always sees the values from the render it fired on.
  const lookupQueryRef = useRef(lookupQuery)
  const onLinkNameRef = useRef(onLinkName)
  useEffect(() => {
    lookupQueryRef.current = lookupQuery
    onLinkNameRef.current = onLinkName
  })

  const trimmed = value.trim()
  const kind = classifyPlaceInput(trimmed)
  const linkUrl = kind === 'url' ? normalizePlaceUrl(trimmed) : null

  // Three ways to know the answer without asking anyone: the link carries it,
  // the user typed coordinates, or it was already saved and nothing has changed.
  const fromLink = linkUrl ? parseGoogleMapsUrl(linkUrl) : null
  const typedCoords = kind === 'address' ? parseCoordinatePair(trimmed) : null
  const savedPosition = savedPositionFor(saved, trimmed)

  const alreadyKnown = fromLink || typedCoords || savedPosition
  const longEnough = kind === 'url' || trimmed.length >= MIN_ADDRESS_LENGTH
  const needsResolving = kind !== 'empty' && !alreadyKnown && longEnough

  const place = resolved?.forValue === trimmed ? resolved.place : null
  const resolving =
    needsResolving && resolved?.forValue !== trimmed && failed?.forValue !== trimmed

  useEffect(() => {
    if (!needsResolving) return
    let cancelled = false

    const run = () => {
      resolvePlaceLocation(
        kind === 'address'
          ? // A typed address is the whole question; there is no link to fall back from.
            { query: trimmed }
          : { url: linkUrl, query: lookupQueryRef.current?.trim() || null },
        getToken
      )
        .then((next) => {
          if (cancelled) return
          setResolved({ forValue: trimmed, place: next })
          // An expanded link is often the first thing that knows the name.
          if (next.source === 'link' && next.placeName) onLinkNameRef.current?.(next.placeName)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setFailed({
            forValue: trimmed,
            message: err instanceof Error ? err.message : 'Could not locate that place',
          })
        })
    }

    if (kind !== 'address') {
      run()
      return () => {
        cancelled = true
      }
    }
    const timer = setTimeout(run, ADDRESS_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, kind, linkUrl, needsResolving, getToken, lookupKey])

  return {
    effectiveUrl: effectiveUrlFor(kind, trimmed, linkUrl, place),
    position:
      fromLink ??
      (typedCoords ? { ...typedCoords, placeName: null } : null) ??
      savedPosition ??
      (place
        ? {
            latitude: place.latitude,
            longitude: place.longitude,
            placeName: place.placeName,
          }
        : null),
    resolving,
    source: sourceFor(kind, !!fromLink, !!typedCoords, !!savedPosition, place),
    error:
      !resolving && !alreadyKnown && !place && failed?.forValue === trimmed
        ? failed.message
        : null,
    kind,
  }
}

function savedPositionFor(
  saved: SavedPlacePosition | null | undefined,
  trimmed: string
): MapsLinkPosition | null {
  if (!saved || !trimmed || saved.value.trim() !== trimmed) return null
  const { latitude, longitude } = saved
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude, placeName: saved.placeName ?? null }
}

/**
 * What goes in `google_maps_url`. An address is saved as a search link for it,
 * so tapping through still lands somewhere useful even when the lookup failed.
 */
function effectiveUrlFor(
  kind: PlaceInputKind,
  trimmed: string,
  linkUrl: string | null,
  place: ResolvedPlace | null
): string {
  if (kind === 'empty') return ''
  if (kind === 'address') return mapsSearchUrl(trimmed)
  // An expanded short link is worth keeping over the id it came from.
  return place?.url ?? linkUrl ?? ''
}

function sourceFor(
  kind: PlaceInputKind,
  fromLink: boolean,
  typedCoords: boolean,
  savedPosition: boolean,
  place: ResolvedPlace | null
): MapsLinkSource | null {
  if (fromLink) return 'link'
  if (typedCoords) return 'address'
  if (savedPosition) return 'saved'
  if (!place) return null
  // The server searched by name either way; only from a link is that a surprise
  // worth flagging, since an address was always going to be looked up.
  if (kind === 'address') return 'address'
  return place.source
}
