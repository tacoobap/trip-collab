import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CollectionItem, CollectionItemCategory } from '@/types/database'

function normalizeItem(docId: string, data: Record<string, unknown>): CollectionItem {
  const created = data.created_at
  const created_at =
    typeof created === 'string'
      ? created
      : created && typeof (created as { toDate?: () => Date }).toDate === 'function'
        ? (created as Timestamp).toDate().toISOString()
        : ''
  return { id: docId, ...data, created_at } as CollectionItem
}

// ── Writes ─────────────────────────────────────────────────────────────────

export type CreateCollectionItemInput = {
  trip_id: string
  name: string
  category: CollectionItemCategory
  destination?: string | null
  image_url?: string | null
  google_maps_url?: string | null
  url?: string | null
  note?: string | null
  latitude?: number | null
  longitude?: number | null
  place_name?: string | null
  created_by: string
}

export type UpdateCollectionItemInput = {
  name?: string
  category?: CollectionItemCategory
  destination?: string | null
  image_url?: string | null
  google_maps_url?: string | null
  url?: string | null
  note?: string | null
  latitude?: number | null
  longitude?: number | null
  place_name?: string | null
}

/**
 * Create a collection item. Returns the new document id.
 */
export async function addCollectionItem(
  input: CreateCollectionItemInput
): Promise<string> {
  const ref = await addDoc(collection(db, 'collection_items'), {
    trip_id: input.trip_id,
    name: input.name.trim(),
    category: input.category,
    destination: input.destination ?? null,
    image_url: input.image_url ?? null,
    google_maps_url: input.google_maps_url ?? null,
    url: input.url ?? null,
    note: input.note ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    place_name: input.place_name ?? null,
    likes: [],
    created_at: serverTimestamp(),
    created_by: input.created_by,
  })
  return ref.id
}

/**
 * Update a collection item by id. Partial update.
 */
export async function updateCollectionItem(
  itemId: string,
  data: UpdateCollectionItemInput
): Promise<void> {
  const payload: Record<string, unknown> = { ...data }
  if (payload.name !== undefined) payload.name = (payload.name as string).trim()
  await updateDoc(doc(db, 'collection_items', itemId), payload)
}

/**
 * Delete a collection item.
 */
export async function deleteCollectionItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'collection_items', itemId))
}

/**
 * Set the likes array on a collection item (e.g. after toggle by display name).
 */
export async function setCollectionItemLikes(
  itemId: string,
  likes: string[]
): Promise<void> {
  await updateDoc(doc(db, 'collection_items', itemId), { likes })
}

// ── Subscribe ───────────────────────────────────────────────────────────────

export function subscribeToCollectionItems(
  tripId: string,
  onChange: (items: CollectionItem[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(
    collection(db, 'collection_items'),
    where('trip_id', '==', tripId)
  )

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => normalizeItem(d.id, d.data() as Record<string, unknown>))
      onChange(list)
    },
    (err) => {
      if (onError) {
        onError(err)
      } else {
        // eslint-disable-next-line no-console
        console.error('subscribeToCollectionItems', err)
      }
    }
  )
}

