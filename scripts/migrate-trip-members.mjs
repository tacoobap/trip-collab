/**
 * One-time migration: set or add owner_uid and member_uids on an existing trip.
 *
 * Prereqs:
 * - Firebase project with Firestore
 * - Service account key: set GOOGLE_APPLICATION_CREDENTIALS to the path to your
 *   service account JSON, or run in an environment that has it (e.g. GCP).
 *
 * Usage (add one member at a time — run once per person):
 *   TRIP_SLUG=your-trip-slug ADD_MEMBER_UID=uid node scripts/migrate-trip-members.mjs
 *
 * Usage (add several members in one go):
 *   TRIP_SLUG=your-trip-slug ADD_MEMBER_UIDS=uid1,uid2,uid3 node scripts/migrate-trip-members.mjs
 *
 * Usage (set full list in one shot):
 *   TRIP_SLUG=your-trip-slug MEMBER_UIDS=uid1,uid2,... [OWNER_UID=uid1] node scripts/migrate-trip-members.mjs
 *
 * When adding: the first UID you add becomes owner. Later adds only extend member_uids.
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const tripSlug = process.env.TRIP_SLUG
const memberUidsRaw = process.env.MEMBER_UIDS
const addMemberUid = process.env.ADD_MEMBER_UID
const addMemberUidsRaw = process.env.ADD_MEMBER_UIDS
const ownerUid = process.env.OWNER_UID

const isAddMode = addMemberUid || addMemberUidsRaw
const isSetMode = memberUidsRaw

if (!tripSlug) {
  console.error('TRIP_SLUG is required.')
  console.error('Add one member:  TRIP_SLUG=slug ADD_MEMBER_UID=uid node scripts/migrate-trip-members.mjs')
  console.error('Add several:     TRIP_SLUG=slug ADD_MEMBER_UIDS=uid1,uid2 node scripts/migrate-trip-members.mjs')
  console.error('Set full list:   TRIP_SLUG=slug MEMBER_UIDS=uid1,uid2,... [OWNER_UID=uid] node scripts/migrate-trip-members.mjs')
  process.exit(1)
}

if (!isAddMode && !isSetMode) {
  console.error('Use ADD_MEMBER_UID, ADD_MEMBER_UIDS, or MEMBER_UIDS. See usage above.')
  process.exit(1)
}

let uidsToAdd = []
if (isAddMode) {
  if (addMemberUid) {
    uidsToAdd = [addMemberUid.trim()].filter(Boolean)
  } else {
    uidsToAdd = addMemberUidsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  if (uidsToAdd.length === 0) {
    console.error('ADD_MEMBER_UID or ADD_MEMBER_UIDS must contain at least one UID')
    process.exit(1)
  }
}

let memberUids = []
let effectiveOwner = null
if (isSetMode) {
  memberUids = memberUidsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  if (memberUids.length === 0) {
    console.error('MEMBER_UIDS must be a comma-separated list of Firebase UIDs')
    process.exit(1)
  }
  effectiveOwner = ownerUid?.trim() || memberUids[0]
  if (!memberUids.includes(effectiveOwner)) {
    console.error('OWNER_UID must be one of the UIDs in MEMBER_UIDS')
    process.exit(1)
  }
}

initializeApp()
const db = getFirestore()

async function main() {
  const tripsSnap = await db.collection('trips').where('slug', '==', tripSlug).get()
  if (tripsSnap.empty) {
    console.error(`No trip found with slug: ${tripSlug}`)
    process.exit(1)
  }
  const tripDoc = tripsSnap.docs[0]
  const data = tripDoc.data()

  if (isAddMode) {
    const existingOwner = data.owner_uid || null
    const existingMembers = Array.isArray(data.member_uids) ? [...data.member_uids] : []
    const combined = [...existingMembers]
    for (const uid of uidsToAdd) {
      if (!combined.includes(uid)) combined.push(uid)
    }
    const newOwner = existingOwner || uidsToAdd[0]
    await tripDoc.ref.update({
      owner_uid: newOwner,
      member_uids: combined,
    })
    const added = uidsToAdd.filter((u) => !existingMembers.includes(u))
    console.log(
      `Updated trip "${tripDoc.id}" (slug: ${tripSlug}): added ${added.length} member(s). ` +
        `owner_uid=${newOwner}, member_uids=[${combined.length} members]`
    )
    return
  }

  await tripDoc.ref.update({
    owner_uid: effectiveOwner,
    member_uids: memberUids,
  })
  console.log(
    `Updated trip "${tripDoc.id}" (slug: ${tripSlug}): owner_uid=${effectiveOwner}, member_uids=[${memberUids.length} members]`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
