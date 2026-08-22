import { useCallback, useEffect, useState } from 'react'

export function shareUrlFor(token: string): string {
  return `${window.location.origin}/i/${token}`
}

/**
 * Read and control a trip's public share token.
 *
 * The token itself is minted by the `share-link` function — the browser never
 * writes the field, and the value comes from a server-side CSPRNG.
 */
export function useShareLink(
  tripId: string | undefined,
  initialToken: string | null,
  getIdToken: () => Promise<string | null>
) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // The trip loads asynchronously, so adopt its token once it arrives
  useEffect(() => {
    setToken(initialToken)
  }, [initialToken])

  const call = useCallback(
    async (action: 'enable' | 'disable'): Promise<string | null> => {
      if (!tripId) return null
      setBusy(true)
      setError('')
      try {
        const idToken = await getIdToken()
        if (!idToken) throw new Error('Sign in to share this trip.')
        const res = await fetch('/.netlify/functions/share-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ tripId, action }),
        })
        const data = (await res.json()) as { token?: string | null; error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not update the link.')
        setToken(data.token ?? null)
        return data.token ?? null
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
        return null
      } finally {
        setBusy(false)
      }
    },
    [tripId, getIdToken]
  )

  const enable = useCallback(() => call('enable'), [call])
  const disable = useCallback(() => call('disable'), [call])

  return { token, busy, error, enable, disable }
}
