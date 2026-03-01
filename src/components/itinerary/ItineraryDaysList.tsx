import { Link } from 'react-router-dom'
import { BedDouble } from 'lucide-react'
import { DaySection } from '@/components/itinerary/DaySection'
import { CityDivider } from '@/components/layout/CityDivider'
import type { DayWithSlots, Stay } from '@/types/database'

interface ItineraryDaysListProps {
  slug: string
  days: DayWithSlots[]
  stays: Stay[]
}

function stayForDay(stays: Stay[], date: string | null): Stay | undefined {
  if (!date) return undefined
  return stays.find((s) => s.check_in <= date && date < s.check_out)
}

export function ItineraryDaysList({ slug, days, stays }: ItineraryDaysListProps) {
  if (days.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-12 text-center">
        <p className="text-muted-foreground text-sm mb-3">Nothing locked in yet.</p>
        <Link to={`/trip/${slug}`} className="text-sm text-primary hover:underline">
          ← Head back to planning
        </Link>
      </div>
    )
  }

  let lastCity = ''
  let lastStayId = ''

  return (
    <>
      {days.map((day, dayIndex) => {
        const showDivider = day.city !== lastCity
        lastCity = day.city
        const dayStay = stayForDay(stays, day.date)
        const showStay = !!dayStay && dayStay.id !== lastStayId
        if (dayStay) lastStayId = dayStay.id

        return (
          <div
            key={day.id}
            className={dayIndex % 2 === 0 ? 'bg-sand/30' : 'bg-background'}
          >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-14">
              {showDivider && <CityDivider city={day.city} />}

              {showStay && dayStay && (
                <div className="mt-4 flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-muted/30 mb-2">
                  <BedDouble className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Staying at</p>
                    <p className="text-sm font-semibold text-foreground">{dayStay.name}</p>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <DaySection day={day} flip={dayIndex % 2 === 1} />
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
