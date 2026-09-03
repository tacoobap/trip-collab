import { createContext, useContext } from 'react'

/**
 * Undo for the planning board. Dragging a card is a one-finger gesture now, so
 * a slip has to be takeable back — and every drag commits straight to
 * Firestore, where there is nothing to roll back to. So we keep the inverse
 * instead: a snapshot of where the slot was before each write, replayed
 * through the same `updateSlotSchedule` that moved it.
 *
 * Scope is deliberately narrow: schedule changes only (move, resize,
 * schedule-from-shelf). Creating and deleting slots are not undoable, since
 * putting a deleted slot and its proposals back means re-minting documents.
 *
 * On a shared trip this is last-write-wins, like every other edit here: if
 * someone else has moved the same slot since, undo overwrites them rather
 * than merging.
 *
 * The provider lives in `@/contexts/PlanningHistoryProvider` — split out so
 * neither file exports a component alongside a hook.
 */

/** Everything needed to put one slot back where it was. */
export type ScheduleSnapshot = {
  slotId: string
  day_id: string
  start_minutes: number | null
  duration_minutes: number
  lockedProposalId: string | null
}

export type PlanningHistoryValue = {
  /** Call with the slot's state *before* a schedule write goes out. */
  record: (label: string, before: ScheduleSnapshot) => void
  undo: () => Promise<void>
  canUndo: boolean
  /** What the next undo would put back, so the button can name it. */
  lastLabel: string | null
  undoing: boolean
}

export const PlanningHistoryContext = createContext<PlanningHistoryValue>({
  record: () => {},
  undo: async () => {},
  canUndo: false,
  lastLabel: null,
  undoing: false,
})

export function usePlanningHistory(): PlanningHistoryValue {
  return useContext(PlanningHistoryContext)
}
