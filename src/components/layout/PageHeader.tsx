import { MapPin, Calendar, Sparkles, ChevronDown, NotebookPen, BedDouble } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { Trip } from '@/types/database'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'
import { cn, formatTripDate } from '@/lib/utils'

interface PageHeaderProps {
  trip: Trip
  travelers?: string[]
  currentName?: string | null
  onChangeName?: () => void
  noteCount?: number
  onOpenNotes?: () => void
  stayCount?: number
  onOpenStays?: () => void
}

export function PageHeader({
  trip,
  travelers = [],
  currentName,
  onChangeName,
  noteCount = 0,
  onOpenNotes,
  stayCount = 0,
  onOpenStays,
}: PageHeaderProps) {
  const location = useLocation()
  const isItinerary = location.pathname.endsWith('/itinerary')

  const startFmt = formatTripDate(trip.start_date)
  const endFmt = formatTripDate(trip.end_date)
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : null

  return (
    <header className="border-b border-border bg-warm-white/80 backdrop-blur-sm sticky top-0 z-10">
      {/* Main row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        {/* Home branding */}
        <Link
          to="/"
          className="flex items-center gap-1.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Tripboard home"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:block text-xs font-semibold tracking-wide uppercase">
            Tripboard
          </span>
        </Link>

        <span className="text-border hidden sm:block">|</span>

        {/* Trip info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-serif font-semibold text-foreground truncate leading-tight">
            {trip.name}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
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

        {/* Right: avatars + current user */}
        <div className="flex items-center gap-2 shrink-0">
          {travelers.length > 0 && (
            <div className="flex items-center -space-x-1">
              {travelers.slice(0, 5).map((t) => (
                <ProposerAvatar key={t} name={t} size="sm" />
              ))}
            </div>
          )}

          {currentName && onChangeName && (
            <button
              onClick={onChangeName}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              title="Change name"
            >
              <span className="hidden sm:block">
                <span className="font-semibold text-foreground">{currentName}</span>
              </span>
              <ChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            </button>
          )}

          {currentName && !onChangeName && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              <span className="font-semibold text-foreground">{currentName}</span>
            </span>
          )}
        </div>
      </div>

      {/* Tab row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center pb-0">
        <Link
          to={`/trip/${trip.slug}`}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 transition-colors',
            !isItinerary
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Planning
        </Link>
        <Link
          to={`/trip/${trip.slug}/itinerary`}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 transition-colors',
            isItinerary
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Itinerary
        </Link>

        {(onOpenStays || onOpenNotes) && (
          <div className="ml-auto flex items-center">
            {onOpenStays && (
              <button
                onClick={onOpenStays}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent transition-colors"
              >
                <BedDouble className="w-3.5 h-3.5" />
                <span>Stays</span>
                {stayCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                    {stayCount}
                  </span>
                )}
              </button>
            )}
            {onOpenNotes && (
              <button
                onClick={onOpenNotes}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent transition-colors"
              >
                <NotebookPen className="w-3.5 h-3.5" />
                <span>Notes</span>
                {noteCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                    {noteCount}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
