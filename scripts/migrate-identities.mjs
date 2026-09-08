/**
 * One-time migration: key identity on uid instead of display name.
 *
 * Votes, likes, assignments and authorship used to store `useDisplayName()`'s
 * string, so two travellers with the same Google name shared one identity and a
 * rename orphaned everything that person had done. This rewrites those fields
 * to uids, resolving each name against the trip's own members.
 *
 * Fields touched, per trip:
 *   proposals        proposer_name  -> proposer_uid (name kept as a snapshot)
 *                    votes[]        -> uids, in place
 *   collection_items created_by     -> uid, with created_by_name kept alongside
 *                    likes[]        -> uids, in place
 *   stays            proposed_by    -> uid, with proposed_by_name alongside
 *   trip_todos       created_by, assigned_to, completed_by -> uids
 *   trip_notes       author_name    -> author_uid (name kept as a snapshot)
 *
 * A name that matches no current member is left exactly as it was — someone who
 * left the trip, or a legacy guest. The client compares on `uid ?? name`, so
 * those keep working; they just stay keyed on the name. Names that match more
 * than one member are left alone too, and reported, since guessing would hand
 * one person another's votes.
 *
 * Prereqs — credentials, either way round:
 * - GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON, or
 * - FIREBASE_SERVICE_ACCOUNT_JSON holding that JSON inline, which is the same
 *   variable the Netlify functions authenticate with, so you can reuse the
 *   value that's already set there instead of minting a second key.
 *
 * Usage — dry run first, which writes nothing and prints what it would do:
 *   TRIP_SLUG=your-trip-slug node scripts/migrate-identities.mjs
 *   ALL_TRIPS=1 node scripts/migrate-identities.mjs
 *
 * Then, to actually write:
 *   TRIP_SLUG=your-trip-slug APPLY=1 node scripts/migrate-identities.mjs
 *
 * Safe to run twice: a field already holding a uid is left alone.
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const tripSlug = process.env.TRIP_SLUG
const allTrips = process.env.ALL_TRIPS === '1'
const apply = process.env.APPLY === '1'

if (!tripSlug && !allTrips) {
  console.error('Set TRIP_SLUG=<slug>, or ALL_TRIPS=1 to sweep every trip.')
  console.error('Add APPLY=1 to write; without it this is a dry run.')
  process.exit(1)
}

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
if (serviceAccountJson) {
  try {
    initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) })
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.')
    process.exit(1)
  }
} else {
  // Application default credentials: GOOGLE_APPLICATION_CREDENTIALS, or the
  // emulator when FIRESTORE_EMULATOR_HOST is set.
  initializeApp()
}
const db = getFirestore()

/** Firebase uids are 28 chars of base62 in practice, and never hold a space. */
const looksLikeUid = (value) => typeof value === 'string' && /^[A-Za-z0-9]{20,}$/.test(value)

const stats = {
  proposals: 0,
  collection_items: 0,
  stays: 0,
  trip_todos: 0,
  trip_notes: 0,
}
const unresolved = new Map()
/** Reported at the end; resolution itself uses the per-trip set below. */
const ambiguousSeen = new Set()

function noteUnresolved(name) {
  unresolved.set(name, (unresolved.get(name) ?? 0) + 1)
}

