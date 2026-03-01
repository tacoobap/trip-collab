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
 * Shared chrome for trip-level pages: PageHeader + optional guest banner + optional trip name bar + children.
 * Used by TripPage (Planning) and CollectionPage. ItineraryPage does NOT use this so it can keep its
 * custom over-hero header and scroll behavior.
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
