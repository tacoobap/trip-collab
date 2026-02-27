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

export function subscribeToStays(
  tripId: string,
  onChange: (stays: Stay[]) => void
): () => void {
  const q = query(collection(db, 'stays'), where('trip_id', '==', tripId))

  return onSnapshot(q, (snap) => {
    const docs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Stay))
      .sort((a, b) => (a.check_in < b.check_in ? -1 : 1))
    onChange(docs)
  })
}

export async function addStay(tripId: string, data: StayInput): Promise<void> {
  await addDoc(collection(db, 'stays'), {
    ...data,
    trip_id: tripId,
    created_at: serverTimestamp(),
  })
}

export async function updateStay(
  stayId: string,
  data: Partial<StayInput>
): Promise<void> {
  await updateDoc(doc(db, 'stays', stayId), data)
}

export async function deleteStay(stayId: string): Promise<void> {
  await deleteDoc(doc(db, 'stays', stayId))
}

