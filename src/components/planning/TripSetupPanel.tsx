import { useState, useMemo } from 'react'
import { collection, writeBatch, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { motion } from 'framer-motion'
import { Loader2, CalendarDays } from 'lucide-react'
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
}

const DEFAULT_SLOTS = [
  { time_label: 'Morning', category: 'activity', sort_order: 0 },
  { time_label: 'Afternoon', category: 'activity', sort_order: 1 },
  { time_label: 'Evening', category: 'food', sort_order: 2 },
] as const

export function TripSetupPanel({ trip }: TripSetupPanelProps) {
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
      const batch = writeBatch(db)

      for (const day of resolved) {
        const dayRef = doc(collection(db, 'days'))
        batch.set(dayRef, {
          trip_id: trip.id,
          city: day.effectiveCity,
          label: `Day ${day.dayNumber} · ${day.effectiveCity}`,
          day_number: day.dayNumber,
          date: day.date,
        })

        for (const slot of DEFAULT_SLOTS) {
          const slotRef = doc(collection(db, 'slots'))
          batch.set(slotRef, {
            day_id: dayRef.id,
            trip_id: trip.id,
            time_label: slot.time_label,
            category: slot.category,
            status: 'open',
            locked_proposal_id: null,
            sort_order: slot.sort_order,
          })
        }
      }

      await batch.commit()
      // useTrip's onSnapshot will pick up the new days automatically
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // No date range set — fall back to a simple prompt
  if (!hasDates) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4">
          <CalendarDays className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-serif font-semibold text-foreground mb-2">
          No days yet
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          This trip doesn't have dates set. Edit the trip to add a date range, then come back here to set up the days.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-4 sm:px-6 py-12"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-serif font-semibold text-foreground mb-1">
          Set up your days
        </h2>
        <p className="text-sm text-muted-foreground">
          Assign a city to each day. You can always rearrange later.
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
                  onClick={() => setDayCity(i, dest)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
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
                onClick={() => setDayCity(i, '__custom__')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
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
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}

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
    </motion.div>
  )
}
