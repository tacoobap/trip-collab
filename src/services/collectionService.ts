import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CollectionItem } from '@/types/database'

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

