import type { Handler } from '@netlify/functions'
import { getDb, serialize } from './lib/verifyAuth'

const json = (statusCode: number, body: unknown, cache = 'no-store') => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
  body: JSON.stringify(body),
})

type Doc = Record<string, unknown> & { id: string }

const docs = (snap: FirebaseFirestore.QuerySnapshot): Doc[] =>
  snap.docs.map((d) => ({ id: d.id, ...d.data() }))

/**
 * Public, unauthenticated read of one shared trip.
 *
 * Reached only by knowing the share token. The Admin SDK bypasses security
 * rules, so this works without granting unauthenticated clients any Firestore
 * access — `firestore.rules` stays closed.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const token = event.queryStringParameters?.token?.trim()
  // Tokens are 22 chars of base64url; anything else can't be real
  if (!token || token.length < 16 || token.length > 64) {
    return json(404, { error: 'Not found' })
  }

  const db = getDb()
  const tripSnap = await db
    .collection('trips')
    .where('share_token', '==', token)
    .limit(1)
    .get()

  if (tripSnap.empty) return json(404, { error: 'Not found' })

  const tripDoc = tripSnap.docs[0]
  const tripId = tripDoc.id
  const trip = { id: tripId, ...tripDoc.data() } as Doc
  // Never hand the token back out in the payload
  delete trip.share_token

  const [daysSnap, proposalsSnap, staysSnap] = await Promise.all([
    db.collection('days').where('trip_id', '==', tripId).get(),
    db.collection('proposals').where('trip_id', '==', tripId).get(),
    db.collection('stays').where('trip_id', '==', tripId).get(),
  ])

  const dayIds = daysSnap.docs.map((d) => d.id)

  // Query slots by day_id, matching the live subscription: older slot docs
  // predate the denormalised trip_id and would be missed by a trip_id query.
  const IN_MAX = 10
  const slotChunks = await Promise.all(
    Array.from({ length: Math.ceil(dayIds.length / IN_MAX) }, (_, i) =>
      db
        .collection('slots')
        .where('day_id', 'in', dayIds.slice(i * IN_MAX, (i + 1) * IN_MAX))
        .get()
    )
  )

  const slots = slotChunks.flatMap(docs)
  const proposals = docs(proposalsSnap)

  // Same shape the live subscription builds: days → slots → proposals
  const days = docs(daysSnap)
    .sort((a, b) => Number(a.day_number ?? 0) - Number(b.day_number ?? 0))
    .map((day) => ({
      ...day,
      slots: slots
        .filter((s) => s.day_id === day.id)
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
        .map((slot) => ({
          ...slot,
          proposals: proposals.filter((p) => p.slot_id === slot.id),
        })),
    }))

  const stays = docs(staysSnap).sort((a, b) =>
    String(a.check_in) < String(b.check_in) ? -1 : 1
  )

  return json(200, serialize({ trip, days, stays }))
}
