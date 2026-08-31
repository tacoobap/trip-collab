import type { Handler } from '@netlify/functions'
import { getAuthUidFromEvent, requireAuthResponse, getDb } from './lib/verifyAuth'

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/**
 * Display names for a trip's members.
 *
 * `firestore.rules` limits /users/{uid} to that same user, so the browser can
 * only ever read its own profile — there's no client-readable UID-to-name map.
 * Reading them here through the Admin SDK keeps it that way: this returns names
 * only, never the email or photo stored alongside them, and only to someone who
 * is already a member of the trip.
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
  const snap = await db.collection('trips').doc(tripId).get()
  if (!snap.exists) return json(404, { error: 'Trip not found' })

  // Rules don't run for the Admin SDK, so membership is checked here by hand
  const trip = snap.data() as { owner_uid?: string; member_uids?: string[] }
  const memberUids = [
    ...new Set([trip.owner_uid, ...(trip.member_uids ?? [])].filter(Boolean)),
  ] as string[]
  if (!memberUids.includes(uid as string)) {
    return json(403, { error: 'Not a member of this trip' })
  }
  if (memberUids.length === 0) return json(200, { members: [] })

  const profiles = await db.getAll(
    ...memberUids.map((id) => db.collection('users').doc(id))
  )

  // A member with no profile document yet is skipped rather than surfaced as a
  // placeholder; the client falls back to names harvested from trip content.
  const members = profiles.flatMap((doc) => {
    const name = doc.get('display_name')
    if (typeof name !== 'string' || !name.trim()) return []
    return [{ uid: doc.id, display_name: name.trim() }]
  })

  return json(200, { members })
}
