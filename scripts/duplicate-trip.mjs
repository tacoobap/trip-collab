/**
 * Duplicate an existing trip (and its related data) to a new trip,
 * and optionally assign a new owner/member.
 *
 * This is useful for legacy trips created before auth was added, or
 * when you just want a copy of an existing itinerary.
 *
 * Prereqs:
 * - Firebase project with Firestore
 * - Service account key: set GOOGLE_APPLICATION_CREDENTIALS to the path to your
 *   service account JSON, or run in an environment that has it (e.g. GCP).
 *
 * Env vars:
 *   SOURCE_TRIP_SLUG  (required)  — slug of the existing trip to copy
 *   NEW_OWNER_UID     (optional)  — Firebase UID who should own the new trip
 *   NEW_TRIP_SLUG     (optional)  — slug for the new trip; if omitted, a
 *                                   unique slug is generated from the source
 *
 * Usage:
 *   SOURCE_TRIP_SLUG=paris-2024-m5x9k NEW_OWNER_UID=abc123 \
 *     node scripts/duplicate-trip.mjs
 *
 *   # Let the script generate a new slug automatically:
 *   SOURCE_TRIP_SLUG=paris-2024-m5x9k NEW_OWNER_UID=abc123 \
 *     node scripts/duplicate-trip.mjs
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const sourceSlug = process.env.SOURCE_TRIP_SLUG
const newOwnerUid = process.env.NEW_OWNER_UID || null
const explicitNewSlug = process.env.NEW_TRIP_SLUG || null

if (!sourceSlug) {
  console.error('SOURCE_TRIP_SLUG is required.')
  console.error('Example:')
  console.error('  SOURCE_TRIP_SLUG=paris-2024-m5x9k NEW_OWNER_UID=abc123 node scripts/duplicate-trip.mjs')
  process.exit(1)
}

initializeApp()
const db = getFirestore()

async function duplicateTrip() {
  console.log(`Looking up source trip with slug="${sourceSlug}"…`)

  const tripsSnap = await db.collection('trips').where('slug', '==', sourceSlug).get()
  if (tripsSnap.empty) {
    console.error(`No trip found with slug: ${sourceSlug}`)
    process.exit(1)
  }

  const sourceTripDoc = tripsSnap.docs[0]
  const sourceTripId = sourceTripDoc.id
  const sourceData = sourceTripDoc.data()

  const baseSlug = explicitNewSlug || `${sourceData.slug || sourceSlug}-${Date.now().toString(36)}`
  const newSlug = baseSlug

  const ownerUid = newOwnerUid || sourceData.owner_uid || null
  let memberUids = Array.isArray(sourceData.member_uids) ? [...sourceData.member_uids] : []
  if (ownerUid && !memberUids.includes(ownerUid)) {
    memberUids.push(ownerUid)
  }

  const { id: _ignoredId, ...restTripData } = sourceData
  const newTripData = {
    ...restTripData,
    slug: newSlug,
    owner_uid: ownerUid,
    member_uids: memberUids,
  }

  console.log(`Creating duplicated trip with slug="${newSlug}" (owner_uid=${ownerUid ?? 'null'})…`)
  const newTripRef = await db.collection('trips').add(newTripData)
  const newTripId = newTripRef.id
  console.log(`New trip created: id="${newTripId}", slug="${newSlug}"`)

  // ----- Clone days -----
  const daysSnap = await db.collection('days').where('trip_id', '==', sourceTripId).get()
  const dayIdMap = new Map()

  console.log(`Cloning ${daysSnap.size} day(s)…`)
  for (const dayDoc of daysSnap.docs) {
    const dayData = dayDoc.data()
    const { id: _dayId, trip_id: _oldTripId, ...restDay } = dayData
    const newDayData = {
      ...restDay,
      trip_id: newTripId,
    }
    const newDayRef = await db.collection('days').add(newDayData)
    dayIdMap.set(dayDoc.id, newDayRef.id)
  }

  // ----- Clone slots -----
  const slotIdMap = new Map()
  const lockedProposalsByOldSlot = new Map()

  const oldDayIds = Array.from(dayIdMap.keys())
  console.log(`Cloning slots for ${oldDayIds.length} day(s)…`)

  async function cloneSlotsForDayIds(dayIdsChunk) {
    if (dayIdsChunk.length === 0) return
    const slotsSnap = await db.collection('slots').where('day_id', 'in', dayIdsChunk).get()
    for (const slotDoc of slotsSnap.docs) {
      const slotData = slotDoc.data()
      const { id: _slotId, trip_id: _oldTripId, day_id: oldDayId, locked_proposal_id, ...restSlot } = slotData
      const newDayId = dayIdMap.get(oldDayId)
      if (!newDayId) continue

      const newSlotData = {
        ...restSlot,
        day_id: newDayId,
        trip_id: newTripId,
        locked_proposal_id: null,
      }

      const newSlotRef = await db.collection('slots').add(newSlotData)
      slotIdMap.set(slotDoc.id, newSlotRef.id)

      if (locked_proposal_id) {
        lockedProposalsByOldSlot.set(slotDoc.id, locked_proposal_id)
      }
    }
  }

  // Firestore `in` queries support up to 10 values; chunk day ids.
  for (let i = 0; i < oldDayIds.length; i += 10) {
    const chunk = oldDayIds.slice(i, i + 10)
    // eslint-disable-next-line no-await-in-loop
    await cloneSlotsForDayIds(chunk)
  }

  // ----- Clone proposals -----
  const proposalIdMap = new Map()
  const oldSlotIds = Array.from(slotIdMap.keys())
  console.log(`Cloning proposals for ${oldSlotIds.length} slot(s)…`)

  async function cloneProposalsForSlotIds(slotIdsChunk) {
    if (slotIdsChunk.length === 0) return
    const proposalsSnap = await db.collection('proposals').where('slot_id', 'in', slotIdsChunk).get()
    for (const proposalDoc of proposalsSnap.docs) {
      const proposalData = proposalDoc.data()
      const { id: _proposalId, slot_id: oldSlotId, trip_id: _oldTripId, ...restProposal } = proposalData
      const newSlotId = slotIdMap.get(oldSlotId)
      if (!newSlotId) continue

      const newProposalData = {
        ...restProposal,
        slot_id: newSlotId,
        trip_id: newTripId,
      }

      const newProposalRef = await db.collection('proposals').add(newProposalData)
      proposalIdMap.set(proposalDoc.id, newProposalRef.id)
    }
  }

  for (let i = 0; i < oldSlotIds.length; i += 10) {
    const chunk = oldSlotIds.slice(i, i + 10)
    // eslint-disable-next-line no-await-in-loop
    await cloneProposalsForSlotIds(chunk)
  }

  // ----- Patch locked_proposal_id on cloned slots -----
  console.log('Updating locked slots…')
  for (const [oldSlotId, oldLockedProposalId] of lockedProposalsByOldSlot.entries()) {
    const newSlotId = slotIdMap.get(oldSlotId)
    if (!newSlotId) continue
    const newLockedProposalId = proposalIdMap.get(oldLockedProposalId) || null
    // eslint-disable-next-line no-await-in-loop
    await db.collection('slots').doc(newSlotId).update({
      locked_proposal_id: newLockedProposalId,
    })
  }

  // ----- Clone stays -----
  const staysSnap = await db.collection('stays').where('trip_id', '==', sourceTripId).get()
  console.log(`Cloning ${staysSnap.size} stay(s)…`)
  for (const stayDoc of staysSnap.docs) {
    const stayData = stayDoc.data()
    const { id: _stayId, trip_id: _oldTripId, ...restStay } = stayData
    const newStayData = {
      ...restStay,
      trip_id: newTripId,
    }
    // eslint-disable-next-line no-await-in-loop
    await db.collection('stays').add(newStayData)
  }

  // ----- Clone collection_items -----
  const itemsSnap = await db.collection('collection_items').where('trip_id', '==', sourceTripId).get()
  console.log(`Cloning ${itemsSnap.size} collection item(s)…`)
  for (const itemDoc of itemsSnap.docs) {
    const itemData = itemDoc.data()
    const { id: _itemId, trip_id: _oldTripId, ...restItem } = itemData
    const newItemData = {
      ...restItem,
      trip_id: newTripId,
    }
    // eslint-disable-next-line no-await-in-loop
    await db.collection('collection_items').add(newItemData)
  }

  // ----- Clone trip_notes (if any) -----
  try {
    const notesSnap = await db.collection('trip_notes').where('trip_id', '==', sourceTripId).get()
    if (!notesSnap.empty) {
      console.log(`Cloning ${notesSnap.size} trip note(s)…`)
      for (const noteDoc of notesSnap.docs) {
        const noteData = noteDoc.data()
        const { id: _noteId, trip_id: _oldTripId, ...restNote } = noteData
        const newNoteData = {
          ...restNote,
          trip_id: newTripId,
        }
        // eslint-disable-next-line no-await-in-loop
        await db.collection('trip_notes').add(newNoteData)
      }
    }
  } catch (err) {
    console.warn('Skipping trip_notes clone (collection may not exist):', err?.message ?? err)
  }

  console.log('Done.')
  console.log(`New trip id:   ${newTripId}`)
  console.log(`New trip slug: ${newSlug}`)
  console.log(`Open this URL in the app: /trip/${newSlug}`)
}

duplicateTrip().catch((err) => {
  console.error(err)
  process.exit(1)
})

