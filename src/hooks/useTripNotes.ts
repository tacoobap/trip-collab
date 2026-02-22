import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TripNote } from '@/types/database'

export function useTripNotes(tripId: string | undefined) {
  const [notes, setNotes] = useState<TripNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) return

    // Sort client-side to avoid requiring a composite Firestore index
    const unsub = onSnapshot(
      query(collection(db, 'notes'), where('trip_id', '==', tripId)),
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as TripNote))
          .sort((a, b) => {
            // created_at may be a Firestore Timestamp or ISO string
            const ta = typeof a.created_at === 'string' ? a.created_at : (a.created_at as unknown as { toMillis: () => number })?.toMillis?.() ?? 0
            const tb = typeof b.created_at === 'string' ? b.created_at : (b.created_at as unknown as { toMillis: () => number })?.toMillis?.() ?? 0
            return ta > tb ? -1 : ta < tb ? 1 : 0
          })
        setNotes(docs)
        setLoading(false)
      }
    )
    return unsub
  }, [tripId])

  const addNote = async (text: string, authorName: string) => {
    if (!tripId || !text.trim()) return
    await addDoc(collection(db, 'notes'), {
      trip_id: tripId,
      text: text.trim(),
      author_name: authorName,
      created_at: serverTimestamp(),
    })
  }

  const deleteNote = async (noteId: string) => {
    await deleteDoc(doc(db, 'notes', noteId))
  }

  return { notes, loading, addNote, deleteNote }
}
