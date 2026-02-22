import { useState, useEffect } from 'react'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import { DayColumn } from './DayColumn'
import { ProposalDrawer } from './ProposalDrawer'
import { AddDayDialog } from './AddDayDialog'
import { Plus, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlanningBoardProps {
  tripId: string
  days: DayWithSlots[]
  currentName: string
}

export function PlanningBoard({ tripId, days, currentName }: PlanningBoardProps) {
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
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4">
          <CalendarDays className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-serif font-semibold text-foreground mb-2">
          No days set up yet
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Add your first day to start building the trip structure.
        </p>
        <Button onClick={() => setAddDayOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add first day
        </Button>
        <AddDayDialog
          open={addDayOpen}
          onOpenChange={setAddDayOpen}
          tripId={tripId}
          nextDayNumber={1}
        />
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4 px-4 sm:px-6 min-w-max items-start">
          {days.map((day) => (
            <DayColumn
              key={day.id}
              day={day}
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
        tripId={tripId}
        nextDayNumber={days.length + 1}
      />
    </>
  )
}
