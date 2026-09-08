import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useDisplayName } from '@/hooks/useDisplayName'
import { useTripMembers } from '@/hooks/useTripMembers'

export type Person = { uid: string; name: string }

export type TripPeople = {
  /** The signed-in user's uid, which is what new documents record. */
  me: string | null
  /** Everyone on the trip, for pickers. */
  people: Person[]
  /** A name to show for a stored identity. */
  nameFor: (id: string | null | undefined, fallback?: string | null) => string
  /** Whether a stored identity is the signed-in user. */
  isMe: (id: string | null | undefined) => boolean
  loading: boolean
}

const empty: TripPeople = {
  me: null,
  people: [],
  nameFor: (id, fallback) => fallback || id || '',
  isMe: () => false,
  loading: false,
}

const TripPeopleContext = createContext<TripPeople>(empty)

/**
 * A Firebase uid: 28 characters of base62 in practice, and never with a space
 * in it. Used to tell a uid apart from the display name that the same field
 * held before the migration, so an un-migrated document still renders a name
 * rather than showing the raw string as if it were one.
 */
function looksLikeUid(value: string): boolean {
  return /^[A-Za-z0-9]{20,}$/.test(value)
}

/**
 * Who's who on a trip.
 *
 * Votes, likes, assignments and authorship are keyed on uid, so almost every
 * surface needs to turn one back into a name. The roster comes from the
 * `trip-members` function, since `firestore.rules` won't let a browser read
 * anyone else's profile, and it's fetched once per trip rather than per
 * component.
 */
export function TripPeopleProvider({
  tripId,
  children,
}: {
  tripId: string | undefined
  children: ReactNode
}) {
  const value = useTripPeopleValue(tripId)
  return <TripPeopleContext.Provider value={value}>{children}</TripPeopleContext.Provider>
}

/**
 * The same roster, for a component that mounts the provider and so can't
 * consume it. The underlying fetch is shared, not repeated.
 */
export function useTripPeopleValue(tripId: string | undefined): TripPeople {
  const { user, getIdToken } = useAuth()
  const { displayName } = useDisplayName()
  const { members, loading } = useTripMembers(tripId, getIdToken)

  const value = useMemo<TripPeople>(() => {
    const byUid = new Map(members.map((m) => [m.uid, m.display_name]))
    const me = user?.uid ?? null

    return {
      me,
      loading,
      people: members.map((m) => ({ uid: m.uid, name: m.display_name })),
      nameFor: (id, fallback) => {
        if (!id) return fallback || ''
        const known = byUid.get(id)
        if (known) return known
        if (fallback) return fallback
        // Not on the roster: either a name written before the migration, or
        // someone who has since left the trip.
        return looksLikeUid(id) ? 'Someone' : id
      },
      isMe: (id) => {
        if (!id) return false
        if (me && id === me) return true
        // Documents written before the migration hold a display name here.
        return !!displayName && id === displayName
      },
    }
  }, [members, loading, user?.uid, displayName])

  return value
}

export function useTripPeople(): TripPeople {
  return useContext(TripPeopleContext)
}

/**
 * Add or remove the signed-in user from a votes/likes array.
 *
 * Removal goes through `isMe` rather than matching the uid, so un-voting also
 * clears an entry left by the same person under their display name before the
 * migration — otherwise the vote would look stuck.
 */
export function toggleMine(
  list: string[],
  me: string,
  isMe: (id: string | null | undefined) => boolean
): string[] {
  return list.some((entry) => isMe(entry))
    ? list.filter((entry) => !isMe(entry))
    : [...list, me]
}
