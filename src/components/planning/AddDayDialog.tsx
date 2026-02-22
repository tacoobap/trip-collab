import { useState } from 'react'
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface SlotPreset {
  time_label: string
  category: 'food' | 'activity' | 'travel' | 'accommodation' | 'vibe'
  enabled: boolean
}

const DEFAULT_PRESETS: SlotPreset[] = [
  { time_label: 'Morning', category: 'activity', enabled: true },
  { time_label: 'Afternoon', category: 'activity', enabled: true },
  { time_label: 'Evening', category: 'food', enabled: true },
]

const CATEGORY_OPTIONS = [
  { value: 'activity', label: '🎭 Activity' },
  { value: 'food', label: '🍽 Food' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'accommodation', label: '🏨 Stay' },
  { value: 'vibe', label: '✨ Vibe' },
] as const

interface AddDayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId: string
  nextDayNumber: number
}

export function AddDayDialog({ open, onOpenChange, tripId, nextDayNumber }: AddDayDialogProps) {
  const [city, setCity] = useState('')
  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')
  const [presets, setPresets] = useState<SlotPreset[]>(DEFAULT_PRESETS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const autoLabel = city.trim()
    ? `Day ${nextDayNumber} · ${city.trim()}`
    : `Day ${nextDayNumber}`

  const togglePreset = (index: number) => {
    setPresets((prev) =>
      prev.map((p, i) => (i === index ? { ...p, enabled: !p.enabled } : p))
    )
  }

  const updatePresetCategory = (
    index: number,
    category: SlotPreset['category']
  ) => {
    setPresets((prev) =>
      prev.map((p, i) => (i === index ? { ...p, category } : p))
    )
  }

  const handleClose = () => {
    setCity('')
    setDate('')
    setLabel('')
    setPresets(DEFAULT_PRESETS)
    setError('')
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!city.trim()) {
      setError('City is required.')
      return
    }
    const enabledPresets = presets.filter((p) => p.enabled)
    if (enabledPresets.length === 0) {
      setError('Add at least one slot.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const finalLabel = label.trim() || autoLabel
      const dayRef = await addDoc(collection(db, 'days'), {
        trip_id: tripId,
        city: city.trim(),
        label: finalLabel,
        day_number: nextDayNumber,
        date: date || null,
      })

      const batch = writeBatch(db)
      enabledPresets.forEach((preset, i) => {
        const slotRef = doc(collection(db, 'slots'))
        batch.set(slotRef, {
          day_id: dayRef.id,
          time_label: preset.time_label,
          category: preset.category,
          status: 'open',
          locked_proposal_id: null,
          sort_order: i,
        })
      })
      await batch.commit()

      handleClose()
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Add Day {nextDayNumber}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              City <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Paris"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Date <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Label
            </label>
            <Input
              placeholder={autoLabel}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to use "{autoLabel}"
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Slots</p>
            <div className="space-y-2">
              {presets.map((preset, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                >
                  <button
                    type="button"
                    onClick={() => togglePreset(i)}
                    className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      preset.enabled
                        ? 'bg-primary border-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    {preset.enabled && (
                      <svg
                        viewBox="0 0 12 12"
                        className="w-3 h-3 text-primary-foreground"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="1,6 4,9 11,2" />
                      </svg>
                    )}
                  </button>

                  <span className="text-sm text-foreground w-24 shrink-0">
                    {preset.time_label}
                  </span>

                  <select
                    disabled={!preset.enabled}
                    value={preset.category}
                    onChange={(e) =>
                      updatePresetCategory(i, e.target.value as SlotPreset['category'])
                    }
                    className="flex-1 text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
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
            <Button type="submit" className="flex-1" disabled={loading || !city.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Adding…
                </>
              ) : (
                'Add day'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
