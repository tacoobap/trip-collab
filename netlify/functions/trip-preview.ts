import type { Handler } from '@netlify/functions'
import { lookupTrip } from './lib/tripLookup'

/**
 * Public, unauthenticated read of the handful of fields that describe a trip:
 * its name, dates, destinations and cover photo.
 *
 * This is what an invitee sees before signing in, so they know what they've
 * been invited to instead of hitting a bare auth wall. It reads through the
 * Admin SDK — the same route `shared-trip` and `link-preview` take — so
 * `firestore.rules` stays closed to unauthenticated clients.
 *
 * Knowing a slug therefore reveals exactly what pasting that link into a chat
 * already reveals in the preview card, and nothing more: no days, no slots, no
 * members, no share token.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const slug = event.queryStringParameters?.slug?.trim()
  if (!slug) {
    return json(404, { error: 'Not found' })
  }

  const trip = await lookupTrip('trip', slug)
  if (!trip) return json(404, { error: 'Not found' })

  return json(200, trip)
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
})
