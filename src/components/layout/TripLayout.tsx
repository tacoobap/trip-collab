import type { Trip } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'

interface TripLayoutProps {
  trip: Trip
  currentName: string | null
  /** Optional banner below header (e.g. guest "Join this trip") */
  guestBanner?: React.ReactNode
  /** Optional trip name + dates + actions bar (Planning page only; Collection/Itinerary use their own) */
  tripNameBar?: React.ReactNode
  children: React.ReactNode
}

/**
 * Shared chrome for CollectionPage: PageHeader + optional guest banner + optional trip name bar + children.
 * TripPage renders PageHeader itself, because the time grid needs the page to be
 * `h-dvh flex flex-col` rather than a scrolling document; ItineraryPage opts out
 * so it can keep its over-hero header and scroll behaviour. The trip bar the two
 * planning surfaces share lives in `TripBar`, not here.
 */
export function TripLayout({
  trip,
  currentName,
  guestBanner,
  tripNameBar,
  children,
}: TripLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader trip={trip} currentName={currentName ?? ''} />
      {guestBanner}
      {tripNameBar}
      {children}
    </div>
  )
}
