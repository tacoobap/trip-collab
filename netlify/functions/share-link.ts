import type { Handler } from '@netlify/functions'
import { randomBytes } from 'node:crypto'
import { getAuthUidFromEvent, requireAuthResponse, getDb } from './lib/verifyAuth'

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/**
 * Create, read, or revoke a trip's public share token.
 *
 * The token is minted here rather than in the browser so it comes from a real
 * CSPRNG, and so the client never needs write access to the field.
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

  let body: { tripId?: string; action?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const tripId = typeof body.tripId === 'string' ? body.tripId : ''
  const action = body.action === 'disable' ? 'disable' : 'enable'
  if (!tripId) return json(400, { error: 'Missing tripId' })

  const db = getDb()
  const ref = db.collection('trips').doc(tripId)
  const snap = await ref.get()
  if (!snap.exists) return json(404, { error: 'Trip not found' })

  // Rules don't run for the Admin SDK, so membership is checked here by hand
  const trip = snap.data() as { owner_uid?: string; member_uids?: string[] }
  const isMember =
    trip.owner_uid === uid || (trip.member_uids ?? []).includes(uid as string)
  if (!isMember) return json(403, { error: 'Not a member of this trip' })

  if (action === 'disable') {
    await ref.update({ share_token: null })
    return json(200, { token: null })
  }

  // Reuse the existing token so an already-circulated link keeps working
  const existing = snap.get('share_token')
  if (typeof existing === 'string' && existing) {
    return json(200, { token: existing })
  }

  const token = randomBytes(16).toString('base64url')
  await ref.update({ share_token: token })
  return json(200, { token })
}
