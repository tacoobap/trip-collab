import { Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { Trip } from '@/types/database'
import { cn } from '@/lib/utils'
import { UserMenu } from '@/components/layout/UserMenu'

interface PageHeaderProps {
  trip: Trip
  currentName?: string | null
  /** When true (e.g. itinerary over full-screen hero), use dark transparent overlay; otherwise light bar */
  overHero?: boolean
}

export function PageHeader({
  trip,
  currentName,
  overHero = false,
}: PageHeaderProps) {
  const location = useLocation()
  const isItinerary = location.pathname.endsWith('/itinerary')
  const isCollection = location.pathname.includes('/collection')

  const isDark = overHero
  const linkActive = isDark ? 'text-white bg-white/15' : 'border-primary text-foreground'
  const linkInactive = isDark ? 'text-white/70 hover:text-white' : 'border-transparent text-muted-foreground hover:text-foreground'

  return (
    <header
      className={cn(
        'top-0 z-20 transition-colors duration-300 border-b',
        isDark
          ? 'fixed left-0 right-0 bg-black/20 backdrop-blur-md border-white/10'
          : 'sticky top-0 bg-warm-white/80 backdrop-blur-sm border-border'
      )}
    >
      <div className="relative max-w-7xl mx-auto px-3 sm:px-6 py-3 max-sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Trup */}
        <Link
          to="/home"
          className={cn(
            'flex items-center gap-1.5 shrink-0 transition-colors z-10',
            isDark ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
          )}
          title="Trup home"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:block text-xs font-semibold tracking-wide uppercase">
            Trup
          </span>
        </Link>

        {/* Center: nav items */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 max-sm:gap-0">
          <Link
            to={`/trip/${trip.slug}`}
            className={cn(
              'px-3 py-2 text-sm font-medium rounded-md border-b-2 border-transparent transition-colors touch-manipulation max-sm:px-2.5 max-sm:py-2.5 max-sm:min-h-[44px] max-sm:flex max-sm:items-center',
              !isItinerary && !isCollection ? linkActive : linkInactive
            )}
          >
            Planning
          </Link>
          <Link
            to={`/trip/${trip.slug}/collection`}
            className={cn(
              'px-3 py-2 text-sm font-medium rounded-md border-b-2 border-transparent transition-colors touch-manipulation max-sm:px-2.5 max-sm:py-2.5 max-sm:min-h-[44px] max-sm:flex max-sm:items-center',
              isCollection ? linkActive : linkInactive
            )}
          >
            Collection
          </Link>
          <Link
            to={`/trip/${trip.slug}/itinerary`}
            className={cn(
              'px-3 py-2 text-sm font-medium rounded-md border-b-2 border-transparent transition-colors touch-manipulation max-sm:px-2.5 max-sm:py-2.5 max-sm:min-h-[44px] max-sm:flex max-sm:items-center',
              isItinerary ? linkActive : linkInactive
            )}
          >
            Itinerary
          </Link>
        </nav>

        {/* Right: user avatar + dropdown menu */}
        {currentName && <UserMenu isDark={isDark} />}
      </div>
    </header>
  )
}
