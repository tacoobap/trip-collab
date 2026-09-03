import { useState, useEffect } from 'react'
import type { Trip, DayWithSlots, SlotWithProposals } from '@/types/database'
import { TimeGridBoard } from './TimeGridBoard'
import { ProposalDrawer } from './ProposalDrawer'
import { TripSetupPanel } from './TripSetupPanel'
import { EditDayModal } from './EditDayModal'

interface PlanningBoardProps {
  trip: Trip
  days: DayWithSlots[]
  currentName: string
  getToken?: () => Promise<string | null>
  isMember: boolean
  isOwner: boolean
  onOpenEditTrip?: () => void
}

export function PlanningBoard({ trip, days, currentName, getToken, isMember, isOwner, onOpenEditTrip }: PlanningBoardProps) {
  const [activeSlot, setActiveSlot] = useState<SlotWithProposals | null>(null)
  const [activeDayLabel, setActiveDayLabel] = useState('')
  const [activeEditDay, setActiveEditDay] = useState<DayWithSlots | null>(null)

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
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <TripSetupPanel
          trip={trip}
          canEdit={isMember}
          onOpenEditTrip={onOpenEditTrip}
        />
      </div>
    )
  }

  return (
    <>
      <TimeGridBoard
        trip={trip}
        days={days}
        currentName={currentName}
        getToken={getToken}
        canEdit={isMember}
        onSlotClick={handleSlotClick}
        onEditDay={isMember ? (d) => setActiveEditDay(d) : undefined}
      />

      <ProposalDrawer
        trip={trip}
        days={days}
        slot={activeSlot}
        dayLabel={activeDayLabel}
        currentName={currentName}
        onClose={() => setActiveSlot(null)}
        onUpdate={() => {}}
        canEdit={isMember}
        canDeleteSlot={isOwner}
      />

      <EditDayModal
        open={!!activeEditDay}
        onOpenChange={(open) => !open && setActiveEditDay(null)}
        day={activeEditDay}
        trip={trip}
      />
    </>
  )
}
