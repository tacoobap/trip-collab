import { useState } from 'react'
import { LayoutGrid, Loader2, Map as MapIcon, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollectionItemCard } from '@/components/collection/CollectionItemCard'
import { CollectionMapPanel } from '@/components/collection/CollectionMapPanel'
import {
  countUnmappable,
  hasCoordinates,
  hasStayCoordinates,
  type MappableStay,
} from '@/lib/mapPoints'
import { cn } from '@/lib/utils'
import type { CollectionItem, Stay } from '@/types/database'

const OTHER_LABEL = 'Other'

type CollectionView = 'list' | 'map'

/**
 * The view survives leaving the page — planning and back shouldn't drop you
 * out of the map. Reads can throw outright in private browsing, so every
 * access is guarded and the default simply wins.
 */
const VIEW_STORAGE_KEY = 'trup:collection-view'

function readStoredView(): CollectionView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'map' ? 'map' : 'list'
  } catch {
    return 'list'
  }
}

function groupByDestination(
  items: CollectionItem[],
  destinationOrder: string[]
): { label: string; items: CollectionItem[] }[] {
  const sorted = [...items].sort((a, b) => {
    const likesA = a.likes.length
    const likesB = b.likes.length
    if (likesB !== likesA) return likesB - likesA
    return (a.created_at || '').localeCompare(b.created_at || '')
  })
  const map = new Map<string, CollectionItem[]>()
  for (const dest of destinationOrder) {
    map.set(dest, [])
  }
  map.set(OTHER_LABEL, [])
  for (const item of sorted) {
    const dest = item.destination?.trim() || null
    const key = dest && destinationOrder.includes(dest) ? dest : OTHER_LABEL
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return destinationOrder
    .filter((d) => (map.get(d)?.length ?? 0) > 0)
    .map((label) => ({ label, items: map.get(label) ?? [] }))
    .concat(
      (map.get(OTHER_LABEL)?.length ?? 0) > 0
        ? [{ label: OTHER_LABEL, items: map.get(OTHER_LABEL) ?? [] }]
        : []
    )
}

function sameCity(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Which stays belong on a section's map. A stay carries a city, so it lines up
 * with the destination sections; one in a city that isn't a destination joins
 * the same catch-all its places would. On a single-destination trip every
 * section is the same city, so every stay belongs.
 */
function staysForSection(
  stays: Stay[],
  label: string,
  destinationOrder: string[]
): MappableStay[] {
  const pinned = stays.filter(hasStayCoordinates)
  if (destinationOrder.length <= 1) return pinned
  if (label === OTHER_LABEL) {
    return pinned.filter((s) => !destinationOrder.some((d) => sameCity(d, s.city)))
  }
  return pinned.filter((s) => sameCity(s.city, label))
}

interface CollectionListProps {
  itemsLoading: boolean
  items: CollectionItem[]
  stays: Stay[]
  destinationOrder: string[]
  displayName: string
  isMember: boolean
  isOwner: boolean
  onLike: (itemId: string) => void
  onEdit: (item: CollectionItem) => void
  onDelete: (itemId: string) => void
  onAddClick: () => void
}

export function CollectionList({
  itemsLoading,
  items,
  stays,
  destinationOrder,
  displayName,
  isMember,
  isOwner,
  onLike,
  onEdit,
  onDelete,
  onAddClick,
}: CollectionListProps) {
  const [view, setView] = useState<CollectionView>(readStoredView)

  const chooseView = (next: CollectionView) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // Not worth failing a click over — it just won't be remembered.
    }
  }

  if (itemsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hasAny = items.length > 0
  if (!hasAny) {
    return (
      <div className="text-center py-12 rounded-xl border border-dashed border-border bg-muted/20">
        <p className="text-muted-foreground text-sm mb-4">
          No ideas in the collection yet.
        </p>
        {isMember && (
          <Button onClick={onAddClick} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Add the first one
          </Button>
        )}
      </div>
    )
  }

  const sections = groupByDestination(items, destinationOrder)
  const singleDestination = sections.length === 1
  const anyMappable = items.some(hasCoordinates)
  // Nothing to show on a map, and no toggle to escape with, so fall back.
  const effectiveView = anyMappable ? view : 'list'

  return (
    <div>
      {anyMappable && (
        <div className="flex justify-end mb-4 max-sm:mb-3">
          <div
            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5"
            role="group"
            aria-label="View"
          >
            {(
              [
                { value: 'list', label: 'List', Icon: LayoutGrid },
                { value: 'map', label: 'Map', Icon: MapIcon },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseView(value)}
                aria-pressed={view === value}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  view === value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-10 max-sm:space-y-8">
        {sections.map(({ label, items: list }) => {
          const mappable = list.filter(hasCoordinates)
          const unmappable = countUnmappable(list)
          const sectionStays = staysForSection(stays, label, destinationOrder)
          return (
            <section key={label}>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4 max-sm:mb-3">
                {singleDestination ? 'Ideas' : label}
              </h2>
              {effectiveView === 'map' ? (
                mappable.length > 0 ? (
                  <CollectionMapPanel
                    items={mappable}
                    stays={sectionStays}
                    unmappable={unmappable}
                    currentName={displayName}
                    onLike={isMember ? onLike : undefined}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing here has a Google Maps link with coordinates yet.
                  </p>
                )
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.map((item) => (
                    <CollectionItemCard
                      key={item.id}
                      item={item}
                      currentName={displayName}
                      onLike={isMember ? onLike : undefined}
                      onEdit={
                        isMember && (isOwner || item.created_by === displayName)
                          ? onEdit
                          : undefined
                      }
                      onDelete={
                        isMember && (isOwner || item.created_by === displayName)
                          ? onDelete
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
