import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanningBoard } from '@/components/planning/PlanningBoard'
import { StaysDrawer } from '@/components/stays/StaysDrawer'
import { NamePrompt } from './NamePrompt'
import { useDisplayName } from '@/hooks/useDisplayName'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/hooks/useTrip'
import { useStays } from '@/hooks/useStays'
import { formatTripDate } from '@/lib/utils'
import { Loader2, BedDouble } from 'lucide-react'

export function TripPage() {
  const { slug } = useParams<{ slug: string }>()
  const { displayName, setName, clearName, namesUsed, isSignedIn } = useDisplayName()
  const { user, getIdToken } = useAuth()
  const { trip, days, loading, error } = useTrip(slug)
  const { stays, addStay, updateStay, deleteStay } = useStays(trip?.id)
  const [staysOpen, setStaysOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-serif font-semibold text-foreground mb-2">
            {error || 'Trip not found'}
          </p>
          {user && (
            <p className="text-xs text-muted-foreground mb-4 font-mono break-all max-w-md mx-auto">
              Signed-in UID: {user.uid}
            </p>
          )}
          {!user && (
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to view this trip.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {!user && (
              <a href="/sign-in" className="text-sm text-primary hover:underline">
                Sign in with Google
              </a>
            )}
            <a href="/" className="text-sm text-primary hover:underline">
              ← Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!displayName && !isSignedIn) {
    return <NamePrompt onSetName={setName} namesUsed={namesUsed} />
  }

  const startFmt = formatTripDate(trip.start_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const endFmt = formatTripDate(trip.end_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : startFmt ?? endFmt ?? null

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        trip={trip}
        currentName={displayName ?? ''}
        onChangeName={clearName}
      />
      <div className="border-b border-border bg-warm-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 max-sm:py-2.5 flex items-center justify-between gap-4 max-sm:gap-2">
          <div className="min-w-0">
            <h2 className="font-serif text-lg sm:text-xl font-semibold text-foreground truncate">
              {trip.name}
            </h2>
            {dateRange && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {dateRange}
              </p>
            )}
          </div>
          <button
            onClick={() => setStaysOpen(true)}
            className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:flex max-sm:items-center max-sm:justify-center"
            title="Stays"
            aria-label="Stays"
          >
            <BedDouble className="w-4 h-4" />
          </button>
        </div>
      </div>
      <main className="pt-8 pb-10 px-6 sm:px-8 lg:px-10 max-w-[1600px] mx-auto min-w-0 overflow-x-hidden max-sm:pt-5 max-sm:pb-8 max-sm:px-4">
        <PlanningBoard trip={trip} days={days} currentName={displayName ?? ''} getToken={getIdToken} />
      </main>

      <StaysDrawer
        open={staysOpen}
        onClose={() => setStaysOpen(false)}
        trip={trip}
        stays={stays}
        currentName={displayName ?? ''}
        onAdd={addStay}
        onUpdate={updateStay}
        onDelete={deleteStay}
      />
    </div>
  )
}
