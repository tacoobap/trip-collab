import { motion } from 'framer-motion'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { TimelineItem } from './TimelineItem'
import { CityTag } from '@/components/shared/CityTag'

const ORDINALS = [
  'One','Two','Three','Four','Five','Six','Seven',
  'Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen',
]
function dayOrdinal(n: number): string {
  return ORDINALS[n - 1] ?? String(n)
}

interface DaySectionProps {
  day: DayWithSlots
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

export function DaySection({ day }: DaySectionProps) {
  const sortedSlots = [...day.slots].sort((a, b) => slotSortKey(a) - slotSortKey(b))

  const dateStr = day.date
    ? new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mb-16"
    >
      {/* Day image with Ken Burns */}
      {day.image_url && (
        <div className="relative h-56 sm:h-80 rounded-2xl overflow-hidden mb-8">
          <motion.img
            src={day.image_url}
            alt={day.label}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1 }}
            animate={{ scale: 1.07 }}
            transition={{ duration: 16, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <p className="text-white/50 text-[10px] uppercase tracking-[0.25em] mb-1.5">
              Day {dayOrdinal(day.day_number)}
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight">
              {day.narrative_title ?? day.label}
            </h2>
            {day.narrative_title && (
              <p className="text-white/60 text-xs mt-1">{dateStr ?? day.label}</p>
            )}
            {!day.narrative_title && dateStr && (
              <p className="text-white/60 text-xs mt-1">{dateStr}</p>
            )}
          </div>
          {day.image_attribution && (
            <a
              href="#"
              className="absolute bottom-2 right-3 text-[10px] text-white/25 hover:text-white/50 transition-colors"
            >
              {day.image_attribution}
            </a>
          )}
        </div>
      )}

      {/* Day header (shown when no image) */}
      {!day.image_url && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
              Day {dayOrdinal(day.day_number)}
            </p>
            <span className="text-border text-xs">·</span>
            <CityTag city={day.city} />
            {dateStr && (
              <span className="text-xs text-muted-foreground">{dateStr}</span>
            )}
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            {day.narrative_title ?? day.label}
          </h2>
        </div>
      )}

      <div>
        {sortedSlots.map((slot, i) => (
          <TimelineItem key={slot.id} slot={slot} index={i} />
        ))}
      </div>
    </motion.section>
  )
}
