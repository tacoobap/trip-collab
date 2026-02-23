import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore'
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

export function useCollectionItems(tripId: string | undefined) {
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) {
      setItems([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'collection_items'),
      where('trip_id', '==', tripId)
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => normalizeItem(d.id, d.data() as Record<string, unknown>))
        setItems(list)
        setLoading(false)
      },
      (err) => {
        console.error('useCollectionItems', err)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [tripId])

  return { items, loading }
}
