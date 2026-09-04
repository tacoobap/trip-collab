import { getDb } from './verifyAuth'
import type { PreviewKind, PreviewTrip } from './tripPreview'

/**
 * Read the handful of fields a link preview draws, for a trip addressed by
 * either of its shareable links.
 *
 * Read through the Admin SDK, which bypasses `firestore.rules` — the same route
 * `shared-trip` already takes. Only preview fields are read back, so knowing a
 * slug reveals a name, a cover photo and dates, and nothing else about a trip.
 *
 * Kept apart from `tripPreview` so importing the copy helpers doesn't drag
 * `firebase-admin` in with them.
 */
export async function lookupTrip(kind: PreviewKind, id: string): Promise<PreviewTrip | null> {
  // Share tokens are 22 chars of base64url; anything wildly off can't be real
  if (!id || id.length > 200) return null
  if (kind === 'share' && (id.length < 16 || id.length > 64)) return null

  const snap = await getDb()
    .collection('trips')
    .where(kind === 'trip' ? 'slug' : 'share_token', '==', id)
    .limit(1)
    .get()

  if (snap.empty) return null
  const doc = snap.docs[0]
  const name = doc.get('name')
  const slug = doc.get('slug')
  if (typeof name !== 'string' || typeof slug !== 'string') return null

  const destinations = doc.get('destinations')
  const imageUrl = doc.get('image_url')
  const startDate = doc.get('start_date')
  const endDate = doc.get('end_date')

  return {
    name,
    slug,
    destinations: Array.isArray(destinations)
      ? destinations.filter((d): d is string => typeof d === 'string' && !!d.trim())
      : [],
    imageUrl: typeof imageUrl === 'string' && imageUrl ? imageUrl : null,
    startDate: typeof startDate === 'string' && startDate ? startDate : null,
    endDate: typeof endDate === 'string' && endDate ? endDate : null,
  }
}
