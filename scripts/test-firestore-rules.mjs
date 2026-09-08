/**
 * Tests for firestore.rules, run against the Firestore emulator.
 *
 *   npm run test:rules
 *
 * Needs a JDK on PATH for the emulator (`brew install openjdk`, which is
 * keg-only — `PATH="/usr/local/opt/openjdk/bin:$PATH" npm run test:rules`).
 *
 * Two behaviours these tests encode, both easy to get wrong by reading the
 * rules alone:
 *
 * - A `list` rule is evaluated against the query, not against the documents it
 *   returns, using a synthetic document holding only the fields the query
 *   filters on. Every query the app actually runs is exercised below for that
 *   reason; a rule that reads a field the query doesn't constrain is denied.
 * - A query's rule may make ~20 document access calls, and `in` spends one per
 *   value, so the size of the day chunk is a security constraint as well as a
 *   Firestore one. The last test in the slots block pins it.
 */
import fs from 'node:fs'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  collection, doc, query, where, orderBy, getDocs, getDoc,
  setDoc, updateDoc, addDoc, deleteDoc, arrayUnion,
} from 'firebase/firestore'

const RULES = new URL('../firestore.rules', import.meta.url)
const OWNER = 'uid_owner'
const MEMBER = 'uid_member'
const OUTSIDER = 'uid_outsider'
const TRIP = 'trip1'
const OTHER_TRIP = 'trip2'

let pass = 0, fail = 0
const results = []
async function check(name, fn) {
  try { await fn(); pass++; results.push(`  ok   ${name}`) }
  catch (e) { fail++; results.push(`  FAIL ${name}\n         ${String(e).split('\n')[0]}`) }
}

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-trup',
  firestore: { rules: fs.readFileSync(RULES, 'utf8') },
})

await testEnv.clearFirestore()
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await setDoc(doc(db, 'trips', TRIP), {
    name: 'Rome', slug: 'rome', destinations: ['Rome'],
    owner_uid: OWNER, member_uids: [OWNER, MEMBER],
    created_at: '2026-01-01T00:00:00.000Z',
  })
  await setDoc(doc(db, 'trips', OTHER_TRIP), {
    name: 'Lisbon', slug: 'lisbon', destinations: ['Lisbon'],
    owner_uid: OUTSIDER, member_uids: [OUTSIDER],
    created_at: '2026-01-02T00:00:00.000Z',
  })
  // 20 days, enough to run the day chunk the app uses (10) and one twice that
  // size, which is over the access-call budget.
  for (let i = 0; i < 20; i++) {
    await setDoc(doc(db, 'days', `day${i}`), {
      trip_id: TRIP, label: `Day ${i + 1}`, date: `2026-06-0${i + 1}`, day_number: i + 1,
    })
    // modern slot: carries trip_id
    await setDoc(doc(db, 'slots', `slot${i}`), {
      trip_id: TRIP, day_id: `day${i}`, status: 'open', sort_order: 0,
    })
    // legacy slot: no trip_id, resolvable only via its day
    await setDoc(doc(db, 'slots', `legacy${i}`), {
      day_id: `day${i}`, status: 'open', sort_order: 1,
    })
  }
  await setDoc(doc(db, 'proposals', 'prop1'), {
    trip_id: TRIP, slot_id: 'slot0', title: 'Colosseum', proposer_name: 'A', votes: [],
  })
  await setDoc(doc(db, 'proposals', 'legacyprop'), {
    slot_id: 'slot0', title: 'Forum', proposer_name: 'A', votes: [],
  })
  for (const [coll, extra] of [
    ['collection_items', { name: 'Gelato', category: 'food', likes: [] }],
    ['stays', { name: 'Hotel', proposed_by: 'A' }],
    ['trip_todos', { text: 'Book train', done: false, sort_order: 0 }],
    ['trip_notes', { text: 'hello', author_name: 'A' }],
  ]) {
    await setDoc(doc(db, coll, `${coll}1`), { trip_id: TRIP, ...extra })
  }
})

