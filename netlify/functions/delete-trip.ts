import type { Handler } from '@netlify/functions'
import { getAuthUidFromEvent, requireAuthResponse, getDb } from './lib/verifyAuth'

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const BATCH_LIMIT = 450
const IN_MAX = 10

/**
 * Permanently delete a trip and everything hanging off it.
 *
 * Runs server-side for two reasons: `firestore.rules` sets `allow delete: if
 * false` on trips, and the cascade spans six collections, which a client can't
 * do atomically or safely.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const uid = await getAuthUidFromEvent(event)
  const authError = requireAuthResponse(uid)
  if (authError) {
    return { ...authError, headers: { 'Content-Type': 'application/json' } }
  }

  let body: { tripId?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const tripId = typeof body.tripId === 'string' ? body.tripId : ''
  if (!tripId) return json(400, { error: 'Missing tripId' })

  const db = getDb()
  const tripRef = db.collection('trips').doc(tripId)
  const snap = await tripRef.get()
  if (!snap.exists) return json(404, { error: 'Trip not found' })

  // Deletion is owner-only — a member losing patience shouldn't be able to
  // destroy everyone else's trip. Rules don't run for the Admin SDK.
  const trip = snap.data() as { owner_uid?: string }
  if (trip.owner_uid !== uid) {
    return json(403, { error: 'Only the trip owner can delete this trip' })
  }

  const refs: FirebaseFirestore.DocumentReference[] = []

  const collect = async (name: string, field: string, value: string) => {
    const q = await db.collection(name).where(field, '==', value).get()
    q.docs.forEach((d) => refs.push(d.ref))
    return q.docs.map((d) => d.id)
  }

  const dayIds = await collect('days', 'trip_id', tripId)
  await Promise.all([
    collect('proposals', 'trip_id', tripId),
    collect('stays', 'trip_id', tripId),
    collect('collection_items', 'trip_id', tripId),
    collect('trip_notes', 'trip_id', tripId),
  ])

  // Slots by day_id, matching how they're read: older docs predate trip_id
  for (let i = 0; i < dayIds.length; i += IN_MAX) {
    const q = await db
      .collection('slots')
      .where('day_id', 'in', dayIds.slice(i, i + IN_MAX))
      .get()
    q.docs.forEach((d) => refs.push(d.ref))
  }

  // Children first, so a failure part-way can be retried rather than orphaning
  // documents behind a deleted parent
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  await tripRef.delete()

  return json(200, { deleted: true, documents: refs.length + 1 })
}
