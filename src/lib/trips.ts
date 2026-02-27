import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function joinTrip(tripId: string, userUid: string) {
  if (!tripId || !userUid) {
    throw new Error('Missing tripId or userUid')
  }

  await updateDoc(doc(db, 'trips', tripId), {
    member_uids: arrayUnion(userUid),
  })
}

