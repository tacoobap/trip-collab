import { useRef, useState } from 'react'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { uploadImage } from '@/lib/imageUpload'
import { searchImage } from '@/lib/imageSearch'
import { useImageDrop } from '@/hooks/useImageDrop'
import type { DroppedImage } from '@/lib/imageFromTransfer'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { CityTag } from '@/components/shared/CityTag'
import { ImagePasteBox } from '@/components/shared/ImagePasteBox'
import { CATEGORY_ICONS } from '@/lib/slotEmojis'
import { DAY_HEADER_PX, lockedProposalOf } from '@/lib/timeGrid'
import { Camera, Loader2, Upload, Sparkles, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimeGridDayHeaderProps {
  day: DayWithSlots
  tripId: string
  /** Slots with no time yet — shown as chips on the day's shelf. */
  untimed: SlotWithProposals[]
  getToken?: () => Promise<string | null>
  canEdit?: boolean
  onEditDay?: (day: DayWithSlots) => void
  onAddUntimed?: (title: string) => Promise<void>
  /** Chip currently being dragged out of a shelf — rendered faded. */
  liftedChipId?: string | null
  /** Chip a long press has lifted, ready to drag. Touch only. */
  armedChipId?: string | null
  /** True while a card drag hovers this shelf as its unschedule target. */
  shelfHighlighted?: boolean
}

function chipTitle(slot: SlotWithProposals): string {
  return lockedProposalOf(slot)?.title ?? slot.proposals[0]?.title ?? 'Open slot'
}

/**
 * Sticky column header: photo strip (fixed height so every day's timeline
 * starts level), day number + city + date, and the "sometime this day" shelf.
 */
export function TimeGridDayHeader({
  day,
  tripId,
  untimed,
  getToken,
  canEdit = true,
  onEditDay,
  onAddUntimed,
  liftedChipId,
  armedChipId,
  shelfHighlighted = false,
}: TimeGridDayHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [autoLoading, setAutoLoading] = useState(false)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const [addingChip, setAddingChip] = useState(false)
  const [chipTitleDraft, setChipTitleDraft] = useState('')
  const [savingChip, setSavingChip] = useState(false)

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
      const query = [day.city, ...eventTitles.slice(0, 4)].filter(Boolean).join(', ')

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

  const commitChip = async () => {
    const title = chipTitleDraft.trim()
    if (!title || !onAddUntimed || savingChip) {
      setAddingChip(false)
      setChipTitleDraft('')
      return
    }
    setSavingChip(true)
    try {
      await onAddUntimed(title)
      setChipTitleDraft('')
      setAddingChip(false)
    } finally {
      setSavingChip(false)
    }
  }

  const dateText = day.date
    ? new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div
      {...dropHandlers}
      className="sticky top-0 z-20 bg-background border-b border-border flex flex-col pt-2"
      style={{ height: DAY_HEADER_PX }}
    >
      {isDragging && (
        <div className="absolute -inset-1 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
          <span className="text-xs font-medium text-primary bg-background/90 rounded-full px-3 py-1">
            Drop photo for Day {day.day_number}
          </span>
        </div>
      )}

      {/* Photo strip — fixed height, placeholder when unset, so timelines align */}
      <div
        className={cn(
          'relative h-20 shrink-0 rounded-lg overflow-hidden',
          !day.image_url &&
            'border border-dashed border-border flex items-center justify-center'
        )}
      >
        {day.image_url ? (
          <img src={day.image_url} alt={day.label} className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-3.5 h-3.5 text-muted-foreground/30" aria-hidden />
        )}
        {imageWorking && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />

      <div className="flex items-center justify-between gap-2 mt-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-serif font-semibold text-base text-foreground leading-tight shrink-0">
            Day {day.day_number}
          </h3>
          {dateText && (
            <span className="text-[11px] text-muted-foreground truncate">{dateText}</span>
          )}
          {onEditDay && (
            <button
              type="button"
              data-grid-ignore
              onClick={() => onEditDay(day)}
              className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors touch-manipulation p-0.5 rounded"
              title="Edit day"
              aria-label="Edit day"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          {day.city && (
            <CityTag city={day.city} className="bg-muted/80 text-muted-foreground border-border" />
          )}
          {canEdit && (
            <div className="relative shrink-0">
              <button
                data-grid-ignore
                onClick={() => setPhotoMenuOpen((v) => !v)}
                disabled={imageWorking}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-40 touch-manipulation p-0.5"
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
                    data-grid-ignore
                    className="fixed inset-0 z-40"
                    onClick={() => setPhotoMenuOpen(false)}
                  />
                  <div
                    data-grid-ignore
                    className="absolute right-0 top-full mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden min-w-[200px]"
                  >
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>
                        Upload from computer
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          or drop one onto the day
                        </span>
                      </span>
                    </button>
                    <div className="px-4 py-2.5 border-t border-border">
                      <ImagePasteBox className="w-full" label="Paste an image here" />
                    </div>
                    <button
                      onClick={handleAutoImage}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors border-t border-border"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>
                        Let AI embarrass you
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          finds a photo for this day
                        </span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* "Sometime this day" shelf — drop target for unscheduling */}
      <div
        data-shelf={day.id}
        className={cn(
          'flex-1 min-h-0 mt-1 flex items-center gap-1.5 overflow-x-auto rounded-lg',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          shelfHighlighted &&
            'outline-dashed outline-1 outline-primary outline-offset-2 bg-primary/5'
        )}
      >
        {untimed.map((slot) => (
          <button
            key={slot.id}
            data-chip-id={slot.id}
            type="button"
            title={chipTitle(slot)}
            style={{ touchAction: 'pan-x pan-y' }}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/80',
              'pl-2 pr-2.5 py-1 text-[11px] font-medium text-foreground max-w-[190px] select-none',
              '[-webkit-touch-callout:none] transition-transform',
              canEdit ? 'cursor-grab' : 'cursor-pointer',
              armedChipId === slot.id && 'scale-110 ring-2 ring-primary/50 shadow-md',
              liftedChipId === slot.id && 'opacity-40'
            )}
          >
            <span className="leading-none">
              {slot.icon ?? CATEGORY_ICONS[slot.category] ?? '📌'}
            </span>
            <span className="truncate">{chipTitle(slot)}</span>
          </button>
        ))}

        {canEdit && onAddUntimed && (
          addingChip ? (
            <input
              data-grid-ignore
              autoFocus
              value={chipTitleDraft}
              disabled={savingChip}
              onChange={(e) => setChipTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitChip()
                if (e.key === 'Escape') {
                  setAddingChip(false)
                  setChipTitleDraft('')
                }
              }}
              onBlur={() => void commitChip()}
              placeholder="e.g. browse the market"
              className="shrink-0 w-36 rounded-full border border-primary bg-card px-2.5 py-1 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50"
              aria-label="Add something for sometime this day"
            />
          ) : (
            <button
              data-grid-ignore
              type="button"
              onClick={() => setAddingChip(true)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1 rounded-full border border-dashed border-border',
                'px-2.5 py-1 text-[11px] text-muted-foreground/50 hover:text-primary hover:border-primary/50 transition-colors'
              )}
              title="Park something on this day without a time yet"
            >
              {untimed.length > 0 ? '＋' : '＋ sometime that day…'}
            </button>
          )
        )}
      </div>
    </div>
  )
}
