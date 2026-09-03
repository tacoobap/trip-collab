import { Suspense, lazy } from 'react'
import { Loader2 } from 'lucide-react'
import type { MappableItem, MappableStay } from '@/lib/mapPoints'

// Leaflet and its CSS only ship to browsers that actually open the map view.
const CollectionMap = lazy(() => import('./CollectionMap'))

interface CollectionMapPanelProps {
  items: MappableItem[]
  /** The stays in this city that can be pinned, drawn as their own kind of pin. */
  stays: MappableStay[]
  /** Why places in this city are missing from the map, if any are. */
  unmappable: { shortLinks: number; linksWithoutPosition: number; total: number }
  currentName: string
  onLike?: (itemId: string) => void
}

function plural(n: number) {
  return n === 1 ? '1 place' : `${n} places`
}

export function CollectionMapPanel({
  items,
  stays,
  unmappable,
  currentName,
  onLike,
}: CollectionMapPanelProps) {
  return (
    <div>
      <div className="h-[400px] sm:h-[520px]">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center rounded-2xl border border-border/50 bg-muted/40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <CollectionMap
            items={items}
            stays={stays}
            currentName={currentName}
            onLike={onLike}
            className="h-full w-full"
          />
        </Suspense>
      </div>
      {unmappable.total > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {unmappable.shortLinks > 0 && (
            <>
              {plural(unmappable.shortLinks)} here {unmappable.shortLinks === 1 ? 'uses' : 'use'} a
              shortened Google Maps link (maps.app.goo.gl/…), which carries no
              coordinates. Open {unmappable.shortLinks === 1 ? 'it' : 'one'} for editing and save
              again — the link gets expanded automatically.
            </>
          )}
          {unmappable.shortLinks > 0 && unmappable.linksWithoutPosition > 0 && ' '}
          {unmappable.linksWithoutPosition > 0 && (
            <>
              {plural(unmappable.linksWithoutPosition)}{' '}
              {unmappable.linksWithoutPosition === 1 ? 'links' : 'link'} to Maps without a
              position — search for the place and copy the link from the address bar.
            </>
          )}
        </p>
      )}
    </div>
  )
}