async function migrateTrip(tripDoc) {
  const trip = tripDoc.data()
  const memberUids = [
    ...new Set([trip.owner_uid, ...(trip.member_uids ?? [])].filter(Boolean)),
  ]

  // uid -> display name, from the profiles the members wrote themselves.
  const profiles = await db.getAll(...memberUids.map((uid) => db.collection('users').doc(uid)))
  const byName = new Map()
  const ambiguous = new Set()
  for (const profile of profiles) {
    const name = profile.get('display_name')
    if (typeof name !== 'string' || !name.trim()) continue
    const key = name.trim().toLowerCase()
    if (byName.has(key)) {
      ambiguous.add(key)
      ambiguousSeen.add(`${name.trim()} (${trip.slug ?? tripDoc.id})`)
    } else {
      byName.set(key, profile.id)
    }
  }

  /** name -> uid, or null when it can't be resolved and must be left alone. */
  const uidFor = (value) => {
    if (typeof value !== 'string' || !value.trim()) return null
    if (looksLikeUid(value)) return null // already migrated
    const key = value.trim().toLowerCase()
    if (ambiguous.has(key)) return null
    const uid = byName.get(key)
    if (!uid) {
      noteUnresolved(value.trim())
      return null
    }
    return uid
  }

  const mapList = (list) => {
    if (!Array.isArray(list)) return null
    let changed = false
    const next = list.map((entry) => {
      const uid = uidFor(entry)
      if (uid) changed = true
      return uid ?? entry
    })
    // Two entries for one person — their name and their uid — collapse to one.
    const deduped = [...new Set(next)]
    if (deduped.length !== next.length) changed = true
    return changed ? deduped : null
  }

  const writer = db.batch()
  let queued = 0
  const queue = (ref, data) => {
    if (apply) writer.set(ref, data, { merge: true })
    queued++
  }

  const byTrip = (name) => db.collection(name).where('trip_id', '==', tripDoc.id).get()

  // ── proposals ─────────────────────────────────────────────────────────────
  const proposals = await byTrip('proposals')
  for (const doc of proposals.docs) {
    const data = doc.data()
    const update = {}
    if (!data.proposer_uid) {
      const uid = uidFor(data.proposer_name)
      if (uid) update.proposer_uid = uid
    }
    const votes = mapList(data.votes)
    if (votes) update.votes = votes
    if (Object.keys(update).length) {
      queue(doc.ref, update)
      stats.proposals++
    }
  }

  // ── collection items ──────────────────────────────────────────────────────
  const items = await byTrip('collection_items')
  for (const doc of items.docs) {
    const data = doc.data()
    const update = {}
    const creator = uidFor(data.created_by)
    if (creator) {
      update.created_by = creator
      if (!data.created_by_name) update.created_by_name = data.created_by
    }
    const likes = mapList(data.likes)
    if (likes) update.likes = likes
    if (Object.keys(update).length) {
      queue(doc.ref, update)
      stats.collection_items++
    }
  }

  // ── stays ─────────────────────────────────────────────────────────────────
  const stays = await byTrip('stays')
  for (const doc of stays.docs) {
    const data = doc.data()
    const uid = uidFor(data.proposed_by)
    if (!uid) continue
    const update = { proposed_by: uid }
    if (!data.proposed_by_name) update.proposed_by_name = data.proposed_by
    queue(doc.ref, update)
    stats.stays++
  }

  // ── to-dos ────────────────────────────────────────────────────────────────
  const todos = await byTrip('trip_todos')
  for (const doc of todos.docs) {
    const data = doc.data()
    const update = {}
    for (const field of ['created_by', 'assigned_to', 'completed_by']) {
      const uid = uidFor(data[field])
      if (uid) update[field] = uid
    }
    if (Object.keys(update).length) {
      queue(doc.ref, update)
      stats.trip_todos++
    }
  }

  // ── notes ─────────────────────────────────────────────────────────────────
  const notes = await byTrip('trip_notes')
  for (const doc of notes.docs) {
    const data = doc.data()
    if (data.author_uid) continue
    const uid = uidFor(data.author_name)
    if (!uid) continue
    queue(doc.ref, { author_uid: uid })
    stats.trip_notes++
  }

  if (apply && queued > 0) await writer.commit()
  console.log(
    `  ${trip.slug ?? tripDoc.id}: ${queued} document${queued === 1 ? '' : 's'} ` +
      `${apply ? 'updated' : 'would be updated'} (${memberUids.length} members)`
  )
}

async function main() {
  const trips = tripSlug
    ? await db.collection('trips').where('slug', '==', tripSlug).get()
    : await db.collection('trips').get()

  if (trips.empty) {
    console.error(tripSlug ? `No trip found with slug: ${tripSlug}` : 'No trips found.')
    process.exit(1)
  }

  console.log(apply ? 'Applying:' : 'Dry run — nothing will be written:')
  for (const tripDoc of trips.docs) {
    await migrateTrip(tripDoc)
  }

  console.log('\nBy collection:')
  for (const [name, count] of Object.entries(stats)) {
    console.log(`  ${name.padEnd(17)} ${count}`)
  }

  if (unresolved.size > 0) {
    console.log('\nNames left as they are (no member with that display name):')
    for (const [name, count] of [...unresolved].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name} (${count})`)
    }
    console.log('  These still work — the client compares on uid or name.')
  }
  if (ambiguousSeen.size > 0) {
    console.log('\nShared by more than one member, so left alone:')
    for (const name of ambiguousSeen) console.log(`  ${name}`)
    console.log('  Resolve these by hand — this is the bug the migration fixes.')
  }
  if (!apply) console.log('\nRe-run with APPLY=1 to write.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
