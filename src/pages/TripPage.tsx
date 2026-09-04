import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanningBoard } from '@/components/planning/PlanningBoard'
import { StaysDrawer } from '@/components/stays/StaysDrawer'
import { TodosDrawer } from '@/components/todos/TodosDrawer'
import { useDisplayName } from '@/hooks/useDisplayName'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useTrip } from '@/hooks/useTrip'
import { useStays } from '@/hooks/useStays'
import { useTodos } from '@/hooks/useTodos'
import { useTripMembers } from '@/hooks/useTripMembers'
import { Button } from '@/components/ui/button'
import { joinTrip } from '@/services/tripService'
import { formatTripDate } from '@/lib/utils'
import { firebaseProjectId } from '@/lib/firebase'
import { Loader2 } from 'lucide-react'
import { EditTripModal } from '@/components/trips/EditTripModal'
import { TripIdentity } from '@/components/trips/TripIdentity'
import { TripActions } from '@/components/trips/TripActions'
import { PlanningHistoryProvider } from '@/contexts/PlanningHistoryProvider'

export function TripPage() {
  const { slug } = useParams<{ slug: string }>()
  const { displayName } = useDisplayName()
  const { user, loading: authLoading, getIdToken } = useAuth()
  const { addToast } = useToast()
  const { trip, days, travelers, loading, error, isMember, isOwner } = useTrip(slug, user?.uid)
  const { stays, addStay, updateStay, deleteStay } = useStays(trip?.id)
  const {
    openTodos,
    doneTodos,
    addTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    reorderTodos,
    clearDone,
  } = useTodos(trip?.id)
  const [staysOpen, setStaysOpen] = useState(false)
  const [todosOpen, setTodosOpen] = useState(false)
  // Fetched only once the to-dos sheet is opened, since that's the only thing
  // that needs a roster. `travelers` alone misses a member who hasn't proposed
  // anything yet, which is most of them early in a trip.
  const { memberNames } = useTripMembers(trip?.id, getIdToken, todosOpen)
  const todoPeople = useMemo(
    () => [...memberNames, ...travelers],
    [memberNames, travelers]
  )
  const [editTripOpen, setEditTripOpen] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [copied, setCopied] = useState(false)

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

  const handleCopyInviteLink = async () => {
    if (!trip) return
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/trip/${trip.slug}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        addToast('Link copied to clipboard.', { variant: 'success' })
        window.setTimeout(() => setCopied(false), 2000)
      } else {
        window.prompt('Copy this link', url)
      }
    } catch (err) {
      console.error('Failed to copy invite link', err)
      window.prompt('Copy this link', url)
    }
  }

  if (authLoading || loading) {
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
          {user && import.meta.env.DEV && (
            <>
              <p className="text-xs text-muted-foreground mb-1 font-mono break-all max-w-md mx-auto">
                Signed-in UID: {user.uid}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                App project: {firebaseProjectId} — in Firebase Console confirm this matches your project and that Firestore rules are deployed.
              </p>
            </>
          )}
          {!user && (
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to view this trip.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {!user && (
              <a
                href={slug ? `/sign-in?from=/trip/${slug}` : '/sign-in'}
                className="text-sm text-primary hover:underline"
              >
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-serif font-semibold text-foreground mb-2">
            Sign in to view this trip
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            You need to be signed in to access trip plans.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={slug ? `/sign-in?from=/trip/${slug}` : '/sign-in'}
              className="text-sm text-primary hover:underline"
            >
              Sign in with Google
            </a>
            <a href="/" className="text-sm text-primary hover:underline">
              ← Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }

  const startFmt = formatTripDate(trip.start_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const endFmt = formatTripDate(trip.end_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : startFmt ?? endFmt ?? null
  const startShort = formatTripDate(trip.start_date, { month: 'short', day: 'numeric' })
  const endShort = formatTripDate(trip.end_date, { month: 'short', day: 'numeric' })
  const dateRangeShort =
    startShort && endShort ? `${startShort} – ${endShort}` : startShort ?? endShort ?? null

  // Rendered twice: folded into the page header from `lg` up, and in the trip
  // bar below that. Same nodes, so the two can't drift apart.
  const tripActions = (
    <TripActions
      onOpenTodos={() => setTodosOpen(true)}
      onOpenStays={() => setStaysOpen(true)}
      onCopyInviteLink={handleCopyInviteLink}
      copied={copied}
    />
  )
  const identityProps = {
    name: trip.name,
    dateRange,
    dateRangeShort,
    canEdit: isMember ?? false,
    onEdit: () => setEditTripOpen(true),
  }

  return (
    <PlanningHistoryProvider>
    <div className="h-dvh flex flex-col bg-background">
      <PageHeader
        trip={trip}
        currentName={displayName ?? ''}
        title={<TripIdentity {...identityProps} dense />}
        actions={tripActions}
      />
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

      {/* Trip bar — only below `lg`, where the header has no room for the trip
          name beside the nav. From `lg` up this is folded into the header. */}
      <div className="shrink-0 border-b border-border bg-warm-white/50 lg:hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 max-sm:py-2.5 flex items-center justify-between gap-4 max-sm:gap-2">
          <TripIdentity {...identityProps} />
          <div className="flex items-center gap-2 max-sm:gap-0.5 shrink-0">{tripActions}</div>
        </div>
      </div>
      {/* The time grid owns its own two-axis scroll region, so the page
          itself must not scroll: cap the column at the viewport and let the
          board fill what's left. */}
      <main className="flex-1 min-h-0 flex flex-col pt-5 px-5 sm:px-6 max-w-7xl mx-auto w-full min-w-0 max-sm:pt-3 lg:pt-3">
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

      <TodosDrawer
        open={todosOpen}
        onClose={() => setTodosOpen(false)}
        openTodos={openTodos}
        doneTodos={doneTodos}
        currentName={displayName ?? ''}
        travelers={todoPeople}
        onAdd={(text, opts) => addTodo(text, displayName ?? '', opts)}
        onUpdate={updateTodo}
        onToggle={(todoId, done) => toggleTodo(todoId, done, displayName ?? '')}
        onDelete={deleteTodo}
        onReorder={reorderTodos}
        onClearDone={clearDone}
        canEdit={isMember ?? false}
      />

      <StaysDrawer
        open={staysOpen}
        onClose={() => setStaysOpen(false)}
        trip={trip}
        stays={stays}
        currentName={displayName ?? ''}
        onAdd={addStay}
        onUpdate={updateStay}
        onDelete={deleteStay}
        getToken={getIdToken}
        canEdit={isMember ?? false}
      />
    </div>
    </PlanningHistoryProvider>
  )
}

