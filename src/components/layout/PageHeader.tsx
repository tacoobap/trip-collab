import { MapPin, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Trip } from '@/types/database'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'

interface PageHeaderProps {
  trip: Trip
  travelers?: string[]
  currentName?: string | null
  showItineraryLink?: boolean
}

export function PageHeader({ trip, travelers = [], currentName, showItineraryLink = true }: PageHeaderProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const startFmt = formatDate(trip.start_date)
  const endFmt = formatDate(trip.end_date)
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : null

  return (
    <header className="border-b border-border bg-warm-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-serif font-semibold text-foreground truncate">
            {trip.name}
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {trip.destinations.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                {trip.destinations.join(' · ')}
              </div>
            )}
            {dateRange && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3 shrink-0" />
                {dateRange}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {travelers.length > 0 && (
            <div className="flex items-center -space-x-1">
              {travelers.map((t) => (
                <ProposerAvatar key={t} name={t} size="sm" />
              ))}
            </div>
          )}

          {currentName && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              You're <span className="font-semibold text-foreground">{currentName}</span>
            </span>
          )}

          {showItineraryLink && (
            <Link
              to={`/trip/${trip.slug}/itinerary`}
              className="text-xs font-medium text-primary hover:underline underline-offset-2 hidden sm:block"
            >
              View itinerary →
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
