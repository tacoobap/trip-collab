import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { SlotCard } from './SlotCard'
import { CityTag } from '@/components/shared/CityTag'

interface DayColumnProps {
  day: DayWithSlots
  currentName: string
  onSlotClick: (slot: SlotWithProposals, dayLabel: string) => void
}

export function DayColumn({ day, currentName, onSlotClick }: DayColumnProps) {
  const sortedSlots = [...day.slots].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex flex-col min-w-[200px] sm:min-w-[220px]">
      <div className="pb-3 mb-3 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif font-semibold text-sm text-foreground leading-tight">
            {day.label}
          </h3>
          <CityTag city={day.city} />
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
            currentName={currentName}
            onClick={() => onSlotClick(slot, day.label)}
          />
        ))}
      </div>
    </div>
  )
}
