import { Loader2 } from 'lucide-react'
import type { MapsLinkLocation } from '@/hooks/useMapsLinkLocation'

/**
 * What became of what was typed into a place field: being looked up, located,
 * located by searching a name (so possibly the wrong place), or not locatable.
 *
 * An address is only ever found by searching, so it gets no warning of its own
 * — the matched address printed below it is the thing to check.
 */
export function MapsLinkStatus({ location }: { location: MapsLinkLocation }) {
  const { resolving, position, source, error, kind } = location

  return (
    <>
      {resolving && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          {kind === 'address'
            ? 'Looking up that address…'
            : 'This link doesn’t include a location — looking it up…'}
        </p>
      )}
      {position && (
        <p className="text-xs text-muted-foreground mt-1">
          Location: {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
          {position.placeName && ` · ${position.placeName}`}
        </p>
      )}
      {source === 'search' && (
        <p className="text-xs text-warning-foreground/80 mt-1">
          Found by searching the name, not from the link — worth a glance to
          check it’s the right place.
        </p>
      )}
      {error && (
        <p className="text-xs text-muted-foreground mt-1">
          {error}.{' '}
          {kind === 'address'
            ? 'It’s still saved as a link to that search — it just won’t show on the map.'
            : 'It’s still saved as a link — it just won’t show on the map.'}
        </p>
      )}
    </>
  )
}
