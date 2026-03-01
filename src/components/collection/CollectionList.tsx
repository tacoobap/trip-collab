import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollectionItemCard } from '@/components/collection/CollectionItemCard'
import type { CollectionItem } from '@/types/database'

const OTHER_LABEL = 'Other'

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

interface CollectionListProps {
  itemsLoading: boolean
  items: CollectionItem[]
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
  destinationOrder,
  displayName,
  isMember,
  isOwner,
  onLike,
  onEdit,
  onDelete,
  onAddClick,
}: CollectionListProps) {
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

  return (
    <div className="space-y-10 max-sm:space-y-8">
      {sections.map(({ label, items: list }) => (
        <section key={label}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4 max-sm:mb-3">
            {label}
          </h2>
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
        </section>
      ))}
    </div>
  )
}
