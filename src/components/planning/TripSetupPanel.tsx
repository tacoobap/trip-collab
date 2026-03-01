import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createDaysWithDefaultSlots } from '@/services/planningService'
import { Loader2, CalendarDays, Plus, Pencil } from 'lucide-react'
import { AddDayDialog } from './AddDayDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Trip } from '@/types/database'

interface DaySetup {
  date: string
  dayNumber: number
  formatted: string
  city: string
  customCity: string
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
    const rows: DaySetup[] = []
    const current = new Date(trip.start_date + 'T00:00:00')
    const end = new Date(trip.end_date + 'T00:00:00')
    let dayNum = 1
    while (current <= end) {
      rows.push({
        date: current.toISOString().split('T')[0],
        dayNumber: dayNum,
        formatted: current.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        city: trip.destinations[0] ?? '',
        customCity: '',
      })
      current.setDate(current.getDate() + 1)
      dayNum++
    }
    return rows
  }, [trip])

  const [days, setDays] = useState<DaySetup[]>(initialDays)
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

  const setDayCity = (index: number, city: string) =>
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, city, customCity: '' } : d)))

  const setDayCustomCity = (index: number, customCity: string) =>
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, customCity } : d)))

  const handleCreate = async () => {
    const resolved = days.map((d) => ({
      ...d,
      effectiveCity: d.city === '__custom__' ? d.customCity.trim() : d.city,
    }))

    if (resolved.some((d) => !d.effectiveCity)) {
      setError('Assign a city to every day before continuing.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await createDaysWithDefaultSlots(
        trip.id,
        resolved.map((d) => ({
          date: d.date,
          dayNumber: d.dayNumber,
          city: d.effectiveCity,
        }))
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
      <div className="mb-8">
        <h2 className="text-2xl font-serif font-semibold text-foreground mb-1">
          Set up your days
        </h2>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? 'Assign a city to each day. You can always rearrange later.'
            : 'Days have not been set up yet.'}
        </p>
      </div>

      <div className="space-y-4">
        {days.map((day, i) => (
          <div key={day.date} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              <span className="font-semibold text-foreground">Day {day.dayNumber}</span>
              {' '}—{' '}{day.formatted}
            </p>

            <div className="flex flex-wrap gap-2">
              {trip.destinations.map((dest) => (
                <button
                  key={dest}
                  type="button"
                  onClick={() => canEdit && setDayCity(i, dest)}
                  disabled={!canEdit}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all disabled:opacity-60 disabled:pointer-events-none ${
                    day.city === dest
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {dest}
                </button>
              ))}
              <button
                type="button"
                onClick={() => canEdit && setDayCity(i, '__custom__')}
                disabled={!canEdit}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all disabled:opacity-60 disabled:pointer-events-none ${
                  day.city === '__custom__'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-dashed border-border hover:border-primary/40'
                }`}
              >
                Other
              </button>
            </div>

            {day.city === '__custom__' && (
              <Input
                className="mt-3"
                placeholder="City name"
                value={day.customCity}
                onChange={(e) => setDayCustomCity(i, e.target.value)}
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
