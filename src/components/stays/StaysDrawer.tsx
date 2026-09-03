import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BedDouble, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StayForm } from '@/components/stays/StayForm'
import { formatStayRange, stayAddress, stayNights } from '@/lib/stayDisplay'
import type { Stay, Trip } from '@/types/database'
import type { StayInput } from '@/services/staysService'

interface StayCardProps {
  stay: Stay
  onEdit?: () => void
  onDelete?: () => void
}

function StayCard({ stay, onEdit, onDelete }: StayCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{stay.city}</p>
          <h3 className="font-serif font-semibold text-foreground mt-0.5 leading-snug">
            {stay.name}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Edit stay"
              aria-label={`Edit ${stay.name}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              title="Delete stay"
              aria-label={`Delete ${stay.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
        <BedDouble className="w-3.5 h-3.5 shrink-0" />
        <span>{formatStayRange(stay.check_in, stay.check_out)}</span>
        <span className="text-border">·</span>
        <span>{stayNights(stay.check_in, stay.check_out)}</span>
      </div>

      {stay.google_maps_url && (
        <a
          href={stay.google_maps_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors mt-2 min-w-0"
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {stayAddress(stay) ?? 'Open in Google Maps'}
          </span>
        </a>
      )}
    </div>
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
  getToken?: () => Promise<string | null>
  canEdit?: boolean
}

export function StaysDrawer({
  open,
  onClose,
  trip,
  stays,
  currentName,
  onAdd,
  onUpdate,
  onDelete,
  getToken,
  canEdit = true,
}: StaysDrawerProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleAdd = async (data: StayInput) => {
    await onAdd(data)
    setShowForm(false)
  }

  const handleUpdate = async (stayId: string, data: StayInput) => {
    await onUpdate?.(stayId, data)
    setEditingId(null)
  }

  const handleDelete = (stay: Stay) => {
    if (!window.confirm(`Remove ${stay.name} from this trip?`)) return
    void onDelete(stay.id)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingId(null)
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null)
                      setShowForm(true)
                    }}
                  >
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
                <StayForm
                  trip={trip}
                  stay={null}
                  currentName={currentName}
                  getToken={getToken}
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

              {stays.map((stay) =>
                canEdit && onUpdate && editingId === stay.id ? (
                  <StayForm
                    key={stay.id}
                    trip={trip}
                    stay={stay}
                    currentName={currentName ?? ''}
                    getToken={getToken}
                    onSubmit={(data) => handleUpdate(stay.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <StayCard
                    key={stay.id}
                    stay={stay}
                    onEdit={
                      canEdit && onUpdate
                        ? () => {
                            setShowForm(false)
                            setEditingId(stay.id)
                          }
                        : undefined
                    }
                    onDelete={canEdit ? () => handleDelete(stay) : undefined}
                  />
                )
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
