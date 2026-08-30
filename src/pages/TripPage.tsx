import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { joinTrip } from '@/services/tripService'
import { formatTripDate } from '@/lib/utils'
import { firebaseProjectId } from '@/lib/firebase'
import { Loader2, BedDouble, ListChecks, Pencil } from 'lucide-react'
import { EditTripModal } from '@/components/trips/EditTripModal'

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

  return (
    <div className="min-h-screen bg-background">
      <PageHeader trip={trip} currentName={displayName ?? ''} />
      {user && isMember === false && (
        <div className="border-b border-warning/30 bg-warning/10">
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

      <div className="border-b border-border bg-warm-white/50">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 max-sm:py-2.5 flex items-center justify-between gap-4 max-sm:gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg sm:text-xl font-semibold text-foreground truncate">
                {trip.name}
              </h2>
              {(isMember ?? false) && (
                <button
                  type="button"
                  onClick={() => setEditTripOpen(true)}
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title="Edit trip"
                  aria-label="Edit trip"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            {dateRange && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {dateRange}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTodosOpen(true)}
              className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:flex max-sm:items-center max-sm:justify-center"
              title="To-dos"
              aria-label="To-dos"
            >
              <ListChecks className="w-4 h-4" />
            </button>
            <button
              onClick={() => setStaysOpen(true)}
              className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:flex max-sm:items-center max-sm:justify-center"
              title="Stays"
              aria-label="Stays"
            >
              <BedDouble className="w-4 h-4" />
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyInviteLink}
              className="max-sm:min-h-[40px]"
            >
              {copied ? 'Link copied' : 'Invite link'}
            </Button>
          </div>
        </div>
      </div>
      <main className="pt-8 pb-10 px-5 sm:px-6 max-w-7xl mx-auto min-w-0 overflow-x-hidden max-sm:pt-5 max-sm:pb-8">
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
        travelers={travelers}
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
        canEdit={isMember ?? false}
      />
    </div>
  )
}

