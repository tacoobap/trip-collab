import { useRef, useState } from 'react'
import { updateDoc, doc, addDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { uploadImage } from '@/lib/imageUpload'
import { searchImage } from '@/lib/imageSearch'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { SlotCard } from './SlotCard'
import { CityTag } from '@/components/shared/CityTag'
import { Camera, Loader2, Plus, Check, X, Upload, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseTimeToMinutes, formatTimeLabel } from '@/lib/timeUtils'


interface DayColumnProps {
  day: DayWithSlots
  tripId: string
  currentName: string
  onSlotClick: (slot: SlotWithProposals, dayLabel: string) => void
}

export function DayColumn({ day, tripId, currentName: _currentName, onSlotClick }: DayColumnProps) {
  const getDisplayTime = (slot: SlotWithProposals) => {
    const locked = slot.proposals.find((p) => p.id === slot.locked_proposal_id)
    return locked?.exact_time ?? locked?.narrative_time ?? slot.time_label
  }
  const sortedSlots = [...day.slots].sort((a, b) => {
    const ta = parseTimeToMinutes(getDisplayTime(a))
    const tb = parseTimeToMinutes(getDisplayTime(b))
    if (ta !== tb) return ta - tb
    return a.sort_order - b.sort_order
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [autoLoading, setAutoLoading] = useState(false)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)

  const [addingSlot, setAddingSlot] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [savingSlot, setSavingSlot] = useState(false)
  const [addSlotError, setAddSlotError] = useState<string | null>(null)

  const imageWorking = uploading || autoLoading

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoMenuOpen(false)
    setUploading(true)
    setUploadPct(0)
    try {
      const url = await uploadImage(
        `trips/${tripId}/days/${day.id}.jpg`,
        file,
        setUploadPct
      )
      await updateDoc(doc(db, 'days', day.id), { image_url: url })
    } catch (err) {
      console.error('Image upload failed', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAutoImage = async () => {
    setPhotoMenuOpen(false)
    setAutoLoading(true)
    try {
      // Build a query from actual events: prefer locked titles, then all proposal titles
      const eventTitles = day.slots.flatMap((s) => {
        const locked = s.proposals.find((p) => p.id === s.locked_proposal_id)
        if (locked) return [locked.title]
        return s.proposals.map((p) => p.title)
      })
      const query = [
        day.city,
        ...eventTitles.slice(0, 4),
      ].filter(Boolean).join(', ')

      const img = await searchImage(query)
      await updateDoc(doc(db, 'days', day.id), {
        image_url: img.url,
        image_attribution: img.attribution,
      })
    } catch {
      try {
        const img = await searchImage([day.city, day.label].filter(Boolean).join(' '))
        await updateDoc(doc(db, 'days', day.id), {
          image_url: img.url,
          image_attribution: img.attribution,
        })
      } catch (err) {
        console.error('Could not find image for day', err)
      }
    } finally {
      setAutoLoading(false)
    }
  }

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newLabel.trim()
    if (!trimmed) return
    const formatted = formatTimeLabel(trimmed)
    if (!formatted) {
      setAddSlotError('Enter a time like 9:00 AM or 2:30 PM')
      return
    }
    setAddSlotError(null)
    setSavingSlot(true)
    try {
      await addDoc(collection(db, 'slots'), {
        day_id: day.id,
        time_label: formatted,
        category: 'activity',
        icon: null,
        status: 'open',
        locked_proposal_id: null,
        sort_order: day.slots.length,
      })
      setNewLabel('')
      setAddingSlot(false)
    } finally {
      setSavingSlot(false)
    }
  }

  const cancelAddSlot = () => {
    setAddingSlot(false)
    setNewLabel('')
    setAddSlotError(null)
  }

  return (
    <div className="flex flex-col w-[240px] min-w-[240px] sm:w-[260px] sm:min-w-[260px] flex-shrink-0">
      {/* Day image thumbnail */}
      <div
        className="relative mb-4 rounded-lg overflow-hidden"
        style={{ height: day.image_url ? 100 : 0 }}
      >
        {day.image_url && (
          <>
            <img
              src={day.image_url}
              alt={day.label}
              className="w-full h-full object-cover"
            />
            {imageWorking && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />

      <div className="pb-4 mb-4 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif font-semibold text-base text-foreground leading-tight">
            Day {day.day_number}
          </h3>
          <div className="flex items-center gap-1.5">
            {day.city && (
              <CityTag city={day.city} className="bg-muted/80 text-muted-foreground border-border" />
            )}
            {/* Camera button + popover menu */}
            <div className="relative">
              <button
                onClick={() => setPhotoMenuOpen((v) => !v)}
                disabled={imageWorking}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-40"
                title={day.image_url ? 'Change day photo' : 'Add day photo'}
              >
                {uploading ? (
                  <span className="text-[10px] font-medium">{uploadPct}%</span>
                ) : autoLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Camera className="w-3 h-3" />
                )}
              </button>

              {photoMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setPhotoMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden min-w-[200px]">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      Upload from computer
                    </button>
                    <button
                      onClick={handleAutoImage}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors border-t border-border"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>
                        Let AI embarrass you
                        <span className="block text-[11px] text-muted-foreground font-normal">finds a photo for this day</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {day.date && (
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {sortedSlots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            onClick={() => onSlotClick(slot, `Day ${day.day_number}`)}
          />
        ))}

        {/* Add slot */}
        {addingSlot ? (
          <form
            onSubmit={handleAddSlot}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2 border border-dashed border-primary/40 rounded-lg px-3 py-2.5 bg-primary/5">
              <input
                autoFocus
                placeholder="e.g. 9:00 AM or 2:30 PM"
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value)
                  if (addSlotError) setAddSlotError(null)
                }}
                className={cn(
                  'flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0',
                  addSlotError && 'placeholder:text-destructive/70'
                )}
                aria-invalid={!!addSlotError}
                aria-describedby={addSlotError ? 'add-slot-error' : undefined}
              />
            <button
              type="submit"
              disabled={!newLabel.trim() || savingSlot}
              className={cn(
                'w-6 h-6 flex items-center justify-center rounded transition-colors shrink-0',
                newLabel.trim()
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground/30 cursor-not-allowed'
              )}
            >
              {savingSlot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={cancelAddSlot}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
            </div>
            {addSlotError && (
              <p id="add-slot-error" className="text-xs text-destructive px-1">
                {addSlotError}
              </p>
            )}
          </form>
        ) : (
          <button
            onClick={() => setAddingSlot(true)}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground/50 hover:text-muted-foreground border border-border/40 hover:border-border/70 rounded-lg py-3 transition-all"
          >
            <Plus className="w-3 h-3" />
            Add slot
          </button>
        )}
      </div>
    </div>
  )
}
