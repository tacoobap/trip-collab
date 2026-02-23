import { Heart } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { useCollectionItems } from '@/hooks/useCollectionItems'
import { getProposerColor, getProposerInitial } from '@/lib/proposerColors'
import type { CollectionItem, DayWithSlots } from '@/types/database'
import { cn } from '@/lib/utils'

interface PickFromCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId: string
  days?: DayWithSlots[]
  slotCategory?: string
  currentName: string
  onSelect: (item: CollectionItem) => void
}

function buildItemToDayLabels(days: DayWithSlots[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const day of days) {
    for (const slot of day.slots) {
      for (const proposal of slot.proposals) {
        const title = proposal.title?.trim() ?? ''
        if (!title) continue
        if (!map[title]) map[title] = []
        if (!map[title].includes(day.label)) map[title].push(day.label)
      }
    }
  }
  return map
}

export function PickFromCollectionModal({
  open,
  onOpenChange,
  tripId,
  days = [],
  slotCategory,
  currentName: _currentName,
  onSelect,
}: PickFromCollectionModalProps) {
  const { items, loading } = useCollectionItems(open ? tripId : undefined)
  const itemToDayLabels = buildItemToDayLabels(days)

  const grouped = items.reduce(
    (acc, item) => {
      const cat = item.category || 'other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(item)
      return acc
    },
    {} as Record<string, CollectionItem[]>
  )
  const order = ['food', 'activity', 'other'] as const
  const labels: Record<string, string> = { food: 'Food', activity: 'Activity', other: 'Other' }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[80vh] flex flex-col">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Pick from Collection</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Choose an idea to add to this slot.
          </p>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No ideas in the collection yet. Add some on the Collection page.
            </p>
          ) : (
            <div className="space-y-4">
              {order.map((cat) => {
                const list = grouped[cat] || []
                if (list.length === 0) return null
                return (
                  <div key={cat}>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      {labels[cat]}
                    </p>
                    <div className="space-y-1">
                      {list.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onSelect(item)
                            onOpenChange(false)
                          }}
                          className={cn(
                            'w-full text-left rounded-lg border border-border/60 bg-muted/20 p-2.5',
                            'hover:bg-muted/40 hover:border-primary/30 transition-colors'
                          )}
                        >
                          <p className="font-medium text-foreground text-sm truncate">
                            {item.name}
                          </p>
                          {itemToDayLabels[item.name]?.length ? (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Already in itinerary
                              <span className="ml-1 opacity-80">
                                · {itemToDayLabels[item.name].join(', ')}
                              </span>
                            </p>
                          ) : null}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Heart className="w-3.5 h-3.5" />
                              {item.likes?.length > 0 ? item.likes.length : '0'} like{(item.likes?.length ?? 0) !== 1 ? 's' : ''}
                            </span>
                            {item.created_by && (
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 border-background shrink-0"
                                style={{
                                  backgroundColor: getProposerColor(item.created_by).bg,
                                  color: getProposerColor(item.created_by).text,
                                }}
                                title={item.created_by}
                              >
                                {getProposerInitial(item.created_by)}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
