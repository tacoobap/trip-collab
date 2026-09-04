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

  const hasPhoto = Boolean(day.image_url)
  /** White-on-image treatment. An empty day has no scrim to read against. */
  const onPhoto = hasPhoto

  return (
    <div
      {...dropHandlers}
      // The whole header is the unschedule target now that parked ideas float
      // on the photo instead of occupying a row of their own. `data-shelf` is
      // what TimeGridBoard hit-tests, one per column, in column order.
      data-shelf={day.id}
      className={cn(
        'sticky top-0 z-20 bg-background border-b border-border',
        shelfHighlighted && 'ring-2 ring-inset ring-primary/60'
      )}
      style={{ height: DAY_HEADER_PX }}
    >
      {isDragging && (
        <div className="absolute -inset-1 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
          <span className="text-xs font-medium text-primary bg-background/90 rounded-full px-3 py-1">
            Drop photo for Day {day.day_number}
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />

      {/* The photo is the header: it fills the column and carries the day label
          on a scrim, so a photo, a label row and a shelf row stop being three
          stacked things. Costs 44px a column against the old layout while
          leaving the photo itself taller than it was. */}
      <div
        className={cn(
          'relative w-full h-full overflow-hidden rounded-lg',
          !hasPhoto && 'border border-dashed border-border bg-muted/40'
        )}
      >
        {hasPhoto ? (
          <img
            src={day.image_url ?? undefined}
            alt={day.label}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <Camera
            className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30"
            aria-hidden
          />
        )}
        {imageWorking && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          </div>
        )}

        {/* "Sometime this day" — chips float along the top of the photo. They
            carry their own background so they read over any image. */}
        <div
          className={cn(
            'absolute inset-x-1 top-1 z-10 flex items-center gap-1.5 overflow-x-auto',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
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
                'shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border/60',
                'bg-background/90 backdrop-blur-sm shadow-sm',
                'pl-2 pr-2.5 py-1.5 text-[11px] font-medium text-foreground max-w-[190px] select-none',
                '[-webkit-touch-callout:none] transition-transform',
                canEdit ? 'cursor-grab' : 'cursor-pointer',
                armedChipId === slot.id && 'scale-110 ring-2 ring-primary/50 shadow-md',
                liftedChipId === slot.id && 'opacity-40'
              )}
            >
              <span className="leading-none">
                {slot.icon ?? CATEGORY_ICONS[slot.category] ?? '\ud83d\udccc'}
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
                className="shrink-0 w-36 max-sm:w-56 rounded-full border border-primary bg-card px-2.5 py-1 max-sm:py-0.5 text-[11px] max-sm:text-base max-sm:leading-tight text-foreground outline-none placeholder:text-muted-foreground/50"
                aria-label="Add something for sometime this day"
              />
            ) : (
              <button
                data-grid-ignore
                type="button"
                onClick={() => setAddingChip(true)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1 rounded-full border border-dashed',
                  'px-2.5 py-1.5 text-[11px] transition-colors',
                  // A bright photo washes out a light-weight control, so the
                  // on-photo variant carries its own scrim.
                  onPhoto
                    ? 'border-white/60 bg-black/45 text-white/90 hover:bg-black/60 hover:text-white'
                    : 'border-border bg-background/70 text-muted-foreground/60 hover:text-primary hover:border-primary/50'
                )}
                title="Park something on this day without a time yet"
              >
                {untimed.length > 0 ? '\uff0b' : '\uff0b sometime that day\u2026'}
              </button>
            )
          )}
        </div>

        {/* Day number, date and city, read against a scrim on a photo */}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 px-1.5 pb-1 pt-6',
            onPhoto && 'bg-gradient-to-t from-black/75 via-black/30 to-transparent'
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className={cn(
                'font-serif font-semibold text-base leading-tight shrink-0',
                onPhoto ? 'text-white' : 'text-foreground'
              )}
            >
              Day {day.day_number}
            </h3>
            {dateText && (
              <span
                className={cn(
                  'text-[11px] truncate',
                  onPhoto ? 'text-white/85' : 'text-muted-foreground'
                )}
              >
                {dateText}
              </span>
            )}
            {onEditDay && (
              <button
                type="button"
                data-grid-ignore
                onClick={() => onEditDay(day)}
                className={cn(
                  'touch-target shrink-0 transition-colors touch-manipulation p-0.5 rounded',
                  onPhoto
                    ? 'text-white/75 hover:text-white'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
                )}
                title="Edit day"
                aria-label="Edit day"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            {day.city && (
              <CityTag
                city={day.city}
                className={cn(
                  onPhoto
                    ? 'bg-white/90 text-foreground border-transparent'
                    : 'bg-muted/80 text-muted-foreground border-border'
                )}
              />
            )}
            {canEdit && (
              <button
                data-grid-ignore
                onClick={() => setPhotoMenuOpen((v) => !v)}
                disabled={imageWorking}
                className={cn(
                  'touch-target transition-colors disabled:opacity-40 touch-manipulation p-0.5 shrink-0',
                  onPhoto
                    ? 'text-white/75 hover:text-white'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
                )}
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
            )}
          </div>
        </div>
      </div>

      {/* The photo menu hangs below the header, outside the photo's
          `overflow-hidden`, which would otherwise clip it. */}
      {photoMenuOpen && (
        <>
          <div
            data-grid-ignore
            className="fixed inset-0 z-40"
            onClick={() => setPhotoMenuOpen(false)}
          />
          <div
            data-grid-ignore
            className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden min-w-[200px]"
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
  )
}
