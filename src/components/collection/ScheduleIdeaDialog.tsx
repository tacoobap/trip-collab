import { useEffect, useState } from 'react'
import { CalendarPlus, Check, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { addLockedSlot } from '@/services/planningService'
import { DEFAULT_DURATION_MIN, SHELF_DROP_DURATION_MIN } from '@/lib/timeGrid'
import { formatTimeLabel, parseTimeToMinutes } from '@/lib/timeUtils'
import { cn } from '@/lib/utils'
import type { CollectionItem, DayWithSlots, Slot } from '@/types/database'

/**
 * A collection idea is food/activity/other; a slot has a wider vocabulary.
 * `other` has no counterpart, so it takes the slot default rather than
 * inventing a category the board has no icon or colour for.
 */
function slotCategoryFor(category: CollectionItem['category']): Slot['category'] {
  return category === 'food' ? 'food' : 'activity'
}

/**
 * Which days already hold this idea. Matched on title, the same way
 * `PickFromCollectionModal` decides an item is "already in itinerary" — a
 * collection item leaves no id behind on the proposal it becomes.
 */
function dayIdsHolding(item: CollectionItem, days: DayWithSlots[]): Set<string> {
  const name = item.name.trim().toLowerCase()
  const ids = new Set<string>()
  if (!name) return ids
  for (const day of days) {
    for (const slot of day.slots) {
      if (slot.proposals.some((p) => p.title?.trim().toLowerCase() === name)) {
        ids.add(day.id)
        break
      }
    }
  }
  return ids
}

function dateTextFor(day: DayWithSlots): string | null {
  if (!day.date) return null
  return new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

interface ScheduleIdeaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CollectionItem | null
  tripId: string
  days: DayWithSlots[]
  currentName: string
  /**
   * The day it landed on and the time label it took, `null` for the shelf —
   * enough for the caller to say where it went.
   */
  onScheduled: (day: DayWithSlots, timeLabel: string | null) => void
  onError: () => void
}

/**
 * "Put this on a day" from a collection card — the missing half of
 * `PickFromCollectionModal`, which only runs the other way round.
 *
 * The day list is the commit: one tap schedules. Time is an optional step
 * taken *before* that tap, because the shelf ("sometime this day") is the
 * cheap default and the grid can drag a chip onto the timeline later. The idea
 * lands locked, matching what the board's own quick-add does — putting
 * something on a day is the decision, and the collection is where undecided
 * ideas already live.
 */
export function ScheduleIdeaDialog({
  open,
  onOpenChange,
  item,
  tripId,
  days,
  currentName,
  onScheduled,
  onError,
}: ScheduleIdeaDialogProps) {
  const [timed, setTimed] = useState(false)
  const [timeInput, setTimeInput] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)
  const [savingDayId, setSavingDayId] = useState<string | null>(null)

  // Each idea gets a fresh choice; a time typed for one shouldn't follow the next.
  useEffect(() => {
    if (!open) return
    setTimed(false)
    setTimeInput('')
    setTimeError(null)
    setSavingDayId(null)
  }, [open, item?.id])

  if (!item) return null

  const alreadyOn = dayIdsHolding(item, days)

  const handlePick = async (day: DayWithSlots) => {
    if (savingDayId) return

    let timeLabel: string | null = null
    if (timed) {
      timeLabel = formatTimeLabel(timeInput)
      if (!timeLabel) {
        setTimeError('Use a time like 9:00 AM or 2:30 PM')
        return
      }
      setTimeError(null)
    }
    const start = timeLabel === null ? null : parseTimeToMinutes(timeLabel)

    setSavingDayId(day.id)
    try {
      await addLockedSlot({
        day_id: day.id,
        trip_id: tripId,
        time_label: timeLabel ?? '',
        sort_order: day.slots.length,
        category: slotCategoryFor(item.category),
        proposer_name: currentName,
        title: item.name,
        note: item.place_name ?? null,
        url: item.google_maps_url ?? null,
        start_minutes: start,
        duration_minutes: start === null ? SHELF_DROP_DURATION_MIN : DEFAULT_DURATION_MIN,
      })
      onScheduled(day, timeLabel)
      onOpenChange(false)
    } catch {
      onError()
    } finally {
      setSavingDayId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[80vh] flex flex-col">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Put on a day</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="text-foreground font-medium">{item.name}</span> — pick
            the day it belongs on.
          </p>
        </DialogHeader>

        <div className="shrink-0 pb-3 mb-1 border-b border-border/60">
          <div
            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5"
            role="group"
            aria-label="When during the day"
          >
            {(
              [
                { value: false, label: 'Sometime this day' },
                { value: true, label: 'At a time' },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setTimed(value)
                  setTimeError(null)
                }}
                aria-pressed={timed === value}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  timed === value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {timed && (
            <div className="mt-2.5">
              <input
                autoFocus
                value={timeInput}
                onChange={(e) => {
                  setTimeInput(e.target.value)
                  if (timeError) setTimeError(null)
                }}
                placeholder="e.g. 9:00 AM"
                aria-label="Start time"
                aria-invalid={!!timeError}
                className={cn(
                  'w-32 text-sm bg-transparent border-b outline-none text-foreground',
                  timeError ? 'border-destructive' : 'border-primary'
                )}
              />
              {timeError ? (
                <p className="text-xs text-destructive mt-1">{timeError}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Lands as a {DEFAULT_DURATION_MIN}-minute event you can resize on the board.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              This trip has no days yet. Set its dates on the planning page first.
            </p>
          ) : (
            <div className="space-y-1">
              {days.map((day) => {
                const dateText = dateTextFor(day)
                const saving = savingDayId === day.id
                return (
                  <button
                    key={day.id}
                    type="button"
                    disabled={!!savingDayId}
                    onClick={() => void handlePick(day)}
                    className={cn(
                      'w-full text-left rounded-lg border border-border/60 bg-muted/20 p-2.5',
                      'flex items-center gap-2 transition-colors',
                      'hover:bg-muted/40 hover:border-primary/30',
                      'disabled:opacity-60 disabled:hover:bg-muted/20 disabled:hover:border-border/60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm truncate">
                        {day.label}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {dateText && (
                          <span className="text-xs text-muted-foreground">{dateText}</span>
                        )}
                        {alreadyOn.has(day.id) && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Check className="w-3 h-3" />
                            Already here
                          </span>
                        )}
                      </div>
                    </div>
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <CalendarPlus className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
