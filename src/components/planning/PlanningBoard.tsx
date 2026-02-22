import { useState } from 'react'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { DayColumn } from './DayColumn'
import { ProposalDrawer } from './ProposalDrawer'

interface PlanningBoardProps {
  days: DayWithSlots[]
  currentName: string
  onUpdate: () => void
}

export function PlanningBoard({ days, currentName, onUpdate }: PlanningBoardProps) {
  const [activeSlot, setActiveSlot] = useState<SlotWithProposals | null>(null)
  const [activeDayLabel, setActiveDayLabel] = useState('')

  const handleSlotClick = (slot: SlotWithProposals, dayLabel: string) => {
    setActiveSlot(slot)
    setActiveDayLabel(dayLabel)
  }

  return (
    <>
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4 px-4 sm:px-6 min-w-max">
          {days.map((day) => (
            <DayColumn
              key={day.id}
              day={day}
              currentName={currentName}
              onSlotClick={handleSlotClick}
            />
          ))}
        </div>
      </div>

      <ProposalDrawer
        slot={activeSlot}
        dayLabel={activeDayLabel}
        currentName={currentName}
        onClose={() => setActiveSlot(null)}
        onUpdate={onUpdate}
      />
    </>
  )
}
