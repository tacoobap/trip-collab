import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Trip } from '@/types/database'

/**
 * Load a trip by slug. Returns null if not found; throws on permission or network errors.
 */
export async function getTripBySlug(
  slug: string
): Promise<{ id: string; trip: Trip } | null> {
  const snap = await getDocs(
    query(collection(db, 'trips'), where('slug', '==', slug))
  )
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  const data = docSnap.data()
  const trip: Trip = {
    id: docSnap.id,
    ...data,
    destinations: Array.isArray(data.destinations) ? data.destinations : [],
  } as Trip
  return { id: docSnap.id, trip }
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
  const toTrip = (d: { id: string; data: () => Record<string, unknown> }) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      destinations: Array.isArray(data.destinations) ? data.destinations : [],
    } as Trip
  }
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
