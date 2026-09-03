import { useEffect, useState, type ReactNode } from 'react'
import { PlanningHistoryContext, type PlanningHistoryValue } from '@/hooks/usePlanningHistory'

type Entry = { label: string; revert: () => Promise<void> }

const MAX_HISTORY = 25

/** See `@/hooks/usePlanningHistory` for what this is for and what it covers. */
export function PlanningHistoryProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Entry[]>([])
  const [undoing, setUndoing] = useState(false)

  const record = (label: string, revert: () => Promise<void>) => {
    setStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), { label, revert }])
  }

  const undo = async () => {
    const entry = stack[stack.length - 1]
    if (!entry || undoing) return
    setUndoing(true)
    try {
      await entry.revert()
      // Only drop it once the write lands, so a failed undo stays available.
      setStack((prev) => prev.slice(0, -1))
    } catch (err) {
      console.error('Undo failed', err)
    } finally {
      setUndoing(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'z' || !(e.metaKey || e.ctrlKey) || e.shiftKey) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      e.preventDefault()
      void undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const value: PlanningHistoryValue = {
    record,
    undo,
    canUndo: stack.length > 0,
    lastLabel: stack[stack.length - 1]?.label ?? null,
    undoing,
  }

  return (
    <PlanningHistoryContext.Provider value={value}>{children}</PlanningHistoryContext.Provider>
  )
}
