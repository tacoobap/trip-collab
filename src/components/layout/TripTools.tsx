import { useState } from 'react'
import { BedDouble, ListChecks } from 'lucide-react'
import type { Trip } from '@/types/database'
import { StaysDrawer } from '@/components/stays/StaysDrawer'
import { TodosDrawer } from '@/components/todos/TodosDrawer'
import { useStays } from '@/hooks/useStays'
import { useTodos } from '@/hooks/useTodos'
import { cn } from '@/lib/utils'
import type { MenuItem } from '@/components/layout/UserMenu'

interface UseTripToolsArgs {
  /** Null until the trip loads — this hook is called above the page's early returns. */
  trip: Trip | null | undefined
  isMember: boolean
  currentName: string
  userUid: string | undefined
  getToken: () => Promise<string | null>
  /** Dark styling, for the itinerary's over-hero header. */
  isDark?: boolean
}

/**
 * The trip-wide drawers — To-dos and Stays — as three pieces the caller places
 * separately.
 *
 * `buttons` go into the header's action slot and hide below `sm`, where the tab
 * row needs their width. `menuItems` is the same two actions as menu rows,
 * which `UserMenu` shows only below `sm` — so they are offered exactly once at
 * every width. `drawers` is rendered at page level.
 *
 * The drawers are separate because the header carries `backdrop-blur`, and an
 * element with a `backdrop-filter` becomes the containing block for any
 * `position: fixed` descendant. A drawer rendered inside the header would be
 * positioned against the header instead of the viewport, which collapses it to
 * a sliver at the top of the page.
 */
export function useTripTools({
  trip,
  isMember,
  currentName,
  userUid,
  getToken,
  isDark = false,
}: UseTripToolsArgs) {
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

  const btn = cn(
    'shrink-0 p-2 rounded-md transition-colors touch-manipulation',
    'max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:flex max-sm:items-center max-sm:justify-center',
    isDark
      ? 'text-white/70 hover:text-white hover:bg-white/15'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
  )

  const buttons = (
    <>
      <button onClick={() => setTodosOpen(true)} className={cn(btn, 'max-sm:hidden')} title="To-dos" aria-label="To-dos">
        <ListChecks className="w-4 h-4" />
      </button>
      <button onClick={() => setStaysOpen(true)} className={cn(btn, 'max-sm:hidden')} title="Stays" aria-label="Stays">
        <BedDouble className="w-4 h-4" />
      </button>
    </>
  )

  const menuItems: MenuItem[] = [
    { label: 'To-dos', Icon: ListChecks, onSelect: () => setTodosOpen(true) },
    { label: 'Stays', Icon: BedDouble, onSelect: () => setStaysOpen(true) },
  ]

  const drawers = !trip || !userUid ? null : (
    <>
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

  const ready = Boolean(trip && userUid)
  return {
    buttons: ready ? buttons : null,
    menuItems: ready ? menuItems : [],
    drawers,
  }
}
