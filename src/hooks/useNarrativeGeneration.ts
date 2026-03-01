import { useCallback, useRef, useState } from 'react'
import { generateNarrative } from '@/lib/generateNarrative'
import type { NarrativeResult } from '@/lib/generateNarrative'
import type { Trip, DayWithSlots } from '@/types/database'

export type NarrativeGenerationStatus = 'idle' | 'generating'

export interface UseNarrativeGenerationResult {
  generate: () => Promise<NarrativeResult | null>
  status: NarrativeGenerationStatus
  error: string
  clearError: () => void
}

/**
 * Encapsulates AI narrative generation: single in-flight call, error state, stale-response guard.
 * Caller is responsible for persisting the result (trip/days/proposals writes, image fetch).
 */
export function useNarrativeGeneration(
  trip: Trip | null,
  days: DayWithSlots[]
): UseNarrativeGenerationResult {
  const [status, setStatus] = useState<NarrativeGenerationStatus>('idle')
  const [error, setError] = useState('')
  const runIdRef = useRef(0)
  const generatingRef = useRef(false)

  const clearError = useCallback(() => setError(''), [])

  const generate = useCallback(async (): Promise<NarrativeResult | null> => {
    if (!trip) return null
    if (generatingRef.current) return null
    generatingRef.current = true

    const runId = ++runIdRef.current
    setStatus('generating')
    setError('')

    try {
      const result = await generateNarrative(trip, days)
      if (runIdRef.current !== runId) return null
      setStatus('idle')
      return result
    } catch (err) {
      if (runIdRef.current !== runId) return null
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setStatus('idle')
      return null
    } finally {
      generatingRef.current = false
    }
  }, [trip, days])

  return { generate, status, error, clearError }
}
