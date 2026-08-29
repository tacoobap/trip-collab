import { Suspense, lazy } from 'react'
import { Loader2 } from 'lucide-react'
import type { MappableItem } from '@/lib/mapPoints'

// Leaflet and its CSS only ship to browsers that actually open the map view.
const CollectionMap = lazy(() => import('./CollectionMap'))

interface CollectionMapPanelProps {
  items: MappableItem[]
  /** Places in this city whose maps link carries no coordinates. */
  unmappableCount: number
  currentName: string
  onLike?: (itemId: string) => void
}

export function CollectionMapPanel({
  items,
  unmappableCount,
  currentName,
  onLike,
}: CollectionMapPanelProps) {
  return (
    <div>
      <div className="h-[400px] sm:h-[520px]">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-border/60 bg-muted/40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <CollectionMap
            items={items}
            currentName={currentName}
            onLike={onLike}
            className="h-full w-full"
          />
        </Suspense>
      </div>
      {unmappableCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {unmappableCount === 1 ? '1 place isn’t' : `${unmappableCount} places aren’t`} on
          the map — a shortened Google Maps link (maps.app.goo.gl/…) carries no
          coordinates. Open it and paste the full URL to pin it.
        </p>
      )}
    </div>
  )
}
