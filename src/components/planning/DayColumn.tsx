import { useRef, useState } from 'react'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { addSlot, addLockedSlot } from '@/services/planningService'
import { uploadImage } from '@/lib/imageUpload'
import { searchImage } from '@/lib/imageSearch'
import { useImageDrop } from '@/hooks/useImageDrop'
import type { DroppedImage } from '@/lib/imageFromTransfer'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { SlotCard } from './SlotCard'
import { CityTag } from '@/components/shared/CityTag'
import { Camera, Loader2, Plus, Check, X, Upload, Sparkles, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseTimeToMinutes, formatTimeLabel } from '@/lib/timeUtils'


interface DayColumnProps {
  day: DayWithSlots
  tripId: string
  currentName: string
  onSlotClick: (slot: SlotWithProposals, dayLabel: string) => void
  getToken?: () => Promise<string | null>
  canEdit?: boolean
  onEditDay?: (day: DayWithSlots) => void
}

export function DayColumn({ day, tripId, currentName, onSlotClick, getToken, canEdit = true, onEditDay }: DayColumnProps) {
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
  const [newTitle, setNewTitle] = useState('')
  const timeInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [savingSlot, setSavingSlot] = useState(false)
  const [addSlotError, setAddSlotError] = useState<string | null>(null)

  const imageWorking = uploading || autoLoading

  const applyImage = async (image: DroppedImage) => {
    setPhotoMenuOpen(false)
    setUploading(true)
    setUploadPct(0)
    try {
      const url =
        image.kind === 'file'
          ? await uploadImage(
              `trips/${tripId}/days/${day.id}.jpg`,
              image.file,
              setUploadPct,
              getToken
            )
          : image.url
      // The photo is the user's now, so any Unsplash credit no longer applies
      await updateDoc(doc(db, 'days', day.id), { image_url: url, image_attribution: null })
    } catch (err) {
      console.error('Image upload failed', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void applyImage({ kind: 'file', file })
  }

  const { isDragging, dropHandlers } = useImageDrop({
    onImage: applyImage,
    disabled: !canEdit || imageWorking,
    // Scope ⌘V to the day whose photo menu is open, so a paste has one target
    pasteOnWindow: photoMenuOpen,
  })

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

      const img = await searchImage(query, getToken)
      await updateDoc(doc(db, 'days', day.id), {
        image_url: img.url,
        image_attribution: img.attribution,
      })
    } catch {
      try {
        const img = await searchImage([day.city, day.label].filter(Boolean).join(' '), getToken)
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
    const title = newTitle.trim()
    try {
      if (title) {
        // Already-decided itinerary: skip the propose/vote/lock cycle entirely
        await addLockedSlot({
          day_id: day.id,
          trip_id: tripId,
          time_label: formatted,
          sort_order: day.slots.length,
          proposer_name: currentName,
          title,
        })
      } else {
        await addSlot({
          day_id: day.id,
          trip_id: tripId,
          time_label: formatted,
          sort_order: day.slots.length,
        })
      }
      // Stay open and refocus so a whole day can be typed without reaching for the mouse
      setNewLabel('')
      setNewTitle('')
      timeInputRef.current?.focus()
    } finally {
      setSavingSlot(false)
    }
  }

  const cancelAddSlot = () => {
    setAddingSlot(false)
    setNewLabel('')
    setNewTitle('')
    setAddSlotError(null)
  }

  return (
    <div
      {...dropHandlers}
      className="relative flex flex-col w-[calc(100vw-2.5rem)] min-w-[260px] sm:w-[260px] sm:min-w-[260px] flex-shrink-0 max-sm:shrink-0"
    >
      {isDragging && (
        <div className="absolute -inset-2 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
          <span className="text-xs font-medium text-primary bg-background/90 rounded-full px-3 py-1">
            Drop photo for Day {day.day_number}
          </span>
        </div>
      )}

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
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-serif font-semibold text-base text-foreground leading-tight shrink-0">
              Day {day.day_number}
            </h3>
            {onEditDay && (
              <button
                type="button"
                onClick={() => onEditDay(day)}
                className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors touch-manipulation p-0.5 rounded"
                title="Edit day"
                aria-label="Edit day"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {day.city && (
              <CityTag city={day.city} className="bg-muted/80 text-muted-foreground border-border" />
            )}
            {/* Camera button + popover menu — only for members */}
            {canEdit && (
            <div className="relative">
              <button
                onClick={() => setPhotoMenuOpen((v) => !v)}
                disabled={imageWorking}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-40 touch-manipulation max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:flex max-sm:items-center max-sm:justify-center max-sm:-m-1"
                title={day.image_url ? 'Change day photo' : 'Add day photo'}
                aria-label={day.image_url ? 'Change day photo' : 'Add day photo'}
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
                      <span>
                        Upload from computer
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          or drop a photo here, or paste one
                        </span>
                      </span>
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
            )}
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

        {/* Add slot — only for members */}
        {canEdit && (addingSlot ? (
          <form
            onSubmit={handleAddSlot}
            className="flex flex-col gap-1.5"
          >
            <div className="flex flex-col gap-1.5 border border-dashed border-primary/40 rounded-lg px-3 py-2.5 bg-primary/5">
              <input
                ref={timeInputRef}
                autoFocus
                placeholder="e.g. 9:00 AM or 2:30 PM"
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value)
                  if (addSlotError) setAddSlotError(null)
                }}
                onKeyDown={(e) => {
                  // Enter moves to the title rather than submitting, so the fast
                  // path is: time → Enter → what → Enter → next slot
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    titleInputRef.current?.focus()
                  }
                  if (e.key === 'Escape') cancelAddSlot()
                }}
                className={cn(
                  'w-full text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0',
                  addSlotError && 'placeholder:text-destructive/70'
                )}
                aria-label="Time"
                aria-invalid={!!addSlotError}
                aria-describedby={addSlotError ? 'add-slot-error' : undefined}
              />

              <div className="flex items-center gap-2 border-t border-primary/15 pt-1.5">
                <input
                  ref={titleInputRef}
                  placeholder="What's planned? (optional)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') cancelAddSlot() }}
                  className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0"
                  aria-label="What's planned (optional)"
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
                  title={newTitle.trim() ? 'Add and lock it in' : 'Add an empty slot'}
                >
                  {savingSlot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={cancelAddSlot}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  title="Done adding"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            {addSlotError ? (
              <p id="add-slot-error" className="text-xs text-destructive px-1">
                {addSlotError}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/60 px-1">
                {newTitle.trim()
                  ? 'Saves locked in — keeps going for the next one'
                  : 'Add a title to lock it in, or leave blank for an open slot'}
              </p>
            )}
          </form>
        ) : (
          <button
            onClick={() => setAddingSlot(true)}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground/50 hover:text-muted-foreground border border-border/40 hover:border-border/70 rounded-lg py-3 transition-all touch-manipulation max-sm:min-h-[48px]"
          >
            <Plus className="w-3 h-3" />
            Add slot
          </button>
        ))}
      </div>
    </div>
  )
}
