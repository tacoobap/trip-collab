import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Stay } from '@/types/database'

export type StayInput = Omit<Stay, 'id' | 'trip_id' | 'created_at'>

export function useStays(tripId: string | undefined) {
  const [stays, setStays] = useState<Stay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) return

    const unsub = onSnapshot(
      query(collection(db, 'stays'), where('trip_id', '==', tripId)),
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Stay))
          .sort((a, b) => (a.check_in < b.check_in ? -1 : 1))
        setStays(docs)
        setLoading(false)
      }
    )
    return unsub
  }, [tripId])

  const addStay = async (data: StayInput) => {
    if (!tripId) return
    await addDoc(collection(db, 'stays'), {
      ...data,
      trip_id: tripId,
      created_at: serverTimestamp(),
    })
  }

  const updateStay = async (stayId: string, data: Partial<StayInput>) => {
    await updateDoc(doc(db, 'stays', stayId), data)
  }

  const deleteStay = async (stayId: string) => {
    await deleteDoc(doc(db, 'stays', stayId))
  }

  return { stays, loading, addStay, updateStay, deleteStay }
}
