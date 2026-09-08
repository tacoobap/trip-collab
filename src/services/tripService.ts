import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  orderBy,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { Trip } from '@/types/database'

function toTrip(d: { id: string; data: () => Record<string, unknown> | undefined }): Trip {
  const data = d.data() ?? {}
  return {
    ...data,
    id: d.id,
    destinations: Array.isArray(data.destinations) ? data.destinations : [],
  } as Trip
}

/**
 * Ask the server which trip a slug belongs to.
 *
 * Only reachable for a signed-in caller, and it returns nothing but the id —
 * see `netlify/functions/resolve-trip.ts` for why the lookup lives there.
 */
async function resolveTripIdBySlug(slug: string): Promise<string | null> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) return null

  const res = await fetch('/.netlify/functions/resolve-trip', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ slug }),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Could not look up that trip.')

  const data = (await res.json()) as { id?: string }
  return typeof data.id === 'string' && data.id ? data.id : null
}

/**
 * Load a trip by slug. Returns null if not found; throws on permission or network errors.
 *
 * A slug can't be resolved with `where('slug', '==', slug)` any more: the list
 * rule in `firestore.rules` scopes a query over /trips to trips you're on, so
 * that query is denied outright rather than returning nothing. Two steps
 * instead — your own trips first, which is the common case and costs the reads
 * the trips list already makes, then the server for a trip you haven't joined,
 * which is the invite flow arriving for the first time.
 */
export async function getTripBySlug(
  slug: string,
  userUid: string
): Promise<{ id: string; trip: Trip } | null> {
  const mine = await listUserTrips(userUid)
  const match = mine.find((t) => t.slug === slug)
  if (match) return { id: match.id, trip: match }

  const id = await resolveTripIdBySlug(slug)
  if (!id) return null

  // Permitted by `allow get` for any signed-in user — this is the trip an
  // invitee sees before deciding to join.
  const snap = await getDoc(doc(db, 'trips', id))
  if (!snap.exists()) return null
  return { id: snap.id, trip: toTrip(snap) }
}

/**
 * Add the user to the trip's member_uids. Idempotent (arrayUnion).
 */
export async function joinTrip(tripId: string, userUid: string): Promise<void> {
  if (!tripId || !userUid) {
    throw new Error('Missing tripId or userUid')
  }
  await updateDoc(doc(db, 'trips', tripId), {
    member_uids: arrayUnion(userUid),
  })
}

export type UpdateTripMetaInput = {
  name?: string
  destinations?: string[]
  start_date?: string | null
  end_date?: string | null
}

/**
 * Update trip name, date range, or destinations. Slug is not changed.
 */
export async function updateTripMeta(
  tripId: string,
  data: UpdateTripMetaInput
): Promise<void> {
  await updateDoc(doc(db, 'trips', tripId), data)
}

/**
 * List trips the user owns or is a member of, merged and sorted by created_at desc.
 */
export async function listUserTrips(userUid: string): Promise<Trip[]> {
  const [ownedSnap, sharedSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'trips'),
        where('owner_uid', '==', userUid),
        orderBy('created_at', 'desc')
      )
    ),
    getDocs(
      query(
        collection(db, 'trips'),
        where('member_uids', 'array-contains', userUid),
        orderBy('created_at', 'desc')
      )
    ),
  ])
  const owned = ownedSnap.docs.map((d) => toTrip(d))
  const shared = sharedSnap.docs.map((d) => toTrip(d))
  const byId = new Map<string, Trip>()
  for (const t of [...owned, ...shared]) {
    byId.set(t.id, t)
  }
  return [...byId.values()].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}
