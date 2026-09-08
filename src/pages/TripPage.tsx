import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanningBoard } from '@/components/planning/PlanningBoard'
import { TripBar } from '@/components/layout/TripBar'
import { useDisplayName } from '@/hooks/useDisplayName'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useTrip } from '@/hooks/useTrip'
import { Button } from '@/components/ui/button'
import { joinTrip } from '@/services/tripService'
import { firebaseProjectId } from '@/lib/firebase'
import { Loader2 } from 'lucide-react'
import { EditTripModal } from '@/components/trips/EditTripModal'
import { TripPeopleProvider } from '@/contexts/TripPeopleContext'
import { PlanningHistoryProvider } from '@/contexts/PlanningHistoryProvider'
import { TripInvitePreview } from '@/components/marketing/TripInvitePreview'
import { UndoButton } from '@/components/planning/UndoButton'

export function TripPage() {
  const { slug } = useParams<{ slug: string }>()
  const { displayName } = useDisplayName()
  const { user, loading: authLoading, getIdToken } = useAuth()
  const { addToast } = useToast()
  const { trip, days, loading, error, isMember, isOwner } = useTrip(slug, user?.uid)

  const [editTripOpen, setEditTripOpen] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const handleJoinTrip = async () => {
    if (!trip || !user || joining) return
    setJoining(true)
    setJoinError('')
    try {
      await joinTrip(trip.id, user.uid)
      addToast("You've joined the trip.", { variant: 'success' })
    } catch (err) {
      console.error('Failed to join trip', err)
      setJoinError('Failed to join trip. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Signed out, this check has to come before the trip loads at all: rules deny
  // an unauthenticated read, so waiting for `useTrip` only ever arrives at
  // "Trip not found" for someone who was handed a perfectly good invite link.
  if (!user) {
    return <TripInvitePreview slug={slug} />
  }

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
          {import.meta.env.DEV && (
            <>
              <p className="text-xs text-muted-foreground mb-1 font-mono break-all max-w-md mx-auto">
                Signed-in UID: {user.uid}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                App project: {firebaseProjectId} — in Firebase Console confirm this matches your project and that Firestore rules are deployed.
              </p>
            </>
          )}
          <a href="/home" className="text-sm text-primary hover:underline">
            ← Back to home
          </a>
        </div>
      </div>
    )
  }

  return (
    <TripPeopleProvider tripId={trip.id}>
    <PlanningHistoryProvider>
    <div className="h-dvh flex flex-col bg-background">
      <PageHeader trip={trip} currentName={displayName ?? ''} />
      {user && isMember === false && (
        <div className="shrink-0 border-b border-warning/30 bg-warning/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-warning-foreground">
              You're viewing this trip as a guest. You can't edit the plan, add ideas, or change stays until you join.
            </p>
            <Button
              size="sm"
              onClick={handleJoinTrip}
              disabled={joining}
              className="shrink-0 bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {joining ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Joining…
                </>
              ) : (
                'Join this trip'
              )}
            </Button>
          </div>
          {joinError && (
            <p className="max-w-7xl mx-auto px-5 sm:px-6 pb-2.5 text-xs text-destructive">
              {joinError}
            </p>
          )}
        </div>
      )}

      <TripBar
        trip={trip}
        isMember={isMember ?? false}
        currentName={displayName ?? ''}
        userUid={user.uid}
        getToken={getIdToken}
        actions={<UndoButton />}
      />
      {/* The time grid owns its own two-axis scroll region, so the page
          itself must not scroll: cap the column at the viewport and let the
          board fill what's left. */}
      <main className="flex-1 min-h-0 flex flex-col pt-4 px-5 sm:px-6 max-w-7xl mx-auto w-full min-w-0 max-sm:pt-3">
        <PlanningBoard
          trip={trip}
          days={days}
          currentName={displayName ?? ''}
          getToken={getIdToken}
          isMember={isMember ?? false}
          isOwner={isOwner}
          onOpenEditTrip={() => setEditTripOpen(true)}
        />
      </main>

      <EditTripModal
        open={editTripOpen}
        onOpenChange={setEditTripOpen}
        trip={trip}
        days={days}
      />
    </div>
    </PlanningHistoryProvider>
    </TripPeopleProvider>
  )
}

