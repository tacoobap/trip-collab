import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Curated travel emoji set, loosely grouped
export const SLOT_EMOJIS: { emoji: string; label: string }[] = [
  // Food & drink
  { emoji: '🍽', label: 'Dining' },
  { emoji: '🥂', label: 'Champagne' },
  { emoji: '🍷', label: 'Wine' },
  { emoji: '🥃', label: 'Whiskey' },
  { emoji: '🍺', label: 'Beer' },
  { emoji: '☕', label: 'Coffee' },
  { emoji: '🧋', label: 'Boba' },
  { emoji: '🍣', label: 'Sushi' },
  { emoji: '🍜', label: 'Noodles' },
  { emoji: '🌮', label: 'Tacos' },
  { emoji: '🍕', label: 'Pizza' },
  { emoji: '🍔', label: 'Burger' },
  { emoji: '🥩', label: 'Steak' },
  { emoji: '🥐', label: 'Croissant' },
  { emoji: '🍳', label: 'Breakfast' },
  { emoji: '🥞', label: 'Pancakes' },
  { emoji: '🧇', label: 'Waffles' },
  { emoji: '🍰', label: 'Cake' },
  { emoji: '🍦', label: 'Ice cream' },
  { emoji: '🧆', label: 'Falafel' },
  { emoji: '🫕', label: 'Stew' },
  { emoji: '🥘', label: 'Paella' },
  { emoji: '🥗', label: 'Salad' },
  { emoji: '🍱', label: 'Bento' },
  { emoji: '🍫', label: 'Chocolate' },
  // Activities & culture
  { emoji: '🎭', label: 'Theatre' },
  { emoji: '🎨', label: 'Art' },
  { emoji: '🎬', label: 'Cinema' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '🎸', label: 'Guitar' },
  { emoji: '🎷', label: 'Jazz' },
  { emoji: '💃', label: 'Dancing' },
  { emoji: '🎪', label: 'Circus' },
  { emoji: '🎡', label: 'Fairground' },
  { emoji: '🎢', label: 'Rollercoaster' },
  { emoji: '🎯', label: 'Darts' },
  { emoji: '🎲', label: 'Games' },
  { emoji: '🎳', label: 'Bowling' },
  { emoji: '🛍', label: 'Shopping' },
  { emoji: '🛒', label: 'Market' },
  { emoji: '📸', label: 'Photography' },
  // Sports & outdoors
  { emoji: '🏖', label: 'Beach' },
  { emoji: '🏔', label: 'Mountain' },
  { emoji: '🥾', label: 'Hiking' },
  { emoji: '🚴', label: 'Cycling' },
  { emoji: '🏊', label: 'Swimming' },
  { emoji: '🏄', label: 'Surfing' },
  { emoji: '🤿', label: 'Diving' },
  { emoji: '🧗', label: 'Climbing' },
  { emoji: '⛷', label: 'Skiing' },
  { emoji: '🧘', label: 'Yoga' },
  { emoji: '🏋', label: 'Gym' },
  { emoji: '⛳', label: 'Golf' },
  { emoji: '⛵', label: 'Sailing' },
  { emoji: '🚣', label: 'Kayak' },
  { emoji: '🏇', label: 'Horse riding' },
  // Sights & landmarks
  { emoji: '🏛', label: 'Museum / ruins' },
  { emoji: '🗿', label: 'Landmark' },
  { emoji: '🗼', label: 'Tower' },
  { emoji: '🗽', label: 'Statue' },
  { emoji: '🏰', label: 'Castle' },
  { emoji: '⛩', label: 'Shrine' },
  { emoji: '🕌', label: 'Mosque' },
  { emoji: '⛪', label: 'Church' },
  { emoji: '🏟', label: 'Stadium' },
  { emoji: '🌃', label: 'City night' },
  { emoji: '🌆', label: 'Cityscape' },
  // Travel & transport
  { emoji: '✈️', label: 'Flight' },
  { emoji: '🚂', label: 'Train' },
  { emoji: '🚌', label: 'Bus' },
  { emoji: '🚗', label: 'Drive' },
  { emoji: '⛴', label: 'Ferry' },
  { emoji: '🚁', label: 'Helicopter' },
  { emoji: '🛵', label: 'Scooter' },
  { emoji: '🚲', label: 'Bike' },
  { emoji: '🚕', label: 'Taxi' },
  // Accommodation
  { emoji: '🏨', label: 'Hotel' },
  { emoji: '🏠', label: 'House' },
  { emoji: '🏡', label: 'Cottage' },
  { emoji: '🏰', label: 'Castle stay' },
  { emoji: '⛺', label: 'Camping' },
  { emoji: '🛖', label: 'Cabin' },
  // Nature & vibe
  { emoji: '✨', label: 'Vibe' },
  { emoji: '🌅', label: 'Sunrise' },
  { emoji: '🌄', label: 'Sunset' },
  { emoji: '🌊', label: 'Ocean' },
  { emoji: '🌿', label: 'Nature' },
  { emoji: '🌸', label: 'Flowers' },
  { emoji: '🌙', label: 'Night' },
  { emoji: '⭐', label: 'Star' },
  { emoji: '🦋', label: 'Butterfly' },
  { emoji: '🌺', label: 'Hibiscus' },
  { emoji: '🍃', label: 'Leaves' },
  { emoji: '🌋', label: 'Volcano' },
  { emoji: '🏜', label: 'Desert' },
  { emoji: '🌁', label: 'Fog' },
]

// Default emoji per category when no custom icon is set
export const CATEGORY_ICONS: Record<string, string> = {
  food: '🍽',
  activity: '🎭',
  travel: '✈️',
  accommodation: '🏨',
  vibe: '✨',
}

interface SlotIconPickerProps {
  open: boolean
  current: string
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function SlotIconPicker({ open, current, onSelect, onClose }: SlotIconPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="absolute left-0 right-0 top-full mt-2 z-10 bg-background border border-border rounded-xl shadow-xl p-3"
        >
          <div className="grid grid-cols-8 gap-0.5 max-h-52 overflow-y-auto">
            {SLOT_EMOJIS.map(({ emoji, label }) => (
              <button
                key={emoji}
                type="button"
                title={label}
                onClick={() => { onSelect(emoji); onClose() }}
                className={`w-9 h-9 text-xl flex items-center justify-center rounded-lg transition-colors hover:bg-muted ${
                  current === emoji ? 'bg-primary/10 ring-1 ring-primary/40' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
