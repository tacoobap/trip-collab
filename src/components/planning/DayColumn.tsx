import { useRef, useState } from 'react'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { uploadImage } from '@/lib/imageUpload'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { SlotCard } from './SlotCard'
import { CityTag } from '@/components/shared/CityTag'
import { Camera, Loader2 } from 'lucide-react'

interface DayColumnProps {
  day: DayWithSlots
  tripId: string
  currentName: string
  onSlotClick: (slot: SlotWithProposals, dayLabel: string) => void
}

export function DayColumn({ day, tripId, currentName: _currentName, onSlotClick }: DayColumnProps) {
  const sortedSlots = [...day.slots].sort((a, b) => a.sort_order - b.sort_order)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
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

  return (
    <div className="flex flex-col min-w-[200px] sm:min-w-[220px]">
      {/* Day image thumbnail / upload */}
      <div
        className="relative mb-3 rounded-lg overflow-hidden cursor-pointer group"
        style={{ height: day.image_url ? 80 : 0 }}
        onClick={() => fileInputRef.current?.click()}
      >
        {day.image_url && (
          <>
            <img
              src={day.image_url}
              alt={day.label}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
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

      <div className="pb-3 mb-3 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif font-semibold text-sm text-foreground leading-tight">
            {day.label}
          </h3>
          <div className="flex items-center gap-1.5">
            <CityTag city={day.city} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              title={day.image_url ? 'Change day photo' : 'Add day photo'}
            >
              {uploading ? (
                <span className="text-[10px] font-medium">{uploadPct}%</span>
              ) : (
                <Camera className="w-3 h-3" />
              )}
            </button>
            {uploading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
        </div>
        {day.date && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {sortedSlots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            onClick={() => onSlotClick(slot, day.label)}
          />
        ))}
      </div>
    </div>
  )
}
