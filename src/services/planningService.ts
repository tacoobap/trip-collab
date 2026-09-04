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
import type { Day, Slot, SlotWithProposals } from '@/types/database'
import { enumerateDates, dayLabel } from '@/lib/dateRange'
import { suggestEmoji } from '@/lib/slotEmojis'
import { minutesToTimeLabel } from '@/lib/timeUtils'

export type SlotCategory = Slot['category']

/** Firestore `in` queries take at most 10 values. */
const IN_QUERY_MAX = 10

/** A write batch caps at 500 operations; leave headroom. */
const BATCH_LIMIT = 450

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Chronological, undated days last. `day_number` is a view of this order, never
 * data of its own — deriving it anywhere else is how days end up out of sequence.
 */
function byDate(a: { date: string | null }, b: { date: string | null }): number {
  if (a.date === b.date) return 0
  if (!a.date) return 1
  if (!b.date) return -1
  return a.date < b.date ? -1 : 1
}

async function fetchTripDays(tripId: string): Promise<Day[]> {
  const snap = await getDocs(
    query(collection(db, 'days'), where('trip_id', '==', tripId))
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Day, 'id'>) }))
}

/** Slots held by each of the given days. Days with none are absent from the map. */
async function slotCountByDay(dayIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const ids of chunk(dayIds, IN_QUERY_MAX)) {
    const snap = await getDocs(
      query(collection(db, 'slots'), where('day_id', 'in', ids))
    )
    for (const d of snap.docs) {
      const dayId = (d.data() as Slot).day_id
      counts.set(dayId, (counts.get(dayId) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * Delete days along with the slots and proposals hanging off them. Deletes run
 * leaf-first so a failure part-way can't leave a slot pointing at a proposal
 * that no longer exists.
 */
export async function deleteDays(dayIds: string[]): Promise<void> {
  if (dayIds.length === 0) return

  const slotIds: string[] = []
  for (const ids of chunk(dayIds, IN_QUERY_MAX)) {
    const snap = await getDocs(
      query(collection(db, 'slots'), where('day_id', 'in', ids))
    )
    slotIds.push(...snap.docs.map((d) => d.id))
  }

  const proposalIds: string[] = []
  for (const ids of chunk(slotIds, IN_QUERY_MAX)) {
    const snap = await getDocs(
      query(collection(db, 'proposals'), where('slot_id', 'in', ids))
    )
    proposalIds.push(...snap.docs.map((d) => d.id))
  }

  const refs = [
    ...proposalIds.map((id) => doc(db, 'proposals', id)),
    ...slotIds.map((id) => doc(db, 'slots', id)),
    ...dayIds.map((id) => doc(db, 'days', id)),
  ]
  for (const group of chunk(refs, BATCH_LIMIT)) {
    const batch = writeBatch(db)
    group.forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

type OrderedDay = {
  date: string | null
  /** The day doc at this position, or null to create one. */
  current: Day | null
  /** City to write. Leaves an existing day's city alone when undefined. */
  city?: string
}

/**
 * Write `day_number` and the derived label so the board reads Day 1..N in the
 * given order, creating any day that has no doc yet.
 */
async function writeDayOrder(
  tripId: string,
  ordered: OrderedDay[]
): Promise<void> {
  let batch = writeBatch(db)
  let ops = 0
  const flush = async (force = false) => {
    if (ops >= BATCH_LIMIT || (force && ops > 0)) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }

  for (let i = 0; i < ordered.length; i++) {
    const { date, current, city } = ordered[i]
    const dayNumber = i + 1

    if (!current) {
      const dayCity = city ?? ''
      batch.set(doc(collection(db, 'days')), {
        trip_id: tripId,
        city: dayCity,
        label: dayLabel(dayNumber, dayCity),
        day_number: dayNumber,
        date,
        image_url: null,
        image_attribution: null,
        narrative_title: null,
      })
      ops++
    } else {
      const nextCity = city ?? current.city
      const nextLabel = dayLabel(dayNumber, nextCity)
      // Labels are always derived (`Day N · City`), never free text, so
      // rewriting them here can't clobber anything the user typed
      if (
        current.day_number !== dayNumber ||
        current.city !== nextCity ||
        current.label !== nextLabel
      ) {
        batch.update(doc(db, 'days', current.id), {
          day_number: dayNumber,
          city: nextCity,
          label: nextLabel,
        })
        ops++
      }
    }

    await flush()
  }

  await flush(true)
}

/**
 * Re-derive every day's number and label from its date. Call after anything
 * that can move a day in the sequence — editing a day's date, adding one out
 * of order — so the board never shows Day 14 sitting before Day 3.
 */
export async function renumberTripDays(tripId: string): Promise<void> {
  const existing = await fetchTripDays(tripId)
  await writeDayOrder(
    tripId,
    [...existing]
      .sort(byDate)
      .map((d) => ({ date: d.date, current: d }))
  )
}

export type SyncTripDaysOptions = {
  /** City to write per `YYYY-MM-DD`. Applies to new and existing days alike. */
  cityByDate?: Record<string, string>
  /**
   * Days dated outside the new range. `remove` deletes them along with their
   * slots and proposals; `keep` leaves them on the board, still in date order.
   *
   * Either way an out-of-range day carrying nothing — no slots, no photo, no
   * narrative — is removed. It only ever existed because the range used to
   * reach that far, and keeping it is what made days the user had trimmed off
   * the front reappear at the end of the board.
   */
  outOfRange?: 'keep' | 'remove'
}

/**
 * Reconcile a trip's day docs with its date range: create the days that are
 * missing, drop the ones the range no longer covers, and renumber everything
 * by date so `Day N` always ascends.
 */
export async function syncTripDays(
  tripId: string,
  startDate: string | null,
  endDate: string | null,
  fallbackCity: string,
  options: SyncTripDaysOptions = {}
): Promise<void> {
  const { cityByDate = {}, outOfRange = 'keep' } = options
  const dates = startDate && endDate ? enumerateDates(startDate, endDate) : []
  const existing = await fetchTripDays(tripId)

  // No usable range — nothing to create or drop, but keep the order honest
  if (dates.length === 0) {
    await writeDayOrder(
      tripId,
      [...existing].sort(byDate).map((d) => ({
        date: d.date,
        current: d,
        city: d.date ? cityByDate[d.date] : undefined,
      }))
    )
    return
  }

  const inRange = new Set(dates)
  const strays = existing.filter((d) => d.date && !inRange.has(d.date))
  const counts =
    strays.length > 0
      ? await slotCountByDay(strays.map((d) => d.id))
      : new Map<string, number>()

  const doomed =
    outOfRange === 'remove'
      ? strays
      : strays.filter(
          (d) => !counts.get(d.id) && !d.image_url && !d.narrative_title
        )
  await deleteDays(doomed.map((d) => d.id))

  const removed = new Set(doomed.map((d) => d.id))
  const survivors = existing.filter((d) => !removed.has(d.id))
  const byDateMap = new Map(
    survivors.filter((d) => d.date).map((d) => [d.date as string, d])
  )
  const dated = survivors
    .filter((d): d is Day & { date: string } => !!d.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  /** Nearest earlier day's city, so extending a Lisbon trip yields more Lisbon days. */
  const nearestEarlierCity = (date: string): string => {
    for (let i = dated.length - 1; i >= 0; i--) {
      if (dated[i].date < date) return dated[i].city
    }
    return dated[0]?.city ?? ''
  }

  const ordered: OrderedDay[] = []
  let carry = ''
  for (const date of dates) {
    const current = byDateMap.get(date) ?? null
    const assigned = cityByDate[date]
    if (current) {
      ordered.push({ date, current, city: assigned })
      carry = assigned || current.city || carry
    } else {
      const city = assigned || carry || nearestEarlierCity(date) || fallbackCity
      ordered.push({ date, current: null, city })
      carry = city
    }
  }

  // Kept out-of-range days belong in the sequence by date, never bolted on at
  // the end — that is what turned trimmed-off early days into Day 14 and 15
  for (const day of survivors) {
    if (day.date && inRange.has(day.date)) continue
    ordered.push({
      date: day.date,
      current: day,
      city: day.date ? cityByDate[day.date] : undefined,
    })
  }

  await writeDayOrder(tripId, ordered.sort(byDate))
}

export type AddSlotInput = {
  day_id: string
  trip_id: string
  time_label: string
  category?: SlotCategory
  sort_order: number
  /** Grid schedule; null = unscheduled (day shelf). Omit on legacy paths. */
  start_minutes?: number | null
  duration_minutes?: number | null
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
    start_minutes,
    duration_minutes,
  } = input
  const data: Record<string, unknown> = {
    day_id,
    trip_id,
    time_label,
    category,
    icon: null,
    status: 'open',
    locked_proposal_id: null,
    sort_order,
  }
  if (start_minutes !== undefined) data.start_minutes = start_minutes
  if (duration_minutes !== undefined) data.duration_minutes = duration_minutes
  await addDoc(collection(db, 'slots'), data)
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
  /** Grid schedule; null = unscheduled (day shelf). Omit on legacy paths. */
  start_minutes?: number | null
  duration_minutes?: number | null
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
    start_minutes,
    duration_minutes,
  } = input

  const batch = writeBatch(db)
  const slotRef = doc(collection(db, 'slots'))
  const proposalRef = doc(collection(db, 'proposals'))

  const slotData: Record<string, unknown> = {
    day_id,
    trip_id,
    time_label,
    category,
    icon: suggestEmoji(title),
    status: 'locked',
    locked_proposal_id: proposalRef.id,
    sort_order,
  }
  if (start_minutes !== undefined) slotData.start_minutes = start_minutes
  if (duration_minutes !== undefined) slotData.duration_minutes = duration_minutes
  batch.set(slotRef, slotData)
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

export type UpdateSlotScheduleInput = {
  slotId: string
  /** Minutes from midnight; null parks the slot on the day shelf. */
  start_minutes: number | null
  duration_minutes: number
  /** Pass to move the slot to another day. */
  day_id?: string
  /**
   * The slot's locked proposal, if any. Its `exact_time` overrides the slot's
   * label everywhere times display, so it must move in the same batch — and be
   * cleared (with `narrative_time`) when the slot is unscheduled, or the old
   * time would keep showing and re-parse back onto the grid.
   */
  lockedProposalId?: string | null
}

/**
 * The one write path for scheduling: sets the canonical grid fields, derives
 * `time_label`, and keeps a locked proposal's time in step.
 */
export async function updateSlotSchedule(
  input: UpdateSlotScheduleInput
): Promise<void> {
  const { slotId, start_minutes, duration_minutes, day_id, lockedProposalId } = input
  const label = start_minutes === null ? '' : minutesToTimeLabel(start_minutes)

  const batch = writeBatch(db)
  const slotData: Record<string, unknown> = {
    start_minutes,
    duration_minutes,
    time_label: label,
  }
  if (day_id) slotData.day_id = day_id
  batch.update(doc(db, 'slots', slotId), slotData)

  if (lockedProposalId) {
    batch.update(
      doc(db, 'proposals', lockedProposalId),
      start_minutes === null
        ? { exact_time: null, narrative_time: null }
        : { exact_time: label }
    )
  }
  await batch.commit()
}

export async function updateSlotIcon(slotId: string, icon: string): Promise<void> {
  await updateDoc(doc(db, 'slots', slotId), { icon })
}

/**
 * Opt one event in or out of stretching the board's visible hours. Written as
 * an explicit boolean rather than deleting the field, so the drawer can show
 * the setting as deliberately off rather than merely absent.
 */
export async function updateSlotStretchesGrid(
  slotId: string,
  stretches: boolean
): Promise<void> {
  await updateDoc(doc(db, 'slots', slotId), { stretches_grid: stretches })
}

export async function lockSlot(
  slotId: string,
  locked_proposal_id: string,
  /** Title of the locked idea — used to fill in an icon when the slot has none. */
  titleForIcon?: string | null
): Promise<void> {
  const data: Record<string, unknown> = { status: 'locked', locked_proposal_id }
  const icon = titleForIcon ? suggestEmoji(titleForIcon) : null
  if (icon) data.icon = icon
  await updateDoc(doc(db, 'slots', slotId), data)
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
/**
 * Puts a deleted slot and its proposals back, ids and all, from the copy the
 * client was already holding. Firestore has no soft delete, so undo has to
 * re-mint the documents — writing them at their original ids keeps
 * `locked_proposal_id` and anything else pointing at them valid.
 */
export async function restoreSlot(
  slot: SlotWithProposals,
  /** Backfills `trip_id` on legacy documents, which the create rules require. */
  tripId: string
): Promise<void> {
  // Firestore rejects undefined, which optional legacy fields are full of.
  const defined = (o: object) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

  const batch = writeBatch(db)
  const { id, proposals, ...slotData } = slot
  batch.set(doc(db, 'slots', id), { ...defined(slotData), trip_id: slot.trip_id ?? tripId })
  for (const proposal of proposals) {
    const { id: proposalId, ...proposalData } = proposal
    batch.set(doc(db, 'proposals', proposalId), {
      ...defined(proposalData),
      trip_id: proposal.trip_id ?? tripId,
    })
  }
  await batch.commit()
}

export async function deleteSlot(slotId: string): Promise<void> {
  const proposalsSnap = await getDocs(
    query(collection(db, 'proposals'), where('slot_id', '==', slotId))
  )
  await Promise.all(proposalsSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'slots', slotId))
}
