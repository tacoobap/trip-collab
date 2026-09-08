import { Sparkles, CalendarRange, Bookmark, BookOpen } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { Trip } from '@/types/database'
import { cn, formatTripDate } from '@/lib/utils'
import { UserMenu } from '@/components/layout/UserMenu'
import type { MenuItem } from '@/components/layout/UserMenu'

interface PageHeaderProps {
  trip: Trip
  currentName?: string | null
  /** When true (e.g. itinerary over full-screen hero), use dark transparent overlay; otherwise light bar */
  overHero?: boolean
  /**
   * Show the trip's name and dates in the bar. Planning and Collection do; the
   * itinerary has them in its hero and settings has them in its own heading.
   */
  showTripId?: boolean
  /** Trip-wide controls — To-dos, Stays, Undo — placed before the menu. */
  actions?: React.ReactNode
  /**
   * The same trip-wide actions as menu rows, shown only below `sm`. On a phone
   * the tab row takes the space the buttons would need, so they move into the
   * menu; `actions` hides its own buttons there, so nothing appears twice.
   */
  phoneActions?: MenuItem[]
}

export function PageHeader({
  trip,
  currentName,
  overHero = false,
  showTripId = false,
  actions,
  phoneActions,
}: PageHeaderProps) {
  const location = useLocation()
  const isItinerary = location.pathname.endsWith('/itinerary')
  const isCollection = location.pathname.includes('/collection')
  // Settings is not a tab. Without this it falls through to the Planning
  // branch below, which is "none of the others", and lights the wrong tab.
  const isSettings = location.pathname.endsWith('/settings')
  const isPlanning = !isItinerary && !isCollection && !isSettings

  const isDark = overHero
  const linkActive = isDark ? 'text-white bg-white/15' : 'border-primary text-foreground'
  const linkInactive = isDark ? 'text-white/70 hover:text-white' : 'border-transparent text-muted-foreground hover:text-foreground'

  const startFmt = formatTripDate(trip.start_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const endFmt = formatTripDate(trip.end_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : startFmt ?? endFmt ?? null
  const startShort = formatTripDate(trip.start_date, { month: 'short', day: 'numeric' })
  const endShort = formatTripDate(trip.end_date, { month: 'short', day: 'numeric' })
  const dateRangeShort = startShort && endShort ? `${startShort} – ${endShort}` : startShort ?? endShort ?? null

  const tabs = [
    { label: 'Planning', to: `/trip/${trip.slug}`, on: isPlanning, Icon: CalendarRange },
    { label: 'Collection', to: `/trip/${trip.slug}/collection`, on: isCollection, Icon: Bookmark },
    { label: 'Itinerary', to: `/trip/${trip.slug}/itinerary`, on: isItinerary, Icon: BookOpen },
  ]

  return (
    <>
      <header
        data-print="hide"
        className={cn(
          // z-30, not z-20: sticky + z-index makes this header its own stacking
          // context, so the account menu inside it can never out-paint a sibling
          // however high its own z-index goes. The planning board's day headers
          // are also z-20 and come later in the DOM, and its hour gutter is
          // z-[25] — both used to cover the open menu.
          'top-0 z-30 transition-colors duration-300 border-b',
          isDark
            ? 'fixed left-0 right-0 bg-black/20 backdrop-blur-md border-white/10'
            : 'sticky top-0 bg-warm-white/80 backdrop-blur-sm border-border'
        )}
      >
        <div className="relative max-w-7xl mx-auto px-5 sm:px-6 py-3 max-sm:py-2 flex items-center justify-between gap-3 max-sm:gap-2">
          {/* Left: mark, then the trip it belongs to */}
          <div className="flex items-center gap-3 min-w-0 z-10">
            <Link
              to="/home"
              className={cn(
                'shrink-0 transition-colors',
                isDark ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Trup home"
              aria-label="Trup home"
            >
              <Sparkles className="w-4 h-4" />
            </Link>

            {showTripId && (
              // Hidden below `sm`: the tab row needs that width, and the menu
              // names the trip anyway. Capped above it so a long name truncates
              // before reaching the centred tabs, which won't be pushed.
              <div className="hidden sm:block min-w-0 sm:max-w-[22rem] lg:max-w-[26rem]">
                <h2
                  className={cn(
                    'font-serif text-lg sm:text-xl font-semibold truncate leading-tight',
                    isDark ? 'text-white' : 'text-foreground'
                  )}
                >
                  {trip.name}
                </h2>
                {dateRange && (
                  <p
                    className={cn(
                      'text-sm max-sm:text-[13px] truncate leading-tight mt-0.5',
                      isDark ? 'text-white/70' : 'text-muted-foreground'
                    )}
                  >
                    <span className="sm:hidden">{dateRangeShort}</span>
                    <span className="hidden sm:inline">{dateRange}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Centre: the three surfaces. Icons below `sm`, where three labels
              would take 238 of the 375px viewport and leave nothing for the
              rest of the row; absolutely centred from `sm` up, where there is
              room and the labels are worth having. Kept in normal flow on
              phones so the row can never overlap itself. */}
          <nav className="flex items-center gap-0.5 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            {tabs.map(({ label, to, on, Icon }) => (
              <Link
                key={label}
                to={to}
                title={label}
                aria-label={label}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'rounded-md border-b-2 border-transparent transition-colors whitespace-nowrap',
                  'max-sm:w-11 max-sm:h-11 max-sm:flex max-sm:items-center max-sm:justify-center max-sm:touch-manipulation',
                  'sm:px-3 sm:py-2 sm:text-sm sm:font-medium',
                  on ? linkActive : linkInactive
                )}
              >
                <Icon className="w-[18px] h-[18px] sm:hidden" />
                <span className="max-sm:hidden">{label}</span>
              </Link>
            ))}
          </nav>

          {/* Right: trip-wide tools, then you */}
          <div className="flex items-center gap-1 max-sm:gap-0 shrink-0 z-10">
            {actions}
            {currentName && (
              <UserMenu
                isDark={isDark}
                tripSlug={trip.slug}
                tripName={trip.name}
                phoneActions={phoneActions}
              />
            )}
          </div>
        </div>
      </header>
    </>
  )
}