const member = testEnv.authenticatedContext(MEMBER).firestore()
const owner = testEnv.authenticatedContext(OWNER).firestore()
const outsider = testEnv.authenticatedContext(OUTSIDER).firestore()
const anon = testEnv.unauthenticatedContext().firestore()

const dayIds = Array.from({ length: 20 }, (_, i) => `day${i}`)

// ── The hole item 1 exists to close ──────────────────────────────────────────
results.push('\nOutsider (signed in, not on the trip)')
await check('cannot list every trip', () =>
  assertFails(getDocs(collection(outsider, 'trips'))))
await check('cannot resolve a trip by slug with a list', () =>
  assertFails(getDocs(query(collection(outsider, 'trips'), where('slug', '==', 'rome')))))
for (const coll of ['days', 'slots', 'proposals', 'collection_items', 'stays', 'trip_todos', 'trip_notes']) {
  await check(`cannot list ${coll}`, () =>
    assertFails(getDocs(query(collection(outsider, coll), where('trip_id', '==', TRIP)))))
}
await check('cannot list slots by day_id', () =>
  assertFails(getDocs(query(collection(outsider, 'slots'), where('day_id', 'in', dayIds.slice(0, 10))))))
await check('cannot read one day by id', () =>
  assertFails(getDoc(doc(outsider, 'days', 'day0'))))
await check('CAN read one trip by id (the invite landing page)', () =>
  assertSucceeds(getDoc(doc(outsider, 'trips', TRIP))))

results.push('\nTakeover chain')
await check('cannot evict the existing members', () =>
  assertFails(updateDoc(doc(outsider, 'trips', TRIP), { member_uids: [OUTSIDER] })))
await check('cannot add a third party alongside itself', () =>
  assertFails(updateDoc(doc(outsider, 'trips', TRIP), { member_uids: [OWNER, MEMBER, OUTSIDER, 'uid_pal'] })))
await check('cannot take ownership', () =>
  assertFails(updateDoc(doc(outsider, 'trips', TRIP), { owner_uid: OUTSIDER })))
await check('cannot smuggle owner_uid in with a name edit', () =>
  assertFails(updateDoc(doc(outsider, 'trips', TRIP), { name: 'Mine', owner_uid: OUTSIDER })))
await check('CAN join by adding only itself', () =>
  assertSucceeds(updateDoc(doc(outsider, 'trips', TRIP), { member_uids: arrayUnion(OUTSIDER) })))
await check('joining twice is idempotent', () =>
  assertSucceeds(updateDoc(doc(outsider, 'trips', TRIP), { member_uids: arrayUnion(OUTSIDER) })))

results.push('\nMember, once a member (every real client query)')
await check('listUserTrips: owner_uid == + orderBy', () =>
  assertSucceeds(getDocs(query(collection(owner, 'trips'), where('owner_uid', '==', OWNER), orderBy('created_at', 'desc')))))
await check('listUserTrips: member_uids array-contains + orderBy', () =>
  assertSucceeds(getDocs(query(collection(member, 'trips'), where('member_uids', 'array-contains', MEMBER), orderBy('created_at', 'desc')))))
await check('trip doc snapshot by id', () =>
  assertSucceeds(getDoc(doc(member, 'trips', TRIP))))
await check('days where trip_id ==', () =>
  assertSucceeds(getDocs(query(collection(member, 'days'), where('trip_id', '==', TRIP)))))
await check('proposals where trip_id ==', () =>
  assertSucceeds(getDocs(query(collection(member, 'proposals'), where('trip_id', '==', TRIP)))))
await check('proposals where slot_id == (legacy doc, no trip_id)', () =>
  assertSucceeds(getDocs(query(collection(member, 'proposals'), where('slot_id', '==', 'slot0')))))
await check('single proposal by id', () =>
  assertSucceeds(getDoc(doc(member, 'proposals', 'prop1'))))
for (const coll of ['collection_items', 'stays', 'trip_todos']) {
  await check(`${coll} where trip_id ==`, () =>
    assertSucceeds(getDocs(query(collection(member, coll), where('trip_id', '==', TRIP)))))
}

