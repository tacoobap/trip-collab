import { useEffect, useMemo, useState } from 'react'

type MemberProfile = { uid: string; display_name: string }

/**
 * Display names of everyone on the trip, for pickers that assign work to a person.
 *
 * These can't be read from the browser: `firestore.rules` restricts
 * /users/{uid} to that same user, so a client only ever sees its own profile.
 * The `trip-members` function reads them with the Admin SDK instead.
 *
 * `enabled` defers the request until something actually needs the roster, so a
 * page that never opens the picker doesn't pay for it.
 */
export function useTripMembers(
  tripId: string | undefined,
  getIdToken: () => Promise<string | null>,
  enabled = true
) {
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !tripId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const idToken = await getIdToken()
        if (!idToken) throw new Error('Not signed in')
        const res = await fetch('/.netlify/functions/trip-members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ tripId }),
        })
        const data = (await res.json()) as {
          members?: MemberProfile[]
          error?: string
        }
        if (!res.ok) throw new Error(data.error || 'Could not load trip members.')
        if (!cancelled) setMembers(data.members ?? [])
      } catch (err) {
        // Non-fatal: the caller falls back to names harvested from trip content.
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load trip members.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tripId, enabled, getIdToken])

  // Stable identity so callers can memoize on it.
  const memberNames = useMemo(() => members.map((m) => m.display_name), [members])

  return { members, memberNames, loading, error }
}
