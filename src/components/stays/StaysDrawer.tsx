import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BedDouble, Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'
import type { Stay, Trip } from '@/types/database'
import type { StayInput } from '@/services/staysService'
import { cn } from '@/lib/utils'

function formatDateRange(checkIn: string, checkOut: string) {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  return `${fmt(checkIn)} – ${fmt(checkOut)}`
}

function nightCount(checkIn: string, checkOut: string) {
  const diff =
    new Date(checkOut + 'T00:00:00').getTime() -
    new Date(checkIn + 'T00:00:00').getTime()
  const nights = Math.round(diff / 86_400_000)
  return `${nights} night${nights !== 1 ? 's' : ''}`
}

interface StayCardProps {
  stay: Stay
  currentName: string | null
  onDelete?: () => void
}

function StayCard({ stay, currentName, onDelete }: StayCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{stay.city}</p>
          <h3 className="font-serif font-semibold text-foreground mt-0.5 leading-snug">
            {stay.name}
          </h3>
        </div>
        {onDelete && stay.proposed_by === currentName && (
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
            title="Delete stay"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
        <BedDouble className="w-3.5 h-3.5 shrink-0" />
        <span>{formatDateRange(stay.check_in, stay.check_out)}</span>
        <span className="text-border">·</span>
        <span>{nightCount(stay.check_in, stay.check_out)}</span>
      </div>

      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
        <ProposerAvatar name={stay.proposed_by} size="xs" showName />
      </div>
    </div>
  )
}

interface AddStayFormProps {
  trip: Trip
  currentName: string
  onSubmit: (data: StayInput) => Promise<void>
  onCancel: () => void
}

function AddStayForm({ trip, currentName, onSubmit, onCancel }: AddStayFormProps) {
  const [name, setName] = useState('')
  const [city, setCity] = useState(trip.destinations[0] ?? '')
  const [customCity, setCustomCity] = useState('')
  const [checkIn, setCheckIn] = useState(trip.start_date ?? '')
  const [checkOut, setCheckOut] = useState(trip.end_date ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const effectiveCity = city === '__custom__' ? customCity.trim() : city

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    if (!effectiveCity) { setError('City is required.'); return }
    if (!checkIn || !checkOut) { setError('Check-in and check-out are required.'); return }
    if (checkOut <= checkIn) { setError('Check-out must be after check-in.'); return }

    setLoading(true)
    setError('')
    try {
      await onSubmit({
        name: name.trim(),
        city: effectiveCity,
        check_in: checkIn,
        check_out: checkOut,
        proposed_by: currentName,
      })
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-muted/40 rounded-xl border border-border">
      <p className="text-sm font-semibold text-foreground">Add a stay</p>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Property name <span className="text-destructive">*</span>
        </label>
        <Input
          placeholder="e.g. Le Marais Airbnb, Hôtel du Nord"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="text-sm"
        />
      </div>

      {trip.destinations.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">City</label>
          <div className="flex flex-wrap gap-2">
            {trip.destinations.map((dest) => (
              <button
                key={dest}
                type="button"
                onClick={() => setCity(dest)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                  city === dest
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:border-primary/40'
                )}
              >
                {dest}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCity('__custom__')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                city === '__custom__'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-dashed border-border hover:border-primary/40'
              )}
            >
              Other
            </button>
          </div>
          {city === '__custom__' && (
            <Input
              className="mt-2 text-sm"
              placeholder="City name"
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Check-in <span className="text-destructive">*</span>
          </label>
          <Input
            type="date"
            value={checkIn}
            min={trip.start_date ?? undefined}
            max={trip.end_date ?? undefined}
            onChange={(e) => setCheckIn(e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Check-out <span className="text-destructive">*</span>
          </label>
          <Input
            type="date"
            value={checkOut}
            min={trip.start_date ?? undefined}
            max={trip.end_date ?? undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="flex-1" disabled={loading || !name.trim()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add stay'}
        </Button>
      </div>
    </form>
  )
}

interface StaysDrawerProps {
  open: boolean
  onClose: () => void
  trip: Trip
  stays: Stay[]
  currentName: string | null
  onAdd: (data: StayInput) => Promise<void>
  onUpdate?: (stayId: string, data: Partial<StayInput>) => Promise<void>
  onDelete: (stayId: string) => Promise<void>
  canEdit?: boolean
}

export function StaysDrawer({
  open,
  onClose,
  trip,
  stays,
  currentName,
  onAdd,
  onDelete,
  canEdit = true,
}: StaysDrawerProps) {
  const [showForm, setShowForm] = useState(false)

  const handleAdd = async (data: StayInput) => {
    await onAdd(data)
    setShowForm(false)
  }

  const handleClose = () => {
    setShowForm(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={handleClose}
          />

          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl border-t border-border shadow-2xl max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-serif font-semibold text-foreground">Stays</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stays.length === 0
                    ? 'No stays added yet'
                    : `${stays.length} stay${stays.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !showForm && currentName && (
                  <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add stay
                  </Button>
                )}
                <button
                  onClick={handleClose}
                  className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {canEdit && showForm && currentName && (
                <AddStayForm
                  trip={trip}
                  currentName={currentName}
                  onSubmit={handleAdd}
                  onCancel={() => setShowForm(false)}
                />
              )}

              {stays.length === 0 && !showForm && (
                <div className="text-center py-10">
                  <BedDouble className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No stays added yet.</p>
                </div>
              )}

              {stays.map((stay) => (
                <StayCard
                  key={stay.id}
                  stay={stay}
                  currentName={currentName}
                  onDelete={canEdit ? () => void onDelete(stay.id) : undefined}
                />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
