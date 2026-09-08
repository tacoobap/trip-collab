import { useEffect, useMemo, useState } from 'react'

export type MemberProfile = { uid: string; display_name: string }

/**
 * One roster per trip, shared across surfaces and remounts. Identity is keyed on
 * uid, so nearly every surface needs this to render a name, and a page
 * transition re-fetching it is pure waste.
 */
const rosterCache = new Map<string, MemberProfile[]>()

/**
 * Requests in flight, so the several hooks that mount at once for one trip
 * share a single call rather than racing.
 */
const inFlight = new Map<string, Promise<MemberProfile[]>>()

async function fetchRoster(
  tripId: string,
  getIdToken: () => Promise<string | null>
): Promise<MemberProfile[]> {
  const existing = inFlight.get(tripId)
  if (existing) return existing

  const request = (async () => {
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
    const data = (await res.json()) as { members?: MemberProfile[]; error?: string }
    if (!res.ok) throw new Error(data.error || 'Could not load trip members.')
    const members = data.members ?? []
    rosterCache.set(tripId, members)
    return members
  })()

  inFlight.set(tripId, request)
  try {
    return await request
  } finally {
    inFlight.delete(tripId)
  }
}

/**
 * Everyone on the trip, as uid → display name.
 *
 * These can't be read from the browser: `firestore.rules` restricts
 * /users/{uid} to that same user, so a client only ever sees its own profile.
 * The `trip-members` function reads them with the Admin SDK instead.
 *
 * Cached names render immediately and are then revalidated, so someone who
 * joined since the last fetch still turns up.
 *
 * `enabled` defers the request until something actually needs the roster.
 */
export function useTripMembers(
  tripId: string | undefined,
  getIdToken: () => Promise<string | null>,
  enabled = true
) {
  const [members, setMembers] = useState<MemberProfile[]>(
    () => (tripId && rosterCache.get(tripId)) || []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !tripId) return
    let cancelled = false

    const cached = rosterCache.get(tripId)
    if (cached) setMembers(cached)
    else setLoading(true)

    fetchRoster(tripId, getIdToken)
      .then((next) => {
        if (!cancelled) {
          setMembers(next)
          setError('')
        }
      })
      .catch((err: unknown) => {
        // Non-fatal: names fall back to whatever the documents themselves hold.
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load trip members.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tripId, enabled, getIdToken])

  // Stable identity so callers can memoize on it.
  const memberNames = useMemo(() => members.map((m) => m.display_name), [members])

  return { members, memberNames, loading, error }
}
