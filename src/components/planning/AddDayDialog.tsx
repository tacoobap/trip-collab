import { useState, useMemo } from 'react'
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2 } from 'lucide-react'
import type { Trip, Day } from '@/types/database'
import { SlotIconPicker, CATEGORY_ICONS } from './SlotIconPicker'

interface SlotPreset {
  time_label: string
  category: 'food' | 'activity' | 'travel' | 'accommodation' | 'vibe'
  icon: string | null
  enabled: boolean
}

const DEFAULT_PRESETS: SlotPreset[] = [
  { time_label: 'Morning', category: 'activity', icon: null, enabled: true },
  { time_label: 'Afternoon', category: 'activity', icon: null, enabled: true },
  { time_label: 'Evening', category: 'food', icon: null, enabled: true },
]

const CATEGORY_OPTIONS = [
  { value: 'activity', label: '🎭 Activity' },
  { value: 'food', label: '🍽 Food' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'accommodation', label: '🏨 Stay' },
  { value: 'vibe', label: '✨ Vibe' },
] as const

type DateOption = {
  date: string
  dayNumber: number
  formatted: string
}

interface AddDayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: Trip
  existingDays: Day[]
}

export function AddDayDialog({ open, onOpenChange, trip, existingDays }: AddDayDialogProps) {
  const [selectedDate, setSelectedDate] = useState('')
  const [city, setCity] = useState(trip.destinations[0] ?? '')
  const [customCity, setCustomCity] = useState('')
  const [presets, setPresets] = useState<SlotPreset[]>(DEFAULT_PRESETS)
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Build the full date range from the trip's start/end dates
  const dateRange = useMemo<DateOption[]>(() => {
    if (!trip.start_date || !trip.end_date) return []
    const options: DateOption[] = []
    const current = new Date(trip.start_date + 'T00:00:00')
    const end = new Date(trip.end_date + 'T00:00:00')
    let dayNum = 1
    while (current <= end) {
      options.push({
        date: current.toISOString().split('T')[0],
        dayNumber: dayNum,
        formatted: current.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
      })
      current.setDate(current.getDate() + 1)
      dayNum++
    }
    return options
  }, [trip.start_date, trip.end_date])

  // Filter out dates that already have a day added
  const availableDates = useMemo(() => {
    const addedDates = new Set(existingDays.map((d) => d.date).filter(Boolean))
    return dateRange.filter((d) => !addedDates.has(d.date))
  }, [dateRange, existingDays])

  const hasDates = dateRange.length > 0
  const allDatesAdded = hasDates && availableDates.length === 0

  const selectedDateOption = dateRange.find((d) => d.date === selectedDate)
  const nextDayNumber = existingDays.length + 1

  // Derived values
  const effectiveDayNumber = selectedDateOption?.dayNumber ?? nextDayNumber
  const effectiveCity = city === '__custom__' ? customCity.trim() : city
  const autoLabel = effectiveCity
    ? `Day ${effectiveDayNumber} · ${effectiveCity}`
    : `Day ${effectiveDayNumber}`

  const togglePreset = (index: number) =>
    setPresets((prev) => prev.map((p, i) => (i === index ? { ...p, enabled: !p.enabled } : p)))

  const updatePresetCategory = (index: number, category: SlotPreset['category']) =>
    setPresets((prev) => prev.map((p, i) => (i === index ? { ...p, category } : p)))

  const updatePresetIcon = (index: number, icon: string) =>
    setPresets((prev) => prev.map((p, i) => (i === index ? { ...p, icon } : p)))

  const updatePresetLabel = (index: number, time_label: string) =>
    setPresets((prev) => prev.map((p, i) => (i === index ? { ...p, time_label } : p)))

  const handleClose = () => {
    setSelectedDate('')
    setCity(trip.destinations[0] ?? '')
    setCustomCity('')
    setPresets(DEFAULT_PRESETS)
    setOpenPickerIndex(null)
    setError('')
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveCity) { setError('City is required.'); return }
    if (hasDates && !selectedDate) { setError('Select a day.'); return }
    const enabledPresets = presets.filter((p) => p.enabled)
    if (enabledPresets.length === 0) { setError('Add at least one slot.'); return }

    setLoading(true)
    setError('')
    try {
      const dayRef = await addDoc(collection(db, 'days'), {
        trip_id: trip.id,
        city: effectiveCity,
        label: autoLabel,
        day_number: effectiveDayNumber,
        date: selectedDate || null,
      })

      const batch = writeBatch(db)
      enabledPresets.forEach((preset, i) => {
        const slotRef = doc(collection(db, 'slots'))
        batch.set(slotRef, {
          day_id: dayRef.id,
          time_label: preset.time_label,
          category: preset.category,
          icon: preset.icon ?? null,
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
          <DialogTitle className="font-serif">Add a day</DialogTitle>
        </DialogHeader>

        {allDatesAdded ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-sage" />
            <p className="text-sm font-medium text-foreground">All days have been added!</p>
            <p className="text-xs text-muted-foreground">
              Every date in the trip's range already has a day.
            </p>
            <Button variant="outline" className="mt-2" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">

            {/* Day selector — shown only when trip has a date range */}
            {hasDates && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Day <span className="text-destructive">*</span>
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground"
                  autoFocus
                >
                  <option value="" disabled>Select a day…</option>
                  {availableDates.map((d) => (
                    <option key={d.date} value={d.date}>
                      Day {d.dayNumber} — {d.formatted}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* City selector */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                City <span className="text-destructive">*</span>
              </label>

              {trip.destinations.length > 0 ? (
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
                      className="mt-2"
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
                  autoFocus={!hasDates}
                />
              )}
            </div>

            {/* Label preview */}
            {effectiveCity && (
              <p className="text-xs text-muted-foreground -mt-1">
                Label: <span className="font-medium text-foreground">{autoLabel}</span>
              </p>
            )}

            {/* Slots */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Slots</p>
              <div className="space-y-2">
                {presets.map((preset, i) => (
                  <div key={i} className="flex items-center gap-3">
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
                    <input
                      type="text"
                      value={preset.time_label}
                      onChange={(e) => updatePresetLabel(i, e.target.value)}
                      disabled={!preset.enabled}
                      placeholder="e.g. 9:00 AM"
                      className="text-sm text-foreground w-24 shrink-0 bg-transparent border-b border-border focus:border-primary outline-none placeholder:text-muted-foreground/40 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    {/* Emoji picker trigger */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        disabled={!preset.enabled}
                        onClick={() => setOpenPickerIndex(openPickerIndex === i ? null : i)}
                        className="text-lg leading-none w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors disabled:opacity-40"
                        title="Choose icon"
                      >
                        {preset.icon ?? CATEGORY_ICONS[preset.category] ?? '📌'}
                      </button>
                      <SlotIconPicker
                        open={openPickerIndex === i}
                        current={preset.icon ?? CATEGORY_ICONS[preset.category] ?? '📌'}
                        onSelect={(emoji) => updatePresetIcon(i, emoji)}
                        onClose={() => setOpenPickerIndex(null)}
                      />
                    </div>
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
              <Button
                type="submit"
                className="flex-1"
                disabled={
                  loading ||
                  !effectiveCity ||
                  (hasDates && !selectedDate)
                }
              >
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
        )}
      </DialogContent>
    </Dialog>
  )
}
