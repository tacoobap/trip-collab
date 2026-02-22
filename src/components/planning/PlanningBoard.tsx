import { useState, useEffect } from 'react'
import type { Trip, DayWithSlots, SlotWithProposals } from '@/types/database'
import { DayColumn } from './DayColumn'
import { ProposalDrawer } from './ProposalDrawer'
import { AddDayDialog } from './AddDayDialog'
import { TripSetupPanel } from './TripSetupPanel'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlanningBoardProps {
  trip: Trip
  days: DayWithSlots[]
  currentName: string
}

export function PlanningBoard({ trip, days, currentName }: PlanningBoardProps) {
  const [activeSlot, setActiveSlot] = useState<SlotWithProposals | null>(null)
  const [activeDayLabel, setActiveDayLabel] = useState('')
  const [addDayOpen, setAddDayOpen] = useState(false)

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
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4 px-4 sm:px-6 min-w-max items-start">
          {days.map((day) => (
            <DayColumn
              key={day.id}
              day={day}
              tripId={trip.id}
              currentName={currentName}
              onSlotClick={handleSlotClick}
            />
          ))}

          {/* Add day button at the end of the board */}
          <div className="flex flex-col min-w-[160px] pt-1">
            <Button
              variant="outline"
              className="h-full min-h-[80px] border-dashed text-muted-foreground hover:text-foreground flex flex-col gap-1.5"
              onClick={() => setAddDayOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs">Add day</span>
            </Button>
          </div>
        </div>
      </div>

      <ProposalDrawer
        slot={activeSlot}
        dayLabel={activeDayLabel}
        currentName={currentName}
        onClose={() => setActiveSlot(null)}
        onUpdate={() => {}}
      />

      <AddDayDialog
        open={addDayOpen}
        onOpenChange={setAddDayOpen}
        trip={trip}
        existingDays={days}
      />
    </>
  )
}
