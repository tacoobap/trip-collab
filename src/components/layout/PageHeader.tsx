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
  /**
   * The page's own identity — trip name and dates — folded into this bar from
   * `lg` up, where there is room for it beside the centred nav. Below `lg` this
   * stays hidden and the page renders its own bar underneath, as it always has.
   * Merging saves the planning board 75px of permanent chrome on a laptop.
   */
  title?: React.ReactNode
  /** The page's own controls, folded in beside the user menu from `lg` up. */
  actions?: React.ReactNode
}

export function PageHeader({
  trip,
  currentName,
  overHero = false,
  title,
  actions,
}: PageHeaderProps) {
  const location = useLocation()
  const isItinerary = location.pathname.endsWith('/itinerary')
  const isCollection = location.pathname.includes('/collection')

  const isDark = overHero
  const linkActive = isDark ? 'text-white bg-white/15' : 'border-primary text-foreground'
  const linkInactive = isDark ? 'text-white/70 hover:text-white' : 'border-transparent text-muted-foreground hover:text-foreground'
  const merged = Boolean(title || actions)

  return (
    <header
      data-print="hide"
      className={cn(
        'top-0 z-20 transition-colors duration-300 border-b',
        isDark
          ? 'fixed left-0 right-0 bg-black/20 backdrop-blur-md border-white/10'
          : 'sticky top-0 bg-warm-white/80 backdrop-blur-sm border-border'
      )}
    >
      <div
        className={cn(
          'relative max-w-7xl mx-auto px-5 sm:px-6 py-3 max-sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3',
          // The folded-in title is two lines tall, so the row can afford less
          // padding and still clear the 44px it needs.
          merged && 'lg:py-1.5'
        )}
      >
        {/* Left: Trup, then the page's own title once it folds in. The cap keeps
            a long trip name short of the centred nav — it lives here rather than
            on the title itself, where a percentage would resolve against a
            shrink-to-fit parent and collapse the name to nothing. */}
        <div
          className={cn(
            'flex items-center gap-2 min-w-0 z-10',
            merged && 'lg:max-w-[calc(50%-9rem)]'
          )}
        >
          <Link
            to="/home"
            className={cn(
              'flex items-center gap-1.5 shrink-0 transition-colors',
              isDark ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
            )}
            title="Trup home"
          >
            <Sparkles className="w-4 h-4" />
            <span
              className={cn(
                'hidden sm:block text-xs font-semibold tracking-wide uppercase',
                // The trip name takes this spot once it folds in; the mark stays
                // as the link home.
                merged && 'lg:hidden'
              )}
            >
              Trup
            </span>
          </Link>
          {title && <div className="hidden lg:block min-w-0">{title}</div>}
        </div>

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

        {/* Right: the page's own controls, then user avatar + dropdown menu */}
        <div className="flex items-center gap-2 shrink-0 z-10">
          {actions && <div className="hidden lg:flex items-center gap-2">{actions}</div>}
          {currentName && <UserMenu isDark={isDark} tripSlug={trip.slug} />}
        </div>
      </div>
    </header>
  )
}
