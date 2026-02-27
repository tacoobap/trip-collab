import { useState, useEffect } from 'react'
import type { CollectionItem } from '@/types/database'
import { subscribeToCollectionItems } from '@/services/collectionService'

export function useCollectionItems(tripId: string | undefined) {
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) {
      setItems([])
      setLoading(false)
      return
    }

    const unsub = subscribeToCollectionItems(
      tripId,
      (list) => {
        setItems(list)
        setLoading(false)
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.error('useCollectionItems', err)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [tripId])

  return { items, loading }
}
