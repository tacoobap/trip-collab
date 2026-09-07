import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { syncTripDays } from '@/services/planningService'
import { Loader2, CalendarDays, Plus, Pencil } from 'lucide-react'
import { AddDayDialog } from './AddDayDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Trip } from '@/types/database'
import { enumerateDates } from '@/lib/dateRange'

interface DaySetup {
  date: string
  dayNumber: number
  formatted: string
  /** `''` is allowed — a day without a city is just `Day N`. */
  city: string
  /** This day's free-text city input is open, and is bound straight to `city`. */
  editing: boolean
}

interface TripSetupPanelProps {
  trip: Trip
  canEdit?: boolean
  onOpenEditTrip?: () => void
}

export function TripSetupPanel({ trip, canEdit = true, onOpenEditTrip }: TripSetupPanelProps) {
  // Build one setup row per date in the trip's range
  const initialDays = useMemo<DaySetup[]>(() => {
    if (!trip.start_date || !trip.end_date) return []
    return enumerateDates(trip.start_date, trip.end_date).map((date, i) => ({
      date,
      dayNumber: i + 1,
      formatted: new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      city: trip.destinations[0] ?? '',
      editing: false,
    }))
  }, [trip])

  const [days, setDays] = useState<DaySetup[]>(initialDays)
  const [bulkCity, setBulkCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // When trip is edited to add dates/cities, initialDays becomes populated but
  // local `days` was only set on first mount. Sync so we show the day setup view
  // without requiring a refresh.
  useEffect(() => {
    if (initialDays.length > 0 && days.length === 0) {
      setDays(initialDays)
    }
  }, [initialDays, days.length])

  const hasDates = days.length > 0

  // A trip created without destinations has nothing to offer as a pill, so it
  // gets a field that names every day at once instead of one tap and one typed
  // city per row. Keyed off the trip, not off `cityOptions`, so the field does
  // not vanish out from under the user the moment they fill it in.
  const needsCity = (trip.destinations?.length ?? 0) === 0

  // Cities offered as pills: the trip's own destinations plus any city already
  // named on a day, so typing one on Day 1 offers it on every other day. Days
  // still being typed into are excluded — otherwise every keystroke would
  // flicker a half-spelled name through the other days' pills.
  const cityOptions = useMemo(
    () =>
      [
        ...new Set([
          ...(trip.destinations ?? []),
          ...days.filter((d) => !d.editing).map((d) => d.city),
        ]),
      ].filter(Boolean),
    [trip.destinations, days]
  )

  const updateDay = (index: number, patch: Partial<DaySetup>) =>
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  /** Tapping the selected city clears it — a day without a city is valid. */
  const pickCity = (index: number, city: string) =>
    updateDay(index, { city: days[index].city === city ? '' : city, editing: false })

  /**
   * Opening the input starts empty; closing it is Enter or another pill, never
   * blur. Collapsing on blur shifted the page under the pointer, so a click
   * aimed at "Create days" landed on nothing.
   */
  const toggleCustom = (index: number) =>
    updateDay(index, days[index].editing ? { editing: false } : { editing: true, city: '' })

  const applyToAll = () => {
    const city = bulkCity.trim()
    if (!city) return
    setDays((prev) => prev.map((d) => ({ ...d, city, editing: false })))
  }

  const handleCreate = async () => {
    // The inputs write straight into `city`, so a still-open one is already
    // here — nothing to reconcile, and nothing to silently drop
    const resolved = days.map((d) => ({ ...d, city: d.city.trim() }))

    setLoading(true)
    setError('')

    try {
      // Same path the trip editor uses, so first setup and every later date
      // change agree on numbering and on which city a day belongs to. An empty
      // city passes straight through: `syncTripDays` carries the previous day's
      // city forward, and `dayLabel` falls back to a plain `Day N`.
      await syncTripDays(
        trip.id,
        trip.start_date,
        trip.end_date,
        trip.destinations[0] ?? '',
        {
          cityByDate: Object.fromEntries(resolved.map((d) => [d.date, d.city])),
        }
      )
      // useTrip's onSnapshot will pick up the new days automatically
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const [addDayOpen, setAddDayOpen] = useState(false)

  // No date range set — offer to add a day or edit trip
  if (!hasDates) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4">
            <CalendarDays className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-serif font-semibold text-foreground mb-2">
            No days yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Add a date range in trip settings, or add your first day below.
          </p>
          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-3">
              {onOpenEditTrip && (
                <Button
                  variant="outline"
                  onClick={onOpenEditTrip}
                  className="gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Edit trip (dates & name)
                </Button>
              )}
              <Button onClick={() => setAddDayOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add first day
              </Button>
            </div>
          )}
        </div>
        <AddDayDialog
          open={addDayOpen}
          onOpenChange={setAddDayOpen}
          trip={trip}
          existingDays={[]}
        />
      </>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-4 sm:px-6 py-12"
    >
      {!canEdit && (
        <div className="mb-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-sm text-warning-foreground">
            Only trip members can set up days. Join this trip to add the itinerary.
          </p>
        </div>
      )}
      <div className="mb-6">
        <h2 className="text-2xl font-serif font-semibold text-foreground mb-1">
          Set up your days
        </h2>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? 'Add a city to each day, or skip it and name them later.'
            : 'Days have not been set up yet.'}
        </p>
      </div>

      {canEdit && needsCity && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <label
            htmlFor="setup-bulk-city"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Where are you going?
          </label>
          <div className="flex gap-2">
            <Input
              id="setup-bulk-city"
              placeholder="e.g. Tokyo"
              value={bulkCity}
              onChange={(e) => setBulkCity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyToAll()
                }
              }}
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              onClick={applyToAll}
              disabled={!bulkCity.trim()}
              className="shrink-0"
            >
              Apply to all
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Names every day at once — change any of them below.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {days.map((day, i) => (
          <div key={day.date} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              <span className="font-semibold text-foreground">Day {day.dayNumber}</span>
              {' '}—{' '}{day.formatted}
            </p>

            <div className="flex flex-wrap gap-2">
              {cityOptions.map((dest) => (
                <button
                  key={dest}
                  type="button"
                  onClick={() => canEdit && pickCity(i, dest)}
                  disabled={!canEdit}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all disabled:opacity-60 disabled:pointer-events-none ${
                    day.city === dest && !day.editing
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {dest}
                </button>
              ))}
              <button
                type="button"
                onClick={() => canEdit && toggleCustom(i)}
                disabled={!canEdit}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all disabled:opacity-60 disabled:pointer-events-none ${
                  day.editing
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-dashed border-border hover:border-primary/40'
                }`}
              >
                {cityOptions.length > 0 ? 'Other' : 'Add city'}
              </button>
            </div>

            {day.editing && (
              <Input
                className="mt-3"
                placeholder={cityOptions.length > 0 ? 'City name' : 'e.g. Rome, Paris'}
                value={day.city}
                onChange={(e) => updateDay(i, { city: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    updateDay(i, { city: day.city.trim(), editing: false })
                  }
                }}
                autoFocus
                disabled={!canEdit}
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}

      {canEdit && (
        <Button
          className="w-full mt-6"
          size="lg"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating days…
            </>
          ) : (
            `Create ${days.length} day${days.length !== 1 ? 's' : ''} →`
          )}
        </Button>
      )}
    </motion.div>
  )
}
