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
import type { Day, Slot } from '@/types/database'
import { enumerateDates, dayLabel } from '@/lib/dateRange'

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

/**
 * Reconcile a trip's day docs with its date range.
 *
 * Editing the range only ever wrote `start_date`/`end_date` on the trip, so
 * extending a trip left the extra days missing entirely. This fills in any
 * date in range that has no day doc (with the same default slots as initial
 * setup) and renumbers everything by date so `Day N` stays in order.
 *
 * Days outside the new range are deliberately left alone — they may carry
 * slots, proposals and photos, and deleting that silently on a date tweak
 * would be far worse than leaving a stray day on the board.
 */
export async function syncTripDays(
  tripId: string,
  startDate: string | null,
  endDate: string | null,
  fallbackCity: string
): Promise<void> {
  if (!startDate || !endDate) return
  const dates = enumerateDates(startDate, endDate)
  if (dates.length === 0) return

  const snap = await getDocs(
    query(collection(db, 'days'), where('trip_id', '==', tripId))
  )
  const existing = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Day, 'id'>),
  }))
  const byDate = new Map(
    existing.filter((d) => d.date).map((d) => [d.date as string, d])
  )

  // Carry the city forward from the nearest earlier day, so extending a Lisbon
  // trip yields more Lisbon days rather than blank ones
  const cityFor = (date: string): string => {
    const earlier = existing
      .filter((d): d is typeof d & { date: string } => !!d.date && d.date < date)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    return earlier?.city || existing[0]?.city || fallbackCity
  }

  // Final ordering: everything in range, plus any out-of-range stragglers after
  const inRange = dates.map((date) => ({ date, current: byDate.get(date) ?? null }))
  const strays = existing
    .filter((d) => !d.date || !dates.includes(d.date))
    .map((d) => ({ date: d.date ?? '', current: d }))
  const ordered = [...inRange, ...strays]

  // Chunked: a batch caps at 500 writes and each new day costs 1 + 3 slots
  let batch = writeBatch(db)
  let ops = 0
  const flush = async (force = false) => {
    if (ops >= 450 || (force && ops > 0)) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }

  for (let i = 0; i < ordered.length; i++) {
    const { date, current } = ordered[i]
    const dayNumber = i + 1

    if (!current) {
      const city = cityFor(date)
      const dayRef = doc(collection(db, 'days'))
      batch.set(dayRef, {
        trip_id: tripId,
        city,
        label: dayLabel(dayNumber, city),
        day_number: dayNumber,
        date,
        image_url: null,
        image_attribution: null,
        narrative_title: null,
      })
      ops++
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
        ops++
      }
    } else if (current.day_number !== dayNumber) {
      // Labels are always derived (`Day N · City`), never free text, so
      // rewriting them here can't clobber anything the user typed
      batch.update(doc(db, 'days', current.id), {
        day_number: dayNumber,
        label: dayLabel(dayNumber, current.city),
      })
      ops++
    }

    await flush()
  }

  await flush(true)
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

export type AddLockedSlotInput = {
  day_id: string
  trip_id: string
  time_label: string
  sort_order: number
  category?: SlotCategory
  proposer_name: string
  title: string
}

/**
 * Create a slot, its single proposal, and lock it — one batch, one round-trip.
 * Backs the quick-entry row for itineraries that are already decided, where the
 * propose-then-vote-then-lock cycle is just friction.
 */
export async function addLockedSlot(input: AddLockedSlotInput): Promise<void> {
  const {
    day_id,
    trip_id,
    time_label,
    sort_order,
    category = 'activity',
    proposer_name,
    title,
  } = input

  const batch = writeBatch(db)
  const slotRef = doc(collection(db, 'slots'))
  const proposalRef = doc(collection(db, 'proposals'))

  batch.set(slotRef, {
    day_id,
    trip_id,
    time_label,
    category,
    icon: null,
    status: 'locked',
    locked_proposal_id: proposalRef.id,
    sort_order,
  })
  batch.set(proposalRef, {
    slot_id: slotRef.id,
    trip_id,
    proposer_name,
    title,
    note: null,
    url: null,
    votes: [],
    created_at: serverTimestamp(),
  })

  await batch.commit()
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
