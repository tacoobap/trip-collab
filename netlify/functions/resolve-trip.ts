import type { Handler } from '@netlify/functions'
import { getAuthUidFromEvent, requireAuthResponse, getDb } from './lib/verifyAuth'

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
})

/**
 * Slug → trip id, for a signed-in user who isn't on the trip yet.
 *
 * `firestore.rules` scopes a `list` of /trips to trips you're a member of, so
 * the browser can no longer resolve a slug with `where('slug', '==', slug)`.
 * That query is the first step of the invite flow — paste /trip/:slug, sign in,
 * see the trip, join it — so it moves here, where the Admin SDK reads it
 * without rules and the caller has to present a valid Firebase ID token.
 *
 * Only the document id comes back. The client reads the trip itself, which
 * `allow get` still permits for any signed-in user; that read is what the join
 * screen renders. Knowing a slug therefore reveals no more than
 * `trip-preview` already does publicly for the same link.
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

  let body: { slug?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!slug || slug.length > 200) return json(400, { error: 'Missing slug' })

  const snap = await getDb()
    .collection('trips')
    .where('slug', '==', slug)
    .limit(1)
    .get()

  if (snap.empty) return json(404, { error: 'Not found' })
  return json(200, { id: snap.docs[0].id })
}
