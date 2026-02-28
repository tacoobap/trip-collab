import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  doc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Slot } from '@/types/database'

export type SlotCategory = Slot['category']

const DEFAULT_DAY_SLOTS = [
  { time_label: 'Morning', category: 'activity' as SlotCategory, sort_order: 0 },
  { time_label: 'Afternoon', category: 'activity' as SlotCategory, sort_order: 1 },
  { time_label: 'Evening', category: 'food' as SlotCategory, sort_order: 2 },
]

export type CreateDayInput = {
  date: string
  dayNumber: number
  city: string
}

/**
 * Create day docs and default slots (Morning, Afternoon, Evening) for each day in one batch.
 * useTrip's subscription will pick up the new days automatically.
 */
export async function createDaysWithDefaultSlots(
  tripId: string,
  days: CreateDayInput[]
): Promise<void> {
  const batch = writeBatch(db)
  for (const day of days) {
    const dayRef = doc(collection(db, 'days'))
    batch.set(dayRef, {
      trip_id: tripId,
      city: day.city,
      label: `Day ${day.dayNumber} · ${day.city}`,
      day_number: day.dayNumber,
      date: day.date,
    })
    for (const slot of DEFAULT_DAY_SLOTS) {
      const slotRef = doc(collection(db, 'slots'))
      batch.set(slotRef, {
        day_id: dayRef.id,
        trip_id: tripId,
        time_label: slot.time_label,
        category: slot.category,
        icon: null,
        status: 'open',
        locked_proposal_id: null,
        sort_order: slot.sort_order,
      })
    }
  }
  await batch.commit()
}

export type AddSlotInput = {
  day_id: string
  trip_id: string
  time_label: string
  category?: SlotCategory
  sort_order: number
}

/**
 * Create a new slot on a day. Sets status 'open', icon null, locked_proposal_id null.
 */
export async function addSlot(input: AddSlotInput): Promise<void> {
  const {
    day_id,
    trip_id,
    time_label,
    sort_order,
    category = 'activity',
  } = input
  await addDoc(collection(db, 'slots'), {
    day_id,
    trip_id,
    time_label,
    category,
    icon: null,
    status: 'open',
    locked_proposal_id: null,
    sort_order,
  })
}

export type AddProposalInput = {
  slot_id: string
  trip_id: string
  proposer_name: string
  title: string
  note?: string | null
  url?: string | null
}

/**
 * Create a new proposal on a slot. Caller should set slot status to 'proposed' when it was 'open'.
 */
export async function addProposal(input: AddProposalInput): Promise<void> {
  const { slot_id, trip_id, proposer_name, title, note = null, url = null } = input
  await addDoc(collection(db, 'proposals'), {
    slot_id,
    trip_id,
    proposer_name,
    title,
    note,
    url,
    votes: [],
    created_at: serverTimestamp(),
  })
}

// ── Proposal updates ────────────────────────────────────────────────────────

export type UpdateProposalInput = {
  title: string
  note: string | null
  url: string | null
}

export async function updateProposal(
  proposalId: string,
  data: UpdateProposalInput
): Promise<void> {
  await updateDoc(doc(db, 'proposals', proposalId), {
    title: data.title,
    note: data.note,
    url: data.url,
  })
}

export async function updateProposalExactTime(
  proposalId: string,
  exact_time: string
): Promise<void> {
  await updateDoc(doc(db, 'proposals', proposalId), { exact_time })
}

export async function setProposalVotes(
  proposalId: string,
  votes: string[]
): Promise<void> {
  await updateDoc(doc(db, 'proposals', proposalId), { votes })
}

// ── Day updates ──────────────────────────────────────────────────────────────

export type UpdateDayInput = {
  label?: string
  city?: string
  date?: string | null
}

export async function updateDay(
  dayId: string,
  data: UpdateDayInput
): Promise<void> {
  await updateDoc(doc(db, 'days', dayId), data)
}

// ── Slot updates ────────────────────────────────────────────────────────────

export async function updateSlotTimeLabel(
  slotId: string,
  time_label: string
): Promise<void> {
  await updateDoc(doc(db, 'slots', slotId), { time_label })
}

export async function updateSlotIcon(slotId: string, icon: string): Promise<void> {
  await updateDoc(doc(db, 'slots', slotId), { icon })
}

export async function lockSlot(
  slotId: string,
  locked_proposal_id: string
): Promise<void> {
  await updateDoc(doc(db, 'slots', slotId), {
    status: 'locked',
    locked_proposal_id,
  })
}

export async function unlockSlot(slotId: string): Promise<void> {
  await updateDoc(doc(db, 'slots', slotId), {
    status: 'proposed',
    locked_proposal_id: null,
  })
}

export async function setSlotProposed(slotId: string): Promise<void> {
  await updateDoc(doc(db, 'slots', slotId), { status: 'proposed' })
}

// ── Delete ─────────────────────────────────────────────────────────────────

export type DeleteProposalOptions = {
  slotId: string
  remainingProposalCount: number
  lockedProposalId: string | null
}

/**
 * Delete a proposal and update slot status: open if no proposals left, or proposed if the deleted one was locked.
 */
export async function deleteProposal(
  proposalId: string,
  options: DeleteProposalOptions
): Promise<void> {
  await deleteDoc(doc(db, 'proposals', proposalId))
  const { slotId, remainingProposalCount, lockedProposalId } = options
  if (remainingProposalCount === 0) {
    await updateDoc(doc(db, 'slots', slotId), {
      status: 'open',
      locked_proposal_id: null,
    })
  } else if (lockedProposalId === proposalId) {
    await updateDoc(doc(db, 'slots', slotId), {
      status: 'proposed',
      locked_proposal_id: null,
    })
  }
}

/**
 * Delete all proposals for the slot, then the slot.
 */
export async function deleteSlot(slotId: string): Promise<void> {
  const proposalsSnap = await getDocs(
    query(collection(db, 'proposals'), where('slot_id', '==', slotId))
  )
  await Promise.all(proposalsSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'slots', slotId))
}
