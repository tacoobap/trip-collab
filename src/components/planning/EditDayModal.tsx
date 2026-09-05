import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { DayWithSlots } from '@/types/database'
import type { Trip } from '@/types/database'
import { updateDay } from '@/services/planningService'
import { dayLabel } from '@/lib/dateRange'

interface EditDayModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  day: DayWithSlots | null
  trip: Trip
  onSaved?: () => void
}

/**
 * Which city a day is spent in — the one thing about a day that is a choice
 * rather than a consequence. A day's *date* is its identity: it comes from the
 * trip's range, `day_number` is derived from date order, and moving one day's
 * date only shuffles it in the sequence (or strands it outside the range for
 * the next `syncTripDays` to reconcile). Dates are edited as a range in the
 * trip editor; days are added in `AddDayDialog`.
 */
export function EditDayModal({
  open,
  onOpenChange,
  day,
  trip,
  onSaved,
}: EditDayModalProps) {
  const [city, setCity] = useState('')
  const [customCity, setCustomCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && day) {
      setCity((day.city || trip.destinations?.[0]) ?? '')
      setCustomCity('')
      setError('')
    }
  }, [open, day?.id, day?.city, trip.destinations])

  if (!day) return null

  const effectiveCity = city === '__custom__' ? customCity.trim() : city

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveCity) {
      setError('City is required.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await updateDay(day.id, {
        label: dayLabel(day.day_number, effectiveCity),
        city: effectiveCity,
      })
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Which city on day {day.day_number}?
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {trip.destinations?.length ? (
            <>
              <div className="flex flex-wrap gap-2">
                {trip.destinations.map((dest) => (
                  <button
                    key={dest}
                    type="button"
                    onClick={() => setCity(dest)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      city === dest
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:border-primary/40'
                    }`}
                  >
                    {dest}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCity('__custom__')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    city === '__custom__'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-dashed border-border hover:border-primary/40'
                  }`}
                >
                  Other
                </button>
              </div>
              {city === '__custom__' && (
                <Input
                  placeholder="City name"
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  autoFocus
                />
              )}
            </>
          ) : (
            <Input
              placeholder="e.g. Paris"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoFocus
            />
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
              disabled={!effectiveCity || loading}
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
