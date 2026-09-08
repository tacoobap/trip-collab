import { useState } from 'react'
import { BedDouble, ListChecks } from 'lucide-react'
import type { Trip } from '@/types/database'
import { StaysDrawer } from '@/components/stays/StaysDrawer'
import { TodosDrawer } from '@/components/todos/TodosDrawer'
import { useStays } from '@/hooks/useStays'
import { useTodos } from '@/hooks/useTodos'
import { formatTripDate } from '@/lib/utils'

interface TripBarProps {
  trip: Trip
  isMember: boolean
  currentName: string
  userUid: string
  getToken: () => Promise<string | null>
  /**
   * Icon-sized controls that belong beside To-dos and Stays — Undo on the
   * planning board. Page-level buttons go in the page body instead: a trip bar
   * crowded with a page's own actions stops reading as the trip.
   */
  actions?: React.ReactNode
}

/**
 * The trip's identity and its trip-wide tools, on every page where you're
 * still deciding — Planning and Collection. The itinerary is the output and
 * deliberately doesn't render this: it carries the trip in its own hero.
 *
 * It owns the To-dos and Stays drawers rather than taking them as props, so a
 * page gets both by rendering one component. CollectionPage subscribes to
 * stays separately for its list; two listeners on the same query share one
 * stream in the Firestore SDK, so that costs nothing.
 */
export function TripBar({
  trip,
  isMember,
  currentName,
  userUid,
  getToken,
  actions,
}: TripBarProps) {
  const { stays, addStay, updateStay, deleteStay } = useStays(trip.id)
  const {
    openTodos,
    doneTodos,
    addTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    reorderTodos,
    clearDone,
  } = useTodos(trip.id)

  const [staysOpen, setStaysOpen] = useState(false)
  const [todosOpen, setTodosOpen] = useState(false)

  const startFmt = formatTripDate(trip.start_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const endFmt = formatTripDate(trip.end_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : startFmt ?? endFmt ?? null
  const startShort = formatTripDate(trip.start_date, { month: 'short', day: 'numeric' })
  const endShort = formatTripDate(trip.end_date, { month: 'short', day: 'numeric' })
  const dateRangeShort =
    startShort && endShort ? `${startShort} – ${endShort}` : startShort ?? endShort ?? null

  const iconButton =
    'shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:flex max-sm:items-center max-sm:justify-center'

  return (
    <>
      <div className="shrink-0 border-b border-border bg-warm-white/50">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 max-sm:py-2.5 flex items-center justify-between gap-4 max-sm:gap-2">
          <div className="min-w-0">
            <h2 className="font-serif text-lg sm:text-xl font-semibold text-foreground truncate">
              {trip.name}
            </h2>
            {dateRange && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                <span className="sm:hidden">{dateRangeShort}</span>
                <span className="hidden sm:inline">{dateRange}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 max-sm:gap-0.5 shrink-0">
            {actions}
            <button
              onClick={() => setTodosOpen(true)}
              className={iconButton}
              title="To-dos"
              aria-label="To-dos"
            >
              <ListChecks className="w-4 h-4" />
            </button>
            <button
              onClick={() => setStaysOpen(true)}
              className={iconButton}
              title="Stays"
              aria-label="Stays"
            >
              <BedDouble className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <TodosDrawer
        open={todosOpen}
        onClose={() => setTodosOpen(false)}
        openTodos={openTodos}
        doneTodos={doneTodos}
        currentName={currentName}
        onAdd={(text, opts) => addTodo(text, userUid, opts)}
        onUpdate={updateTodo}
        onToggle={(todoId, done) => toggleTodo(todoId, done, userUid)}
        onDelete={deleteTodo}
        onReorder={reorderTodos}
        onClearDone={clearDone}
        canEdit={isMember}
      />

      <StaysDrawer
        open={staysOpen}
        onClose={() => setStaysOpen(false)}
        trip={trip}
        stays={stays}
        currentName={currentName}
        onAdd={addStay}
        onUpdate={updateStay}
        onDelete={deleteStay}
        getToken={getToken}
        canEdit={isMember}
      />
    </>
  )
}
