import { useState, useEffect, useMemo, useRef } from 'react'
import { MapPin, Plus, Loader2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Trip, DayWithSlots } from '@/types/database'
import { updateTripMeta } from '@/services/tripService'
import { syncTripDays } from '@/services/planningService'
import { enumerateDates } from '@/lib/dateRange'

interface EditTripModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: Trip
  /** Days already on the board — drives the city assignments and the drop warning. */
  days: DayWithSlots[]
  onSaved?: () => void
}

function formatDay(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function EditTripModal({
  open,
  onOpenChange,
  trip,
  days,
  onSaved,
}: EditTripModalProps) {
  const [name, setName] = useState(trip.name)
  const [destination, setDestination] = useState('')
  const [destinations, setDestinations] = useState<string[]>(trip.destinations ?? [])
  const [startDate, setStartDate] = useState(trip.start_date ?? '')
  const [endDate, setEndDate] = useState(trip.end_date ?? '')
  /** Cities the user reassigned in this session, by date. */
  const [cityEdits, setCityEdits] = useState<Record<string, string>>({})
  const [dropOutOfRange, setDropOutOfRange] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endDateInputRef = useRef<HTMLInputElement>(null)

  // Seed the form when the modal opens. Deliberately not keyed on the trip's
  // fields: those get a new identity on every snapshot, and re-running here
  // would wipe whatever the user was part-way through typing.
  useEffect(() => {
    if (!open) return
    setName(trip.name)
    setDestinations(trip.destinations ?? [])
    setStartDate(trip.start_date ?? '')
    setEndDate(trip.end_date ?? '')
    setDestination('')
    setCityEdits({})
    setDropOutOfRange(false)
    setError('')
  }, [open, trip.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rangeDates = useMemo(
    () => (startDate && endDate ? enumerateDates(startDate, endDate) : []),
    [startDate, endDate]
  )

  const dayByDate = useMemo(() => {
    const m = new Map<string, DayWithSlots>()
    for (const d of days) if (d.date) m.set(d.date, d)
    return m
  }, [days])

  // Destinations plus any city already sitting on a day, so a city that predates
  // the destinations list doesn't silently drop out of the options
  const cityOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const c of [...destinations, ...days.map((d) => d.city)]) {
      const city = c?.trim()
      if (city && !seen.has(city)) {
        seen.add(city)
        out.push(city)
      }
    }
    return out
  }, [destinations, days])

  /** One row per date in the range, with the city that would be saved for it. */
  const dayRows = useMemo(() => {
    let carry = ''
    return rangeDates.map((date, i) => {
      const existing = dayByDate.get(date)
      // All plain strings — an empty one means "not assigned yet", so `||`
      const city =
        cityEdits[date] || existing?.city || carry || destinations[0] || ''
      carry = city || carry
      return {
        date,
        dayNumber: i + 1,
        formatted: formatDay(date),
        city,
        isNew: !existing,
      }
    })
  }, [rangeDates, dayByDate, cityEdits, destinations])

  const newDayCount = dayRows.filter((r) => r.isNew).length

  // Days whose date the new range no longer covers. Empty ones just go; the
  // ones carrying plans are the user's call, so they get named here.
  const leavingRange = useMemo(() => {
    if (rangeDates.length === 0) return []
    const inRange = new Set(rangeDates)
    return days.filter((d) => d.date && !inRange.has(d.date))
  }, [days, rangeDates])

  const leavingWithContent = leavingRange.filter(
    (d) => d.slots.length > 0 || d.image_url || d.narrative_title
  )
  const leavingEmptyCount = leavingRange.length - leavingWithContent.length

  const addDestination = () => {
    const trimmed = destination.trim()
    if (trimmed && !destinations.includes(trimmed)) {
      setDestinations([...destinations, trimmed])
      setDestination('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError('')
    try {
      await updateTripMeta(trip.id, {
        name: name.trim(),
        destinations,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      // The range alone isn't enough — without this, extending a trip leaves
      // the new days missing from the board entirely
      await syncTripDays(
        trip.id,
        startDate || null,
        endDate || null,
        destinations[0] ?? '',
        {
          cityByDate: Object.fromEntries(
            dayRows.filter((r) => r.city).map((r) => [r.date, r.city])
          ),
          outOfRange: dropOutOfRange ? 'remove' : 'keep',
        }
      )
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      console.error(err)
      setError('Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Edit trip</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Trip name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Paris & London · May 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Destinations
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Paris — press Enter to add"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addDestination()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addDestination}
                disabled={!destination.trim()}
                title="Add city"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {destinations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {destinations.map((d) => (
                  <span
                    key={d}
                    className="flex items-center gap-1 bg-muted text-foreground text-xs rounded-full px-2.5 py-1"
                  >
                    <MapPin className="w-3 h-3" />
                    {d}
                    <button
                      type="button"
                      onClick={() =>
                        setDestinations(destinations.filter((x) => x !== d))
                      }
                      className="ml-1 opacity-50 hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Start date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const next = e.target.value
                  setStartDate(next)
                  if (next) {
                    if (!endDate || endDate < next) setEndDate(next)
                    setTimeout(() => {
                      const el = endDateInputRef.current
                      if (el) {
                        el.focus()
                        el.showPicker?.()
                      }
                    }, 0)
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                End date
              </label>
              <Input
                ref={endDateInputRef}
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Days — reassign cities without hunting down each column's pencil */}
          {rangeDates.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Days & cities
                </label>
                <span className="text-xs text-muted-foreground">
                  {rangeDates.length} day{rangeDates.length !== 1 ? 's' : ''}
                  {newDayCount > 0 && ` · ${newDayCount} new`}
                </span>
              </div>

              {cityOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add a destination above, then assign it to your days here.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {dayRows.map((row) => (
                    <div
                      key={row.date}
                      className="flex items-start gap-3 px-3 py-2.5"
                    >
                      <div className="w-[5.5rem] shrink-0 pt-0.5">
                        <p className="text-xs font-semibold text-foreground">
                          Day {row.dayNumber}
                          {row.isNew && (
                            <span className="ml-1 font-normal text-primary">new</span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {row.formatted}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 min-w-0">
                        {cityOptions.map((city) => (
                          <button
                            key={city}
                            type="button"
                            onClick={() =>
                              setCityEdits((prev) => ({
                                ...prev,
                                [row.date]: city,
                              }))
                            }
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              row.city === city
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-foreground border-border hover:border-primary/40'
                            }`}
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Days the new range no longer covers */}
          {leavingRange.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-warning-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 text-xs text-warning-foreground">
                  {leavingEmptyCount > 0 && (
                    <p>
                      Removing {leavingEmptyCount} empty day
                      {leavingEmptyCount !== 1 ? 's' : ''} outside these dates.
                    </p>
                  )}
                  {leavingWithContent.length > 0 && (
                    <>
                      <p className={leavingEmptyCount > 0 ? 'mt-1' : undefined}>
                        These days fall outside the new dates but already have
                        plans on them:{' '}
                        <span className="font-medium">
                          {leavingWithContent
                            .map((d) => (d.date ? formatDay(d.date) : d.label))
                            .join(', ')}
                        </span>
                      </p>
                      <label className="flex items-start gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dropOutOfRange}
                          onChange={(e) => setDropOutOfRange(e.target.checked)}
                          className="mt-0.5 shrink-0"
                        />
                        <span>
                          Delete them too, with their slots and ideas. Left
                          unchecked they stay on the board, in date order.
                        </span>
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!name.trim() || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
