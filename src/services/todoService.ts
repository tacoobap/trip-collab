import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TripTodo } from '@/types/database'

// Matches planningService — Firestore's hard limit is 500 writes per batch.
const BATCH_LIMIT = 450

/**
 * Gap between adjacent sort_order values. Renumbering rewrites the whole open
 * list anyway, but the gap keeps appends cheap and leaves room to slot a value
 * in between two rows without touching either.
 */
const SORT_STEP = 1000

function toIso(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString()
  }
  return ''
}

function normalizeTodo(docId: string, data: Record<string, unknown>): TripTodo {
  return {
    ...data,
    id: docId,
    done: data.done === true,
    sort_order: typeof data.sort_order === 'number' ? data.sort_order : 0,
    due_date: (data.due_date as string | null) ?? null,
    assigned_to: (data.assigned_to as string | null) ?? null,
    created_at: toIso(data.created_at),
    completed_at: data.completed_at ? toIso(data.completed_at) : null,
    completed_by: (data.completed_by as string | null) ?? null,
  } as TripTodo
}

/**
 * Open items in manual order; done items below, most recently finished first.
 * Sorting client-side keeps the subscription on a single equality filter, so no
 * composite index is needed.
 */
function sortTodos(todos: TripTodo[]): TripTodo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done) {
      return (b.completed_at ?? '').localeCompare(a.completed_at ?? '')
    }
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.created_at.localeCompare(b.created_at)
  })
}

// ── Writes ─────────────────────────────────────────────────────────────────

export type CreateTodoInput = {
  trip_id: string
  text: string
  created_by: string
  due_date?: string | null
  assigned_to?: string | null
  /** Highest sort_order currently in the list; the new item lands after it. */
  after_sort_order?: number
}

export type UpdateTodoInput = {
  text?: string
  due_date?: string | null
  assigned_to?: string | null
}

/**
 * Append a to-do to the end of the open list. Returns the new document id.
 */
export async function addTodo(input: CreateTodoInput): Promise<string> {
  const ref = await addDoc(collection(db, 'trip_todos'), {
    trip_id: input.trip_id,
    text: input.text.trim(),
    done: false,
    sort_order: (input.after_sort_order ?? 0) + SORT_STEP,
    due_date: input.due_date ?? null,
    assigned_to: input.assigned_to ?? null,
    created_at: serverTimestamp(),
    created_by: input.created_by,
    completed_at: null,
    completed_by: null,
  })
  return ref.id
}

export async function updateTodo(
  todoId: string,
  data: UpdateTodoInput
): Promise<void> {
  const payload: Record<string, unknown> = { ...data }
  if (payload.text !== undefined) payload.text = (payload.text as string).trim()
  await updateDoc(doc(db, 'trip_todos', todoId), payload)
}

/**
 * Check off or restore a to-do. sort_order is left alone so un-checking returns
 * the item to the position it held in the open list.
 */
export async function setTodoDone(
  todoId: string,
  done: boolean,
  byName: string
): Promise<void> {
  await updateDoc(doc(db, 'trip_todos', todoId), {
    done,
    completed_at: done ? serverTimestamp() : null,
    completed_by: done ? byName : null,
  })
}

export async function deleteTodo(todoId: string): Promise<void> {
  await deleteDoc(doc(db, 'trip_todos', todoId))
}

/**
 * Persist a drag-reorder. `orderedIds` is the full open list in its new order;
 * only the documents whose position actually moved are written.
 */
export async function reorderTodos(
  orderedIds: string[],
  current: TripTodo[]
): Promise<void> {
  const bySortOrder = new Map(current.map((t) => [t.id, t.sort_order]))
  const changed = orderedIds
    .map((id, i) => ({ id, sort_order: (i + 1) * SORT_STEP }))
    .filter((next) => bySortOrder.get(next.id) !== next.sort_order)

  for (let i = 0; i < changed.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    changed.slice(i, i + BATCH_LIMIT).forEach(({ id, sort_order }) => {
      batch.update(doc(db, 'trip_todos', id), { sort_order })
    })
    await batch.commit()
  }
}

/**
 * Delete every checked-off item in one go.
 */
export async function clearDoneTodos(todoIds: string[]): Promise<void> {
  for (let i = 0; i < todoIds.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    todoIds.slice(i, i + BATCH_LIMIT).forEach((id) => {
      batch.delete(doc(db, 'trip_todos', id))
    })
    await batch.commit()
  }
}

// ── Subscribe ───────────────────────────────────────────────────────────────

export function subscribeToTodos(
  tripId: string,
  onChange: (todos: TripTodo[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(collection(db, 'trip_todos'), where('trip_id', '==', tripId))

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) =>
        normalizeTodo(d.id, d.data() as Record<string, unknown>)
      )
      onChange(sortTodos(list))
    },
    (err) => {
      if (onError) {
        onError(err)
      } else {
        console.error('subscribeToTodos', err)
      }
    }
  )
}
