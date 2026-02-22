import { motion } from 'framer-motion'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { TimelineItem } from './TimelineItem'
import { CityTag } from '@/components/shared/CityTag'

interface DaySectionProps {
  day: DayWithSlots
  dayIndex: number
}

/**
 * Converts a user-entered time string into minutes from midnight for sorting.
 * Handles formats like "7:30 PM", "19:30", "7pm", "9:00 AM".
 * Returns Infinity for unparseable values so they sort to the end.
 */
function parseTimeToMinutes(time: string | null | undefined): number {
  if (!time) return Infinity
  const clean = time.trim().toLowerCase()
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return Infinity
  let h = parseInt(match[1])
  const m = parseInt(match[2] ?? '0')
  const period = match[3]
  if (period === 'pm' && h !== 12) h += 12
  if (period === 'am' && h === 12) h = 0
  return h * 60 + m
}

function slotSortKey(slot: SlotWithProposals): number {
  const locked = slot.proposals.find((p) => p.id === slot.locked_proposal_id)
  const parsed = parseTimeToMinutes(locked?.exact_time)
  // If we got a real time, use it. Otherwise fall back to sort_order (scaled up so times always beat it).
  return parsed < Infinity ? parsed : 10000 + slot.sort_order
}

export function DaySection({ day, dayIndex }: DaySectionProps) {
  const sortedSlots = [...day.slots].sort((a, b) => slotSortKey(a) - slotSortKey(b))

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.1 }}
      className="mb-12"
    >
      {/* Day image with Ken Burns */}
      {day.image_url && (
        <div className="relative h-52 sm:h-72 rounded-2xl overflow-hidden mb-6">
          <motion.img
            src={day.image_url}
            alt={day.label}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1 }}
            animate={{ scale: 1.07 }}
            transition={{
              duration: 14,
              ease: 'linear',
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 p-5">
            <h2 className="font-serif text-2xl font-bold text-white leading-tight">
              {day.label}
            </h2>
            {day.date && (
              <p className="text-white/70 text-sm mt-0.5">
                {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Day header (shown when no image) */}
      {!day.image_url && (
        <div className="flex items-baseline gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CityTag city={day.city} />
              {day.date && (
                <span className="text-xs text-muted-foreground">
                  {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">{day.label}</h2>
          </div>
        </div>
      )}

      <div className="ml-4">
        {sortedSlots.map((slot, i) => (
          <TimelineItem key={slot.id} slot={slot} index={i} />
        ))}
      </div>
    </motion.section>
  )
}
