import { useEffect, useState } from 'react'
import { CalendarPlus, Check, ChevronDown, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { addLockedSlot } from '@/services/planningService'
import {
  DEFAULT_DURATION_MIN,
  SHELF_DROP_DURATION_MIN,
  formatMinuteRange,
} from '@/lib/timeGrid'
import { formatTimeLabel, parseTimeToMinutes } from '@/lib/timeUtils'
import { cn } from '@/lib/utils'
import type { CollectionItem, DayWithSlots, Slot } from '@/types/database'
import { useTripPeople } from '@/contexts/TripPeopleContext'

const TIME_HINT = 'Use a time like 9:00 AM or 2:30 PM'

/**
 * A collection idea is food/activity/other; a slot has a wider vocabulary.
 * `other` has no counterpart, so it takes the slot default rather than
 * inventing a category the board has no icon or colour for.
 */
function slotCategoryFor(category: CollectionItem['category']): Slot['category'] {
  return category === 'food' ? 'food' : 'activity'
}

type Schedule =
  | { ok: true; startMinutes: number | null; duration: number; label: string | null }
  | { ok: false; error: string }

/**
 * Turns the two optional time fields into what the slot needs.
 *
 * Blank start is the whole point of the fields being optional: it means
 * "sometime this day", the shelf, and the end is meaningless without it. A
 * start on its own runs for `DEFAULT_DURATION_MIN`; an end replaces that.
 * Shared by the live hint and the commit so the two can't drift.
 */
function resolveSchedule(startInput: string, endInput: string): Schedule {
  const rawStart = startInput.trim()
  const rawEnd = endInput.trim()

  if (!rawStart) {
    // An end alone can't be honoured, and silently dropping it would lose
    // something the user deliberately typed.
    if (rawEnd) return { ok: false, error: 'Add a start time too, or clear the end.' }
    return { ok: true, startMinutes: null, duration: SHELF_DROP_DURATION_MIN, label: null }
  }

  const startLabel = formatTimeLabel(rawStart)
  if (!startLabel) return { ok: false, error: TIME_HINT }
  const startMinutes = parseTimeToMinutes(startLabel)

  if (!rawEnd) {
    return { ok: true, startMinutes, duration: DEFAULT_DURATION_MIN, label: startLabel }
  }

  const endLabel = formatTimeLabel(rawEnd)
  if (!endLabel) return { ok: false, error: TIME_HINT }
  // Midnight reads as the end of the day, not the start of it — the same
  // reading `InlineTimeRange` gives it in the proposal drawer.
  const parsedEnd = parseTimeToMinutes(endLabel)
  const endMinutes = parsedEnd === 0 ? 24 * 60 : parsedEnd
  if (endMinutes <= startMinutes) return { ok: false, error: 'End must be after the start.' }

  return { ok: true, startMinutes, duration: endMinutes - startMinutes, label: startLabel }
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

/** Same rule `CollectionList` groups by, so the two agree on what one city is. */
function sameCity(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Days in the idea's own city first, the rest folded away behind a toggle.
 *
 * Scheduling a Kyoto restaurant onto a Tokyo day is nearly always a mistake, so
 * the matching days are the whole list until you ask for more. Two cases have
 * no basis to split on and show everything instead: a legacy item carrying no
 * `destination`, and an idea whose city no day is in — hiding every day behind
 * a toggle there would be a worse list, not a shorter one.
 */
function splitByCity(
  item: CollectionItem,
  days: DayWithSlots[]
): { inCity: DayWithSlots[]; elsewhere: DayWithSlots[] } {
  const destination = item.destination?.trim()
  if (!destination) return { inCity: days, elsewhere: [] }
  const inCity = days.filter((d) => sameCity(d.city, destination))
  if (inCity.length === 0) return { inCity: days, elsewhere: [] }
  return { inCity, elsewhere: days.filter((d) => !sameCity(d.city, destination)) }
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
   * The day it landed on and the time range it took, `null` for the shelf —
   * enough for the caller to say where it went.
   */
  onScheduled: (day: DayWithSlots, timeRange: string | null) => void
  onError: () => void
}

/**
 * "Put this on a day" from a collection card — the missing half of
 * `PickFromCollectionModal`, which only runs the other way round.
 *
 * The day list is the commit: one tap schedules. Time is two optional fields
 * filled in *before* that tap, and leaving them empty is the cheap default —
 * the idea lands on the day's "sometime this day" shelf, which the grid can
 * drag onto the timeline later. The idea lands locked, matching what the
 * board's own quick-add does: putting something on a day is the decision, and
 * the collection is where undecided ideas already live.
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
  const { me } = useTripPeople()
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)
  const [savingDayId, setSavingDayId] = useState<string | null>(null)
  const [showElsewhere, setShowElsewhere] = useState(false)

  // Each idea gets a fresh choice; a time typed for one shouldn't follow the next.
  useEffect(() => {
    if (!open) return
    setStartInput('')
    setEndInput('')
    setTimeError(null)
    setSavingDayId(null)
    setShowElsewhere(false)
  }, [open, item?.id])

  if (!item) return null

  const alreadyOn = dayIdsHolding(item, days)
  const { inCity, elsewhere } = splitByCity(item, days)
  const schedule = resolveSchedule(startInput, endInput)

  // The hint always says what the current input would do, muted; only a commit
  // attempt turns the same message red (`timeError`). So a half-typed "9" reads
  // as the format guide rather than as a failure, and an end that lands before
  // the start says so instead of falling back to the empty case's promise of
  // the shelf, which by then isn't what would happen.
  const hint = !schedule.ok
    ? schedule.error
    : schedule.startMinutes === null
      ? 'Leave blank and it lands on the day’s “sometime this day” shelf.'
      : `${formatMinuteRange(schedule.startMinutes, schedule.duration)} — drag to resize on the board later.`

  const handlePick = async (day: DayWithSlots) => {
    if (savingDayId) return
    if (!schedule.ok) {
      setTimeError(schedule.error)
      return
    }
    setTimeError(null)

    setSavingDayId(day.id)
    try {
      await addLockedSlot({
        day_id: day.id,
        trip_id: tripId,
        time_label: schedule.label ?? '',
        sort_order: day.slots.length,
        category: slotCategoryFor(item.category),
        proposer_uid: me ?? '',
        proposer_name: currentName,
        title: item.name,
        note: item.place_name ?? null,
        url: item.google_maps_url ?? null,
        start_minutes: schedule.startMinutes,
        duration_minutes: schedule.duration,
      })
      onScheduled(
        day,
        schedule.startMinutes === null
          ? null
          : formatMinuteRange(schedule.startMinutes, schedule.duration)
      )
      onOpenChange(false)
    } catch {
      onError()
    } finally {
      setSavingDayId(null)
    }
  }

  const dayRow = (day: DayWithSlots) => {
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
          <p className="font-medium text-foreground text-sm truncate">{day.label}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {dateText && <span className="text-xs text-muted-foreground">{dateText}</span>}
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
  }

  const timeField = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    label: string
  ) => (
    <input
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
        if (timeError) setTimeError(null)
      }}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={!!timeError}
      className={cn(
        'w-[5.5rem] text-sm bg-transparent border-b outline-none text-foreground',
        'placeholder:text-muted-foreground/70',
        timeError ? 'border-destructive' : 'border-border focus:border-primary'
      )}
    />
  )

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
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Time
            </span>
            {timeField(startInput, setStartInput, 'e.g. 9:00 AM', 'Start time')}
            <span className="text-sm text-muted-foreground">–</span>
            {timeField(endInput, setEndInput, 'optional', 'End time')}
          </div>

          <p
            className={cn(
              'text-xs mt-1.5',
              timeError ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {timeError ?? hint}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              This trip has no days yet. Set its dates on the planning page first.
            </p>
          ) : (
            <div className="space-y-1">
              {inCity.map(dayRow)}

              {elsewhere.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowElsewhere((v) => !v)}
                    aria-expanded={showElsewhere}
                    className={cn(
                      'w-full flex items-center justify-center gap-1 py-3 touch-manipulation',
                      'text-xs text-muted-foreground hover:text-foreground transition-colors'
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 transition-transform',
                        showElsewhere && 'rotate-180'
                      )}
                    />
                    {elsewhere.length === 1
                      ? '1 day in another city'
                      : `${elsewhere.length} days in other cities`}
                  </button>
                  {showElsewhere && elsewhere.map(dayRow)}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