results.push('\nSlots by day_id — the access-call ceiling')
await check('10 days of modern slots (trip_id short-circuit)', () =>
  assertSucceeds(getDocs(query(collection(member, 'slots'), where('day_id', 'in', dayIds.slice(0, 10)), where('trip_id', '==', TRIP)))))
await check('10 days, modern + legacy slots mixed', () =>
  assertSucceeds(getDocs(query(collection(member, 'slots'), where('day_id', 'in', dayIds.slice(0, 10))))))
await check('2 days, modern + legacy slots mixed', () =>
  assertSucceeds(getDocs(query(collection(member, 'slots'), where('day_id', 'in', dayIds.slice(10, 12))))))
// `in` spends one access call per value, so a chunk of 20 needs 21 and the rule
// is cut off. This is what makes IN_QUERY_MAX a security constraint: it has to
// stay under ~19 even though Firestore itself now permits 30.
await check('20 days at once exceeds the access-call budget (guards IN_QUERY_MAX)', () =>
  assertFails(getDocs(query(collection(member, 'slots'), where('day_id', 'in', dayIds)))))

results.push('\nMember writes')
await check('edit trip name and dates', () =>
  assertSucceeds(updateDoc(doc(member, 'trips', TRIP), { name: 'Rome, again', start_date: '2026-06-01' })))
await check('member cannot change owner_uid', () =>
  assertFails(updateDoc(doc(member, 'trips', TRIP), { owner_uid: MEMBER })))
await check('member cannot rewrite member_uids', () =>
  assertFails(updateDoc(doc(member, 'trips', TRIP), { member_uids: [MEMBER] })))
await check('member cannot delete the trip', () =>
  assertFails(deleteDoc(doc(member, 'trips', TRIP))))
await check('create a trip owned by self', () =>
  assertSucceeds(addDoc(collection(member, 'trips'), {
    name: 'New', slug: 'new', destinations: [], owner_uid: MEMBER, member_uids: [MEMBER],
    created_at: '2026-02-01T00:00:00.000Z',
  })))
await check('add a day', () =>
  assertSucceeds(addDoc(collection(member, 'days'), { trip_id: TRIP, label: 'Day 13', date: '2026-06-13', day_number: 13 })))
await check('propose under your own uid', () =>
  assertSucceeds(addDoc(collection(member, 'proposals'), {
    trip_id: TRIP, slot_id: 'slot0', title: 'Trevi',
    proposer_uid: MEMBER, proposer_name: 'M', votes: [],
  })))
await check('cannot propose under someone else’s uid', () =>
  assertFails(addDoc(collection(member, 'proposals'), {
    trip_id: TRIP, slot_id: 'slot0', title: 'Forged',
    proposer_uid: OWNER, proposer_name: 'O', votes: [],
  })))
await check('a pre-migration client, with no uid at all, still works', () =>
  assertSucceeds(addDoc(collection(member, 'proposals'), {
    trip_id: TRIP, slot_id: 'slot0', title: 'Legacy', proposer_name: 'M', votes: [],
  })))
await check('add a collection item', () =>
  assertSucceeds(addDoc(collection(member, 'collection_items'), { trip_id: TRIP, name: 'Trastevere', category: 'activity', likes: [] })))
await check('update a legacy slot (no trip_id)', () =>
  assertSucceeds(updateDoc(doc(member, 'slots', 'legacy0'), { day_id: 'day0', status: 'proposed' })))

results.push('\nOutsider writes to a trip it is not on')
await check('cannot add a day to someone else’s trip', () =>
  assertFails(addDoc(collection(testEnv.authenticatedContext('uid_nobody').firestore(), 'days'), { trip_id: TRIP, label: 'x', date: '2026-06-01', day_number: 1 })))

results.push('\nSigned out')
await check('cannot read a trip', () => assertFails(getDoc(doc(anon, 'trips', TRIP))))
await check('cannot list trips', () => assertFails(getDocs(collection(anon, 'trips'))))
await check('cannot list days', () =>
  assertFails(getDocs(query(collection(anon, 'days'), where('trip_id', '==', TRIP)))))

console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
await testEnv.cleanup()
process.exit(fail ? 1 : 0)
