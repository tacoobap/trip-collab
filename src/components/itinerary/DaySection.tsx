import { motion } from 'framer-motion'
import type { DayWithSlots } from '@/types/database'
import { TimelineItem } from './TimelineItem'
import { CityTag } from '@/components/shared/CityTag'

interface DaySectionProps {
  day: DayWithSlots
  dayIndex: number
}

export function DaySection({ day, dayIndex }: DaySectionProps) {
  const sortedSlots = [...day.slots].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.1 }}
      className="mb-10"
    >
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

      <div className="ml-4">
        {sortedSlots.map((slot, i) => (
          <TimelineItem key={slot.id} slot={slot} index={i} />
        ))}
      </div>
    </motion.section>
  )
}
