/**
 * Tests the client half of the read rules: what a member, an invitee, and an
 * invitee who has just joined can actually load.
 *
 *   npm run test:access
 *
 * Needs a JDK on PATH for the emulator, like `npm run test:rules`.
 *
 * `firestore.rules` is enforced here, so this covers the seam the rules tests
 * can't: the real `getTripBySlug` and `subscribeToTrip` running against it. Two
 * bugs that live in that seam, both of which this caught and now guards:
 *
 * - Days are members-only, so an invitee's itinerary listener is refused. If
 *   the subscription opens it anyway, `rebuild()` never runs, `setLoading(false)`
 *   never fires, and the join screen sits on a spinner for ever.
 * - Firestore fires the trip listener optimistically off the local write when
 *   someone joins. A listener opened on that snapshot races the write to the
 *   server and is refused by rules that still see the old member_uids — and a
 *   refused listener stays dead, so the board stays empty until a reload.
 *
 * The services are bundled with `@/lib/firebase` swapped for a stub, which is
 * what lets the emulator's Firestore be handed to code that normally builds its
 * own from `VITE_*` env vars.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore'

const repo = fileURLToPath(new URL('..', import.meta.url))

/**
 * Which rules to run the client against. Defaults to the working copy; point it
 * at the deployed version to check that this client still works under the rules
 * that are live, which is what makes it safe to ship the app before the rules:
 *
 *   git show HEAD:firestore.rules > /tmp/live.rules
 *   RULES_FILE=/tmp/live.rules npm run test:access
 */
const rulesFile = process.env.RULES_FILE || path.join(repo, 'firestore.rules')
// Inside node_modules so the bundle's own `firebase` imports resolve, and out
// of the way of the source tree.
const outdir = fs.mkdtempSync(path.join(repo, 'node_modules', '.trup-access-'))
const outfile = path.join(outdir, 'services.mjs')

// Hands the services a Firestore of our choosing in place of the real one.
const firebaseStub = {
  name: 'firebase-stub',
  setup(build) {
    build.onResolve({ filter: /^@\/lib\/firebase$/ }, () => ({ path: 'firebase-stub', namespace: 'stub' }))
    build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: `
        export let db
        export let auth = { currentUser: null }
        export function __setFirebase(d, a) { db = d; auth = a }
      `,
      loader: 'js',
    }))
  },
}

await esbuild.build({
  stdin: {
    contents: `
      export { getTripBySlug, joinTrip } from '@/services/tripService'
      export { subscribeToTrip } from '@/services/tripSubscription'
      export { __setFirebase } from '@/lib/firebase'
    `,
    resolveDir: repo,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  tsconfig: path.join(repo, 'tsconfig.app.json'),
  external: ['firebase/firestore', 'firebase/auth'],
  plugins: [firebaseStub],
  logLevel: 'warning',
})

const { getTripBySlug, joinTrip, subscribeToTrip, __setFirebase } = await import(outfile)

const MEMBER = 'uid_member'
const INVITEE = 'uid_invitee'

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-trup-access',
  firestore: { rules: fs.readFileSync(rulesFile, 'utf8') },
})
await testEnv.clearFirestore()
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await setDoc(doc(db, 'trips', 'trip1'), {
    name: 'Rome', slug: 'rome', destinations: ['Rome'],
    owner_uid: MEMBER, member_uids: [MEMBER], created_at: '2026-01-01T00:00:00.000Z',
  })
  for (let i = 0; i < 3; i++) {
    await setDoc(doc(db, 'days', `day${i}`), {
      trip_id: 'trip1', label: `Day ${i + 1}`, date: `2026-06-0${i + 1}`, day_number: i + 1,
    })
    await setDoc(doc(db, 'slots', `slot${i}`), {
      trip_id: 'trip1', day_id: `day${i}`, status: 'open', sort_order: 0,
    })
  }
  await setDoc(doc(db, 'proposals', 'p1'), {
    trip_id: 'trip1', slot_id: 'slot0', title: 'Colosseum', proposer_name: 'A', votes: [],
  })
})

// Stands in for netlify/functions/resolve-trip, which reads with the Admin SDK.
globalThis.fetch = async (url, init) => {
  if (!String(url).includes('resolve-trip')) throw new Error(`unexpected fetch: ${url}`)
  if (!init?.headers?.Authorization?.startsWith('Bearer ')) {
    return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) }
  }
  const { slug } = JSON.parse(init.body)
  let id = null
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDocs(query(collection(ctx.firestore(), 'trips'), where('slug', '==', slug)))
    if (!snap.empty) id = snap.docs[0].id
  })
  return id
    ? { ok: true, status: 200, json: async () => ({ id }) }
    : { ok: false, status: 404, json: async () => ({ error: 'Not found' }) }
}

const asUser = (uid) =>
  __setFirebase(testEnv.authenticatedContext(uid).firestore(), {
    currentUser: { getIdToken: async () => `token-${uid}` },
  })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function watch(slug, uid) {
  const state = { trip: null, days: [], error: '', loading: true }
  const stop = subscribeToTrip(slug, uid, {
    setTrip: (t) => { state.trip = t },
    setDays: (d) => { state.days = d },
    setError: (e) => { state.error = e },
    setLoading: (l) => { state.loading = l },
  })
  return { state, stop }
}

let fail = 0
const say = (ok, msg) => { if (!ok) fail++; console.log(`${ok ? '  ok  ' : '  FAIL'} ${msg}`) }

console.log('\nMember opening their own trip')
asUser(MEMBER)
const direct = await getTripBySlug('rome', MEMBER)
say(direct?.id === 'trip1', `getTripBySlug resolves from own trips (got ${direct?.id})`)
const m = watch('rome', MEMBER)
await sleep(1500)
say(m.state.trip?.name === 'Rome', `trip loaded (${m.state.trip?.name})`)
say(m.state.days.length === 3, `days loaded (got ${m.state.days.length})`)
say(m.state.days[0]?.slots?.length === 1, `slots loaded (got ${m.state.days[0]?.slots?.length})`)
say(m.state.days[0]?.slots?.[0]?.proposals?.length === 1, 'proposals loaded')
say(m.state.loading === false, 'finished loading')
say(m.state.error === '', `no error (got "${m.state.error}")`)
m.stop()

console.log('\nInvitee arriving on the link, not a member yet')
asUser(INVITEE)
const viaServer = await getTripBySlug('rome', INVITEE)
say(viaServer?.id === 'trip1', `falls back to the server resolver (got ${viaServer?.id})`)
const i = watch('rome', INVITEE)
await sleep(1500)
say(i.state.trip?.name === 'Rome', 'trip is readable, so the join screen has something to show')
say(i.state.days.length === 0, `itinerary stays empty (got ${i.state.days.length})`)
say(i.state.loading === false, 'does not hang on the spinner')
say(i.state.error === '', `no error banner (got "${i.state.error}")`)

console.log('\nInvitee joins')
await joinTrip('trip1', INVITEE)
await sleep(2500)
say(i.state.days.length === 3, `itinerary opens live, no reload (got ${i.state.days.length})`)
say(i.state.error === '', `still no error (got "${i.state.error}")`)
i.stop()

console.log('\nUnknown slug')
say((await getTripBySlug('nope', INVITEE)) === null, 'returns null, so the page says "Trip not found."')

console.log(`\n${fail === 0 ? 'all checks passed' : `${fail} FAILED`}`)
await testEnv.cleanup()
fs.rmSync(outdir, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
