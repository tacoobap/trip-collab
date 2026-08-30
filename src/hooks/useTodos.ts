import { useState, useEffect, useMemo, useCallback } from 'react'
import type { TripTodo } from '@/types/database'
import {
  addTodo as addTodoService,
  clearDoneTodos as clearDoneTodosService,
  deleteTodo as deleteTodoService,
  reorderTodos as reorderTodosService,
  setTodoDone as setTodoDoneService,
  subscribeToTodos,
  updateTodo as updateTodoService,
} from '@/services/todoService'
import type { UpdateTodoInput } from '@/services/todoService'

const EMPTY: TripTodo[] = []

/** Snapshot state is tagged with the trip it came from, so switching trips
 *  derives an empty, loading list rather than needing a synchronous reset. */
type Snapshot = { tripId: string; todos: TripTodo[] }
type SubError = { tripId: string; error: unknown }

export function useTodos(tripId: string | undefined) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [subError, setSubError] = useState<SubError | null>(null)

  useEffect(() => {
    if (!tripId) return
    return subscribeToTodos(
      tripId,
      (todos) => setSnapshot({ tripId, todos }),
      (error) => setSubError({ tripId, error })
    )
  }, [tripId])

  const fresh = !!tripId && snapshot?.tripId === tripId
  const todos = fresh ? snapshot.todos : EMPTY
  const loading = !!tripId && !fresh
  const error = subError && subError.tripId === tripId ? subError.error : null

  const openTodos = useMemo(() => todos.filter((t) => !t.done), [todos])
  const doneTodos = useMemo(() => todos.filter((t) => t.done), [todos])

  const addTodo = useCallback(
    async (
      text: string,
      createdBy: string,
      opts?: { assigned_to?: string | null; due_date?: string | null }
    ) => {
      if (!tripId || !text.trim()) return
      const maxSortOrder = todos.reduce(
        (max, t) => (t.sort_order > max ? t.sort_order : max),
        0
      )
      await addTodoService({
        trip_id: tripId,
        text,
        created_by: createdBy,
        assigned_to: opts?.assigned_to ?? null,
        due_date: opts?.due_date ?? null,
        after_sort_order: maxSortOrder,
      })
    },
    [tripId, todos]
  )

  const updateTodo = useCallback(async (todoId: string, data: UpdateTodoInput) => {
    await updateTodoService(todoId, data)
  }, [])

  const toggleTodo = useCallback(
    async (todoId: string, done: boolean, byName: string) => {
      await setTodoDoneService(todoId, done, byName)
    },
    []
  )

  const deleteTodo = useCallback(async (todoId: string) => {
    await deleteTodoService(todoId)
  }, [])

  const reorderTodos = useCallback(
    async (orderedIds: string[]) => {
      await reorderTodosService(orderedIds, openTodos)
    },
    [openTodos]
  )

  const clearDone = useCallback(async () => {
    if (doneTodos.length === 0) return
    await clearDoneTodosService(doneTodos.map((t) => t.id))
  }, [doneTodos])

  return {
    todos,
    openTodos,
    doneTodos,
    loading,
    error,
    addTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    reorderTodos,
    clearDone,
  }
}
