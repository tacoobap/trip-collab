import * as admin from 'firebase-admin'
import type { HandlerEvent } from '@netlify/functions'

let initialized = false

function ensureAdmin() {
  if (initialized) return
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!json) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not set')
  }
  try {
    const credential = admin.credential.cert(JSON.parse(json) as admin.ServiceAccount)
    if (!admin.apps.length) {
      admin.initializeApp({ credential })
    }
    initialized = true
  } catch (e) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON')
  }
}

/**
 * Returns the Firebase UID if the request has a valid Bearer token; otherwise null.
 * Do not use verifyIdToken(idToken, true) (revocation check) — it can cause timeouts on Netlify.
 */
export async function getAuthUidFromEvent(event: HandlerEvent): Promise<string | null> {
  const authHeader = event.headers?.authorization || event.headers?.Authorization
  const match = typeof authHeader === 'string' && authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]
  if (!token) return null
  try {
    ensureAdmin()
    const decoded = await admin.auth().verifyIdToken(token)
    return decoded.uid ?? null
  } catch {
    return null
  }
}

/**
 * Returns 401 response body and statusCode if not authenticated; otherwise returns null (caller proceeds).
 */
export function requireAuthResponse(uid: string | null): { statusCode: number; body: string } | null {
  if (uid) return null
  return {
    statusCode: 401,
    body: JSON.stringify({ error: 'Unauthorized', detail: 'Valid Firebase ID token required' }),
  }
}
