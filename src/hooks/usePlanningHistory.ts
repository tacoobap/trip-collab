import { createContext, useContext } from 'react'

/**
 * Undo for the planning board. Dragging a card is a one-finger gesture now, so
 * a slip has to be takeable back — and every drag commits straight to
 * Firestore, where there is nothing to roll back to. So we keep the inverse
 * instead: a snapshot of where the slot was before each write, replayed
 * through the same `updateSlotSchedule` that moved it.
 *
 * Covers schedule changes (move, resize, schedule-from-shelf) and deleting a
 * slot, which re-mints the documents at their original ids. Creating a slot is
 * not undoable — delete it.
 *
 * On a shared trip this is last-write-wins, like every other edit here: if
 * someone else has moved the same slot since, undo overwrites them rather
 * than merging.
 *
 * The provider lives in `@/contexts/PlanningHistoryProvider` — split out so
 * neither file exports a component alongside a hook.
 */

export type PlanningHistoryValue = {
  /**
   * Record how to reverse a change, before making it. `revert` closes over
   * the pre-change state, so capture it at call time rather than reading it
   * back later.
   */
  record: (label: string, revert: () => Promise<void>) => void
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
