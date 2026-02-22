import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Plus, Loader2 } from 'lucide-react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

interface NewTripDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewTripDialog({ open, onOpenChange }: NewTripDialogProps) {
  const navigate = useNavigate()
  const [tripName, setTripName] = useState('')
  const [destination, setDestination] = useState('')
  const [destinations, setDestinations] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setTripName('')
    setDestination('')
    setDestinations([])
    setStartDate('')
    setEndDate('')
    setError('')
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const addDestination = () => {
    const trimmed = destination.trim()
    if (trimmed && !destinations.includes(trimmed)) {
      setDestinations([...destinations, trimmed])
      setDestination('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tripName.trim()) return

    setLoading(true)
    setError('')

    const baseSlug = slugify(tripName)
    const slug = `${baseSlug}-${Date.now().toString(36)}`

    try {
      await addDoc(collection(db, 'trips'), {
        name: tripName.trim(),
        slug,
        destinations,
        start_date: startDate || null,
        end_date: endDate || null,
        created_at: serverTimestamp(),
      })
      handleClose()
      navigate(`/trip/${slug}`)
    } catch (err) {
      setError('Failed to create trip. Check your connection and try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Plan a new trip</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Trip name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Paris & London · May 2026"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
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
                placeholder="Add a city (e.g. Paris)"
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
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                End date
              </label>
              <Input
                type="date"
                value={endDate}
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
              disabled={!tripName.trim() || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create trip →'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
