import { motion } from 'framer-motion'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { TimelineItem } from './TimelineItem'
import { CityTag } from '@/components/shared/CityTag'
import { parseTimeToMinutes } from '@/lib/timeUtils'

const ORDINALS = [
  'One','Two','Three','Four','Five','Six','Seven',
  'Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen',
]
function dayOrdinal(n: number): string {
  return ORDINALS[n - 1] ?? String(n)
}

interface DaySectionProps {
  day: DayWithSlots
  flip?: boolean
}

function slotSortKey(slot: SlotWithProposals): number {
  const locked = slot.proposals.find((p) => p.id === slot.locked_proposal_id)
  const timeStr = locked?.exact_time ?? locked?.narrative_time ?? slot.time_label
  const parsed = parseTimeToMinutes(timeStr)
  return parsed < Infinity ? parsed : 10000 + slot.sort_order
}

export function DaySection({ day, flip = false }: DaySectionProps) {
  const sortedSlots = [...day.slots].sort((a, b) => slotSortKey(a) - slotSortKey(b))

  const dateStr = day.date
    ? new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : null

  const dayTitle = day.narrative_title ?? day.label
  const titleWithDate = dateStr ? `${dateStr.split(',')[0]} — ${dayTitle}` : dayTitle

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className=""
    >
      <div className={`flex flex-col md:items-start md:gap-12 ${flip ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
        {/* Image column: full-bleed photo only, no overlay text */}
        {day.image_url && (
          <div className="md:sticky md:top-24 w-full md:w-[42%] lg:w-[380px] shrink-0 mb-8 md:mb-0 order-first md:order-none">
            <div className="relative h-64 md:h-[320px] lg:aspect-[3/4] lg:h-auto lg:min-h-[380px] rounded-xl overflow-hidden bg-muted">
              <motion.img
                src={day.image_url}
                alt={day.label}
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ scale: 1 }}
                animate={{ scale: 1.05 }}
                transition={{ duration: 18, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
              />
              {day.image_attribution && (
                <a
                  href="#"
                  className="absolute bottom-2 right-3 text-[10px] text-white/40 hover:text-white/70 transition-colors drop-shadow-sm"
                >
                  {day.image_attribution}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Schedule column: day label + title + timeline (charleston-dreams gentle style) */}
        <div className="flex-1 min-w-0">
          <header className="mb-6">
            <span className="inline-block font-sans text-xs tracking-[0.25em] uppercase text-primary font-semibold mb-3">
              Day {dayOrdinal(day.day_number)}
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-6 leading-snug">
              {titleWithDate}
            </h2>
            {day.city && (
              <div className="flex items-center gap-2">
                <CityTag city={day.city} />
              </div>
            )}
          </header>

          <div className="space-y-4 font-sans text-muted-foreground leading-relaxed">
            {sortedSlots.map((slot, i) => (
              <TimelineItem key={slot.id} slot={slot} isLast={i === sortedSlots.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
