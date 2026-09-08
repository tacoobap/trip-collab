/**
 * One-time migration: stamp `trip_id` on slots and proposals that predate it.
 *
 * Slots and proposals have carried `trip_id` since the rules started requiring
 * it on create, but documents written before that only reference their parent
 * (a slot names its day, a proposal names its slot). `firestore.rules` carries a
 * fallback for them — resolve the day, then the day's trip — and that fallback
 * is what makes a slots query cost one document read per day in the query
 * rather than one for the whole thing.
 *
 * Once every document names its own trip, the fallback can go, the client can
 * filter on `trip_id`, and the rule costs one read regardless of query size.
 *
 * Prereqs — credentials, either way round:
 * - GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON, or
 * - FIREBASE_SERVICE_ACCOUNT_JSON holding that JSON inline.
 *
 * Usage — dry run first:
 *   node scripts/backfill-trip-ids.mjs
 *   APPLY=1 node scripts/backfill-trip-ids.mjs
 *
 * Safe to re-run: a document that already names its trip is skipped.
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const apply = process.env.APPLY === '1'

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
if (serviceAccountJson) {
  try {
    initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) })
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.')
    process.exit(1)
  }
} else {
  initializeApp()
}
const db = getFirestore()

async function main() {
  // Days are the root of both chains and already all carry trip_id.
  const days = await db.collection('days').get()
  const dayToTrip = new Map(days.docs.map((d) => [d.id, d.get('trip_id')]))
  const orphanDays = days.docs.filter((d) => !d.get('trip_id')).length
  if (orphanDays > 0) {
    console.error(`${orphanDays} days have no trip_id; fix those first.`)
    process.exit(1)
  }

  const slots = await db.collection('slots').get()
  const slotToDay = new Map(slots.docs.map((s) => [s.id, s.get('day_id')]))

  const writes = []
  const orphans = []

  for (const slot of slots.docs) {
    if (slot.get('trip_id')) continue
    const tripId = dayToTrip.get(slot.get('day_id'))
    if (!tripId) {
      orphans.push(`slots/${slot.id} (day ${slot.get('day_id') ?? '—'})`)
      continue
    }
    writes.push({ ref: slot.ref, tripId, what: `slots/${slot.id}` })
  }

  const proposals = await db.collection('proposals').get()
  for (const proposal of proposals.docs) {
    if (proposal.get('trip_id')) continue
    const dayId = slotToDay.get(proposal.get('slot_id'))
    const tripId = dayId ? dayToTrip.get(dayId) : undefined
    if (!tripId) {
      orphans.push(`proposals/${proposal.id} (slot ${proposal.get('slot_id') ?? '—'})`)
      continue
    }
    writes.push({ ref: proposal.ref, tripId, what: `proposals/${proposal.id}` })
  }

  const byTrip = new Map()
  for (const w of writes) byTrip.set(w.tripId, (byTrip.get(w.tripId) ?? 0) + 1)

  console.log(apply ? 'Applying:' : 'Dry run — nothing will be written:')
  console.log(`  ${writes.length} document${writes.length === 1 ? '' : 's'} to stamp`)
  for (const [tripId, count] of byTrip) {
    const trip = await db.collection('trips').doc(tripId).get()
    console.log(`    ${(trip.get('slug') ?? tripId).padEnd(30)} ${count}`)
  }
  for (const w of writes.slice(0, 3)) console.log(`    e.g. ${w.what} -> ${w.tripId}`)

  if (orphans.length > 0) {
    console.log(`\n  ${orphans.length} left alone — their parent is missing:`)
    for (const o of orphans.slice(0, 10)) console.log(`    ${o}`)
    console.log('  These are unreachable from the board already; deleting them is a separate call.')
  }

  if (apply && writes.length > 0) {
    // Batches cap at 500 writes.
    for (let i = 0; i < writes.length; i += 400) {
      const batch = db.batch()
      for (const w of writes.slice(i, i + 400)) batch.set(w.ref, { trip_id: w.tripId }, { merge: true })
      await batch.commit()
    }
    console.log('\n  done')
  } else if (!apply) {
    console.log('\nRe-run with APPLY=1 to write.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
