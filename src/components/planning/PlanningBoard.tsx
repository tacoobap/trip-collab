import { useState, useEffect } from 'react'
import type { Trip, DayWithSlots, SlotWithProposals } from '@/types/database'
import { DayColumn } from './DayColumn'
import { ProposalDrawer } from './ProposalDrawer'
import { TripSetupPanel } from './TripSetupPanel'

interface PlanningBoardProps {
  trip: Trip
  days: DayWithSlots[]
  currentName: string
}

export function PlanningBoard({ trip, days, currentName }: PlanningBoardProps) {
  const [activeSlot, setActiveSlot] = useState<SlotWithProposals | null>(null)
  const [activeDayLabel, setActiveDayLabel] = useState('')

  // Keep the open drawer in sync when real-time updates arrive
  useEffect(() => {
    if (!activeSlot) return
    for (const day of days) {
      const updated = day.slots.find((s) => s.id === activeSlot.id)
      if (updated) {
        setActiveSlot(updated)
        break
      }
    }
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSlotClick = (slot: SlotWithProposals, dayLabel: string) => {
    setActiveSlot(slot)
    setActiveDayLabel(dayLabel)
  }

  if (days.length === 0) {
    return <TripSetupPanel trip={trip} />
  }

  return (
    <>
      <div
        className="w-full min-w-0 overflow-x-auto pb-6 -mx-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex gap-6 min-w-max items-start w-max">
          {days.map((day) => (
            <DayColumn
              key={day.id}
              day={day}
              tripId={trip.id}
              currentName={currentName}
              onSlotClick={handleSlotClick}
            />
          ))}
        </div>
      </div>

      <ProposalDrawer
        trip={trip}
        days={days}
        slot={activeSlot}
        dayLabel={activeDayLabel}
        currentName={currentName}
        onClose={() => setActiveSlot(null)}
        onUpdate={() => {}}
      />
    </>
  )
}
