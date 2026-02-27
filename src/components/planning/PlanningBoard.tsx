import { useState, useEffect, useRef, useCallback } from 'react'
import type { Trip, DayWithSlots, SlotWithProposals } from '@/types/database'
import { DayColumn } from './DayColumn'
import { ProposalDrawer } from './ProposalDrawer'
import { TripSetupPanel } from './TripSetupPanel'
import { cn } from '@/lib/utils'

interface PlanningBoardProps {
  trip: Trip
  days: DayWithSlots[]
  currentName: string
  getToken?: () => Promise<string | null>
}

const VISIBLE_PILLS_HINT_THRESHOLD = 5

export function PlanningBoard({ trip, days, currentName, getToken }: PlanningBoardProps) {
  const [activeSlot, setActiveSlot] = useState<SlotWithProposals | null>(null)
  const [activeDayLabel, setActiveDayLabel] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])
  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [hasMoreDaysRight, setHasMoreDaysRight] = useState(false)

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

  // On mobile: track which day column is in view for pill indicator
  useEffect(() => {
    if (days.length === 0) return
    const el = scrollRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const i = Number((entry.target as HTMLElement).dataset.dayIndex)
          if (!Number.isNaN(i)) setActiveDayIndex(i)
        })
      },
      { root: el, rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    )

    for (let i = 0; i < days.length; i++) {
      const col = columnRefs.current[i]
      if (col) observer.observe(col)
    }
    return () => observer.disconnect()
  }, [days.length])

  const scrollToDay = useCallback((index: number) => {
    columnRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }, [])

  // Detect when the board has more columns off-screen to the right
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const update = () => {
      const canScroll = el.scrollWidth > el.clientWidth
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2
      setHasMoreDaysRight(canScroll && !atEnd)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
    }
  }, [days.length])

  const handleSlotClick = (slot: SlotWithProposals, dayLabel: string) => {
    setActiveSlot(slot)
    setActiveDayLabel(dayLabel)
  }

  if (days.length === 0) {
    return <TripSetupPanel trip={trip} />
  }

  return (
    <>
      {/* Mobile: day pills for quick navigation — hidden on sm and up */}
      <div className="sm:hidden relative pb-3 -mx-1 px-1">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-2 min-w-max pr-2">
            {days.map((day, i) => (
              <button
                key={day.id}
                type="button"
                onClick={() => scrollToDay(i)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors touch-manipulation min-h-[44px]',
                  activeDayIndex === i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                )}
              >
                Day {day.day_number}
              </button>
            ))}
            {days.length > VISIBLE_PILLS_HINT_THRESHOLD && (
              <span className="shrink-0 self-center text-xs text-muted-foreground px-2 whitespace-nowrap">
                +{days.length - VISIBLE_PILLS_HINT_THRESHOLD} more
              </span>
            )}
          </div>
        </div>
        {days.length > VISIBLE_PILLS_HINT_THRESHOLD && (
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-3 w-14 bg-gradient-to-l from-background to-transparent"
            aria-hidden
          />
        )}
      </div>

      <div className="relative w-full min-w-0 max-sm:-mx-2">
        {hasMoreDaysRight && (
          <>
            <div
              className="pointer-events-none absolute right-0 top-0 bottom-6 max-sm:bottom-4 w-16 sm:w-20 bg-gradient-to-l from-background to-transparent z-10"
              aria-hidden
            />
            <div className="pointer-events-none absolute right-2 bottom-8 max-sm:bottom-6 z-10 flex items-center gap-1 text-xs text-muted-foreground max-sm:right-3">
              <span className="hidden sm:inline">More days</span>
              <span className="text-muted-foreground/70">→</span>
            </div>
          </>
        )}
        <div
          ref={scrollRef}
          className={cn(
            'w-full min-w-0 overflow-x-auto pb-6 -mx-1 max-sm:pb-4 max-sm:mx-0',
            'max-sm:snap-x max-sm:snap-mandatory'
          )}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex gap-6 min-w-max items-start w-max max-sm:gap-4 max-sm:pr-2">
            {days.map((day, i) => (
            <div
              key={day.id}
              ref={(el) => { columnRefs.current[i] = el }}
              data-day-index={i}
              className="max-sm:snap-start max-sm:snap-always max-sm:shrink-0"
            >
              <DayColumn
                day={day}
                tripId={trip.id}
                currentName={currentName}
                onSlotClick={handleSlotClick}
                getToken={getToken}
              />
            </div>
          ))}
          </div>
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
