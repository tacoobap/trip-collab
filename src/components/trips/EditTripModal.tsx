import { useState, useEffect, useRef } from 'react'
import { MapPin, Plus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Trip } from '@/types/database'
import { updateTripMeta } from '@/services/tripService'

interface EditTripModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: Trip
  onSaved?: () => void
}

export function EditTripModal({
  open,
  onOpenChange,
  trip,
  onSaved,
}: EditTripModalProps) {
  const [name, setName] = useState(trip.name)
  const [destination, setDestination] = useState('')
  const [destinations, setDestinations] = useState<string[]>(trip.destinations ?? [])
  const [startDate, setStartDate] = useState(trip.start_date ?? '')
  const [endDate, setEndDate] = useState(trip.end_date ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endDateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(trip.name)
      setDestinations(trip.destinations ?? [])
      setStartDate(trip.start_date ?? '')
      setEndDate(trip.end_date ?? '')
      setDestination('')
      setError('')
    }
  }, [open, trip.id, trip.name, trip.destinations, trip.start_date, trip.end_date])

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
      <DialogContent className="max-w-md">
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
