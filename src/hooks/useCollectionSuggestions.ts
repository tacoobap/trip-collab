import { useCallback, useRef, useState } from 'react'
import { suggestCollectionItems } from '@/lib/suggestCollectionItems'
import type { CollectionSuggestion } from '@/lib/suggestCollectionItems'
import type { Trip, DayWithSlots } from '@/types/database'

export type CollectionSuggestionsStatus = 'idle' | 'loading'

export interface UseCollectionSuggestionsResult {
  suggestions: CollectionSuggestion[]
  getSuggestions: (vibeSentence?: string | null) => Promise<void>
  status: CollectionSuggestionsStatus
  error: string
  clearError: () => void
}

/**
 * Encapsulates AI collection suggestions: single in-flight call, error state, stale-response guard.
 */
export function useCollectionSuggestions(
  trip: Trip | null,
  days: DayWithSlots[]
): UseCollectionSuggestionsResult {
  const [suggestions, setSuggestions] = useState<CollectionSuggestion[]>([])
  const [status, setStatus] = useState<CollectionSuggestionsStatus>('idle')
  const [error, setError] = useState('')
  const loadingRef = useRef(false)
  const runIdRef = useRef(0)

  const clearError = useCallback(() => setError(''), [])

  const getSuggestions = useCallback(
    async (vibeSentence?: string | null): Promise<void> => {
      if (!trip) return
      if (loadingRef.current) return
      loadingRef.current = true

      const runId = ++runIdRef.current
      setStatus('loading')
      setError('')
      setSuggestions([])

      try {
        const vibe = typeof vibeSentence === 'string' ? vibeSentence.trim() || null : null
        const { suggestions: list } = await suggestCollectionItems(trip, days, vibe)
        if (runIdRef.current !== runId) return
        setSuggestions(list)
      } catch (err) {
        if (runIdRef.current !== runId) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setSuggestions([])
      } finally {
        loadingRef.current = false
        if (runIdRef.current === runId) setStatus('idle')
      }
    },
    [trip, days]
  )

  return { suggestions, getSuggestions, status, error, clearError }
}
