# Trup — Trip planning, together

Collaborative trip itinerary planning. Create a trip, add days and time slots, propose ideas, vote, and lock in the plan. View a polished itinerary and manage a shared collection of ideas. Export the itinerary as a PDF, or share a read-only link that needs no account.

**Stack:** React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Firebase (Firestore). Optional: Netlify (hosting + serverless functions), Gemini (narrative copy), Unsplash (images).

## Develop locally

```bash
npm install
cp .env.example .env
# Edit .env with your Firebase config (required) and optional keys
npm run dev
```

- **Firebase** — Required. Create a project at [Firebase Console](https://console.firebase.google.com), enable Firestore, and set the `VITE_FIREBASE_*` variables in `.env`.
- **Gemini** — Optional. Used for “Generate text” on the itinerary and “Suggest something for me” on the collection. Set `VITE_GEMINI_API_KEY`.
- **Unsplash** — Optional. Used for hero/day images and suggestion thumbnails. Set `VITE_UNSPLASH_ACCESS_KEY`. In production, use the Netlify function so the key stays server-side (`UNSPLASH_ACCESS_KEY` in Netlify env).
- **GitHub (image upload)** — Optional. **Production / Netlify:** set **`GITHUB_TOKEN`**, **`GITHUB_OWNER`**, **`GITHUB_REPO`** (no `VITE_` prefix) so `upload-github-image` can call the GitHub API; the PAT must not be in client env vars or Netlify will flag `ghp_` in `dist`. **Local `npm run dev` only:** you can set `VITE_GITHUB_*` in `.env` for direct uploads without `netlify dev`.
- **Google Analytics** — Optional. Set `VITE_GA_MEASUREMENT_ID` to your GA4 Measurement ID (e.g. `G-XXXXXXXXXX`). See below for how to get it and view data.

## Google Analytics (viewing data)

1. **Create a GA4 property** (if you don’t have one): go to [analytics.google.com](https://analytics.google.com) → **Admin** (gear) → **Create property** → choose **Web** and finish setup.
2. **Get your Measurement ID**: Admin → **Data streams** → select your web stream → copy the **Measurement ID** (e.g. `G-XXXXXXXXXX`). Put it in `.env` as `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` and redeploy (or restart `npm run dev`).
3. **View data**: In [Google Analytics](https://analytics.google.com), use **Reports** (left sidebar):
   - **Acquisition** → **User acquisition** / **Traffic acquisition** — where users come from.
   - **Engagement** → **Pages and screens** — which routes (e.g. `/`, `/trip/…`) get traffic.
   - **Engagement** → **Events** — default events (e.g. `page_view`, `session_start`) and any custom events you send.
   - **Realtime** — current users and pages right now.

Data can take up to 24–48 hours to appear in standard reports; **Realtime** updates within seconds.

## Sharing an itinerary

Trip settings (profile menu → **Trip settings**) can mint a public link at `/i/<token>`. Anyone with it sees the current itinerary — no account, no sign-in — and it reflects edits on their next load.

`firestore.rules` is **not** opened up for this. The link is served by the `shared-trip` function, which reads through the Firebase Admin SDK; because that authenticates as a service account, it bypasses security rules entirely, so unauthenticated clients still have no direct Firestore access. The token is minted server-side, looked up server-side, and stripped from the response.

Turn a link off in Trip settings. That takes effect immediately, and creating a new one later issues a different address. The shared page sets `noindex` so a forwarded link stays out of search results.

### Link previews

Paste either link — the invite at `/trip/:slug` or the public itinerary at `/i/:token` — into a chat and the preview shows that trip's cover photo with the `Trup` lockup above its name, rather than the generic card every URL used to return.

Both addresses are redirected (in `netlify.toml`, **above** the SPA catch-all) to the `link-preview` function, which rewrites the `og:` and `twitter:` tags before serving the same `index.html`. Only crawlers pay for that: a browser's request never touches Firestore, and `firebase-admin` is imported lazily so it isn't even initialised on that path. `og:title` is deliberately the wordmark on every link; the trip's own name rides in `og:description` and on the card.

The card itself comes from `og-image`, which lays it out with satori and rasterises it with resvg — the cover photo is cropped to 1200×630 through Netlify's image CDN first, so the hosts `image_url` can point at have to stay listed under `[images] remote_images`. Its fonts and resvg's wasm live in `public/og/` and are fetched from the CDN at runtime rather than bundled. A trip with no cover photo gets the same card over the app's navy-to-golden wash.

Note that this makes a trip's name, cover photo and dates readable by anyone holding the URL, without signing in — which is what a link preview is. The slug's random suffix is still the only thing gating an invite link, exactly as before.

## Scripts

| Command   | Description        |
|----------|--------------------|
| `npm run dev`    | Start dev server   |
| `npm run build`  | TypeScript + Vite build |
| `npm run preview`| Preview production build |
| `npm run lint`   | Run ESLint        |

## One-time migration: assign members to an existing trip

After you’ve enabled auth and have a trip that was created before `owner_uid` / `member_uids` existed, you can assign members so they can access it. You can add UIDs **one at a time** as people sign in, or set the full list in one go.

**1. Get the trip slug.**  
From the trip URL (e.g. `/trip/paris-2026-m5x9k`), the slug is `paris-2026-m5x9k`.

**2. Each time someone signs in, get their Firebase UID.**  
- Open [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Users**.  
- Find the user and copy their **User UID** (long string like `abc123xyz...`).

**3. Add them to the trip (run once per person, or batch a few).**  
From the project root:

```bash
# Add one member (run this each time you have a new UID)
TRIP_SLUG=paris-2026-m5x9k ADD_MEMBER_UID=their-uid-here node scripts/migrate-trip-members.mjs
```

- The **first** UID you add becomes the trip **owner**. Every run after that only **adds** that UID to `member_uids` (no duplicates).
- To add several in one go:  
  `TRIP_SLUG=paris-2026-m5x9k ADD_MEMBER_UIDS=uid1,uid2,uid3 node scripts/migrate-trip-members.mjs`

**4. Optional: set the full list in one shot.**  
If you already have all UIDs and want to replace the member list:

```bash
TRIP_SLUG=paris-2026-m5x9k MEMBER_UIDS=uid1,uid2,uid3,uid4,uid5,uid6 node scripts/migrate-trip-members.mjs
```

- **`OWNER_UID`** — Optional. One of the UIDs in `MEMBER_UIDS` to set as owner. Defaults to the first in the list.

**5. Script prerequisites.**  
The script uses Firebase Admin and needs credentials. Either:

- Set **`GOOGLE_APPLICATION_CREDENTIALS`** to the path of your service account JSON file, or  
- Run in an environment that has Google Application Default Credentials (e.g. a GCP shell).

Example (add one member):

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account-key.json
TRIP_SLUG=paris-2026-m5x9k ADD_MEMBER_UID=abc123xyz node scripts/migrate-trip-members.mjs
```

After each run, that trip’s `owner_uid` and `member_uids` are updated; those users will see it under “My trips” and can open it.

## Project layout

- `src/pages/` — Route-level pages (Landing, Trip, Itinerary, Collection, TripSettings, SharedItinerary, Seed).
- `src/components/` — UI: planning board, itinerary sections, collection, stays, shared layout.
- `src/services/` — Data layer: `tripService`, `planningService`, `staysService`, `collectionService`.
- `src/hooks/` — `useTrip`, `useStays`, `useCollectionItems`, `useDisplayName`, `useNarrativeGeneration`, `useCollectionSuggestions`, `useItineraryExport`, `useShareLink`, etc.
- `src/lib/` — Firebase, utils, time/URL helpers, `dateRange` (timezone-safe date maths), `slotEmojis` (icon set + search + auto-assign), image upload/search, narrative and suggestion (Gemini).
- `src/types/database.ts` — Shared Firestore/document types.
- `netlify/functions/` — Serverless:
  - `search-image` — Unsplash proxy.
  - `generate-narrative` — optional server-side Gemini.
  - `upload-github-image` — GitHub image upload with the PAT server-side.
  - `share-link` — mint or revoke a trip's public share token (members only).
  - `shared-trip` — public, unauthenticated read of a shared itinerary by token.
  - `delete-trip` — owner-only cascading delete of a trip and its documents.
  - `link-preview` — serves `/trip/:slug` and `/i/:token` with per-trip meta tags.
  - `og-image` — draws the 1200×630 card those tags point at.

  Note: `netlify/functions` isn't covered by `tsconfig.app.json` (which includes only `src`), so `npm run build` does **not** type-check it — esbuild strips types at deploy time without checking them. Type-check functions separately if you change them.

## Future to-dos / enhancements

Items 1–8 came out of a full review of the app on **5 Sep 2026** and are ordered
by what to do first. Each is written to be picked up cold in a fresh session —
what's wrong, where it lives, and what "done" looks like. Item 9 predates that
review; item 10 came out of **Feb 28 Productionizing.md**, which is otherwise
finished or superseded and is kept only as a record of that round.

The numbers are stable — don't renumber a finished item away, since sessions
refer to them by number. A done item keeps its heading and says so.

### 1. Lock down `firestore.rules` — any signed-in account can read, and take over, every trip

Do this before anything else.

**What's wrong.** Every collection is `allow read: if request.auth != null` —
`firestore.rules` lines 30, 61, 72, 100, 125, 138, 155, 169. Rules gate `list`
as well as `get`, and none of these look at `resource.data`, so any signed-in
account can run `getDocs(collection(db, 'trips'))` — or the same against `days`,
`slots`, `proposals`, `stays`, `collection_items`, `trip_notes`, `trip_todos` —
and read every trip in the database. The comment at the top of the file explains
the open read as being for invite links, but an invite link only needs a
single-document read.

There is also a takeover chain:

1. The second `allow update` branch on `/trips` (~line 48) requires only that
   `member_uids` is the sole changed key and that the caller's uid appears in
   the **new** value. Nothing requires the existing members to survive, so any
   signed-in user can set `member_uids: [attacker]` and evict everyone else.
2. Now a member, the first branch (~line 40) validates only `name`, `slug` and
   `destinations`. `owner_uid` is unpinned, so they can make themselves owner.
3. `netlify/functions/delete-trip.ts:49` trusts `owner_uid` — so they can then
   delete the trip.

**Done when**

- No collection is readable by an arbitrary signed-in account.
- Self-join adds the caller and nothing else: the new `member_uids` must be the
  old array plus the caller's uid.
- `owner_uid` can't change on update. (If ownership transfer is ever wanted, it
  belongs in a server function.)
- The invite flow still works end to end: paste `/trip/:slug` → sign in → see
  the trip → **Join this trip** → edit.

**How, and the trade-off to decide.** For `list`, Firestore evaluates the rule
against every document the query returns and rejects the whole query if any one
fails; it does not inspect the `where` clauses. So the rule and the client query
have to agree.

- `trips` is the easy one: `allow list: if request.auth.uid in resource.data.member_uids`.
  `listUserTrips` (`src/services/tripService.ts:66`) already filters on
  `owner_uid ==` and `member_uids array-contains`, and create forces the owner
  into `member_uids`, so both of its queries still pass. Keep `allow get` open to
  authed users so an invitee can see a trip before joining.
- Child collections are queried by `trip_id` (slots by `day_id`), so a
  membership rule needs the membership on the document itself. Two ways:
  - **Denormalize `member_uids` onto every child document** and test it
    directly. No rule-time `get()`, so no extra read cost — but it needs a
    backfill and somewhere that keeps the array in sync when membership changes.
  - **Call `tripMember(resource.data.trip_id)`**, as the write rules already do.
    Trivial to write, but it's a document read per document evaluated, on every
    list.

**Gotcha.** `getTripBySlug` (`src/services/tripService.ts:21`) resolves a slug
with `where('slug', '==', slug)` — a `list`. Once `list` is membership-scoped,
an invitee who isn't a member yet can no longer resolve the slug, which breaks
the invite link. Resolve it server-side instead (`netlify/functions/lib/` already
does this with the Admin SDK for `link-preview`), or add a `trip_slugs/{slug}`
mapping document holding just `{ trip_id }`.

Check every query shape against whatever rules you land on —
`src/services/tripSubscription.ts` and the `useTrip` / `useStays` / `useTodos` /
`useCollectionItems` hooks all have to keep matching.

### 2. Key identity on `uid`, not display name

**What's wrong.** Everything that records *who* stores a display-name string,
taken from `useDisplayName()` (`src/hooks/useDisplayName.ts`), which returns
`user.displayName` — or the email prefix, or `'Traveler'`. Two travellers with
the same Google name share one identity, and anyone who renames themselves
silently orphans every vote, like and assignment they've made.

Affected fields (`src/types/database.ts`):

| Document | Fields |
|---|---|
| `proposals` | `proposer_name`, `votes[]` |
| `collection_items` | `likes[]`, `created_by` |
| `stays` | `proposed_by` |
| `trip_todos` | `assigned_to`, `created_by`, `completed_by` |
| `trip_notes` | `author_name` |

The comparisons to replace are the `.includes(currentName)` / filter-by-name
patterns — `ProposalCard.tsx:34`, `ProposalDrawer`'s `handleVote`,
`CollectionPage`'s `handleLike`, and the `travelers` / `todoPeople` lists in
`TripPage.tsx`.

**Done when** those fields hold uids, names are resolved for display only, and
existing documents are migrated.

**Notes.** `netlify/functions/trip-members.ts` already returns
`{ uid, display_name }[]` for a trip — that's the resolver, and it exists
because `firestore.rules` restricts `/users/{uid}` to that same user, so a
browser can't read anyone else's profile. Don't reach for Firestore directly.
`useTripMembers` currently only fetches when the to-dos sheet opens
(`TripPage.tsx:45`); a uid-keyed UI needs the roster on every surface that shows
a name, so fetch it once per trip and cache it.

Migration: a script in `scripts/`, in the shape of `migrate-trip-members.mjs`,
mapping name → uid per trip. Some names will match no member — someone who left,
or a legacy guest — so decide whether to keep the raw string as a fallback
(`{ uid: null, name }`) or drop it; keeping it is safer. Comparing on
`uid ?? name` during the transition lets old and new documents coexist.

### 3. Offline — data cache done, app shell still needs the network

**Data cache: done (7 Sep 2026).** `src/lib/firebase.ts` initialises Firestore
through `initializeFirestore` with `persistentLocalCache` +
`persistentMultipleTabManager`, so everything read is mirrored into IndexedDB,
queries resolve from disk, and writes made offline queue until reconnection.
Verified by booting the client on a throwaway preview entry and confirming
`firestore/[DEFAULT]/<project>/main` appears in IndexedDB.

**What's left, and the decision behind it.** This caches the *data*, not the app
shell — with no service worker a cold start still needs the network to fetch the
bundle at all, so the cache helps a live tab and a warm reload, not a phone
opened from scratch in airplane mode. The remaining pieces were considered
together on 7 Sep 2026 and deliberately **parked**:

- **Web app manifest** — `public/manifest.json` plus icons and
  `apple-touch-icon`, linked from `index.html` (which has no manifest link
  today), so Add to Home Screen gives a real icon and opens without browser
  chrome. Small, but parked on its own: an icon that looks like an app and shows
  a blank page offline sets an expectation the manifest can't meet. Only worth
  doing together with the service worker.
- **Service worker** — the piece that actually makes offline work, via
  `vite-plugin-pwa`. Carries the real cost: a precached shell means users can run
  stale JS after a deploy, so it needs update handling ("new version — reload").
- **Honest cache-state UI** — Firestore exposes `metadata.fromCache` and
  `hasPendingWrites`; `ToastProvider` is the obvious place to say "offline —
  changes will sync". Independent of the two above and can be done any time.

**Gotcha for whoever picks this up.** Day photos, the itinerary hero and
collection thumbnails are absolute URLs on a third-party host, so an offline
itinerary is correct text with broken images unless the service worker also
runtime-caches that host — see item 9, which changes where those images live.
Also verify the auth gate: the whole app is behind sign-in, and whether
`AuthContext` resolves a restored session without the network hasn't been
checked.

### 4. Schedule a collection idea without going to the board — **done (7 Sep 2026)**

A collection card now carries a calendar icon next to edit and delete;
`ScheduleIdeaDialog` (`src/components/collection/ScheduleIdeaDialog.tsx`) picks
the day. It lands **locked**, the way the board's own quick-add does — the
collection is where undecided ideas live, so moving one to a day is the
decision. Default is the day's "sometime this day" shelf; an **At a time**
toggle takes a typed time (parsed by `formatTimeLabel`, the same free-text
convention `ProposalDrawer` uses) and lands a 60-minute event instead.
`addLockedSlot` gained `note` / `url` so `place_name` and `google_maps_url`
carry across the way `handlePickFromCollection` does.

### 5. Give signed-out visitors something to land on

**What's wrong.** `/` is `SignInPage` — a wordmark, one line of copy and a
sign-in form (`src/App.tsx`, `src/pages/SignInPage.tsx`). Nothing says what the
app is or shows what it looks like. `src/pages/LandingPage.tsx:113` still
carries the comment `// Signed out: marketing + sign-in`, but that marketing
page doesn't exist. Anyone sent an invite link who isn't signed in hits an auth
wall with no idea what they're being invited to.

Related and cheap: every "sign in" link outside the sign-in page reads **Sign in
with Google** (`TripPage.tsx`, `ItineraryPage.tsx`, `CollectionPage.tsx`) even
though email/password sign-in exists. Make it just "Sign in".

**Done when** signed-out `/` explains the product and shows it, with sign-in
still one click away; and an invitee arriving at `/trip/:slug` signed out sees
at least the trip's name, dates and cover photo before being asked to sign in.
That data already exists server-side — `netlify/functions/lib/tripPreview.ts`
assembles exactly this for link previews.

### 6. Per-trip browser tab title

`document.title` is `Trup` for the whole app, so two trips open in two tabs are
indistinguishable. The only code that touches it is
`src/hooks/useItineraryExport.ts:38`, which sets it temporarily so the browser
seeds the PDF filename and then restores it. Set it per trip — and restore it on
unmount — wherever `useTrip` resolves.

### 7. Navigation — three metaphors for five destinations

Not a bug; a design question worth settling before more gets added.

A trip's surfaces are reached three different ways:

- **Planning / Collection / Itinerary** — tabs in `PageHeader`
  (`src/components/layout/PageHeader.tsx`), absolutely centred in the bar.
- **Stays** and **To-dos** — unlabelled icon buttons in the trip name bar
  (`src/pages/TripPage.tsx`), opening drawers.
- **Trip settings** — inside the avatar menu (`src/components/layout/UserMenu.tsx`).

The sharpest symptom: Stays and To-dos are trip-wide data, but they're only
reachable from the Planning page — `TripLayout` takes the trip name bar as a
prop and `CollectionPage` passes its own, while `ItineraryPage` doesn't use
`TripLayout` at all. Whatever the answer — promote them into the tab row, put
everything trip-level behind one consistent control, or make the drawers
reachable from every page — the goal is a single rule for "where do I find a
thing about this trip".

### 8. Error boundary, and type-check the functions

`src/main.tsx` mounts `App` bare — there is no error boundary anywhere in the
tree, so one bad document renders a white page with no way back. That matters
more than usual here because so much of the schema is optional-or-legacy:
`start_minutes?`, `duration_minutes?`, `stretches_grid?`, slots with no
`trip_id` that resolve through `day_id`, and the legacy booking fields on
`Proposal`.

**Done when** there's a route-level boundary that shows an apology, a **Reload**
and a link back to `/home`, and logs the error — plus a top-level one for
anything thrown outside a route.

Separately: `npm run build` only type-checks `src` (`tsconfig.app.json`), so
`netlify/functions/` ships unchecked — and that's where the auth verification,
the share-token minting and the cascade delete live. Add a tsconfig for it and a
`typecheck:functions` script, and run both in CI.

### 9. Image storage — move off the GitHub repo

Every uploaded image (day photos, the itinerary hero, collection item photos) is
compressed to JPEG in the browser by `src/lib/imageUpload.ts` and then
**committed to a GitHub repo** through the Contents API — via
`netlify/functions/upload-github-image.ts` in production (PAT stays server-side),
or straight from the browser with `VITE_GITHUB_*` in local dev. What gets stored
on the document is a `raw.githubusercontent.com` URL pinned to the commit SHA.

It works, but it's a git repo doing a CDN's job:

- Every upload *and every replacement* is a commit. History and repo size grow
  without bound, and nothing is ever actually deleted.
- Deleting a trip, day or collection item orphans its image — there's no GC.
- No resizing, thumbnails, cache control or signed URLs; the client-side
  `compressImage` step is the only sizing we get.
- Access is all-or-nothing at the repo level. A public repo means trip photos
  are public regardless of `member_uids`; a private repo means the raw URLs
  won't render in an `<img>` at all.
- Bounded by GitHub API rate limits, and the PAT carries write access to a whole
  repo just to store a JPEG.

**Why it's GitHub, and not Firebase Storage.** Not a bug that was hit — a wall
that was hit before any code was written. `firebase/storage` has never been
imported in `src/` or `netlify/` at any point in the history, `getStorage` and
`uploadBytes` have zero hits ever, and no `storage.rules` has ever existed. The
project was created in `4f722c8` at 12:06 on 22 Feb 2026, and images were on
GitHub by `49a691f` at 14:56 the same day. Cloud Storage for Firebase stopped
serving Spark-plan projects after its September 2024 change: no bucket at all,
every call returns 402/403, and the console refuses to provision one until the
project is on the pay-as-you-go Blaze plan. That is what was hit, and it is
still true today.

**Status (7 Sep 2026): Firebase Storage is ruled out** — it requires a billing
account, and we're not attaching one. Worth recording that the money was never
the issue: Blaze bills $0 at this scale (Always Free covers 5 GB stored,
100 GB/month egress, 5K uploads and 50K downloads a month, and overage past that
is $0.004 per 10K operations). The objection is the card on file and the fact
that Google alerts on budgets rather than capping them. If that ever stops being
an objection, the work is already written — see below.

**Supabase, re-priced.** The old framing of this item was wrong on one point:
Supabase Storage can be adopted on its own, with Firestore left exactly where it
is. It is not a database migration unless we want one. The free tier is 1 GB of
file storage across 2 active projects and needs **no credit card**, which is what
makes it the live option. The catch is that free projects pause after 7 days
without a request, and storage goes offline with the project — every photo 404s,
including on share links other people hold, until someone unpauses it from the
dashboard. Judged acceptable on 7 Sep 2026, on the grounds that a paused project
takes the whole trip down anyway, so the photos aren't the marginal loss.
`netlify/functions/upload-github-image.ts` already verifies the Firebase ID
token, so it can stay the authorization point with a Supabase service key behind
it — no Supabase Auth integration required. (Supabase does support Firebase Auth
as a third-party JWT issuer, if pushing uploads straight from the browser turns
out to be worth it.)

**What's already built.** A complete Firebase Storage implementation is parked in
`docs/firebase-storage-wip.patch`. It type-checks and `npm run build` was green,
but it has never run against a real bucket; it was reverted out of the tree on
7 Sep 2026 so it couldn't ship pointing at a bucket that doesn't exist. Most of
it is backend-agnostic and worth reusing whatever we pick:

- `src/lib/imageUpload.ts` is the **only** seam. Every call site just does
  `uploadImage(path, file, onProgress)` and stores whatever URL comes back, so
  swapping backends is a change to one file plus its callers' last argument.
- Object paths stay `trips/<tripId>/hero.jpg`, `trips/<tripId>/days/<dayId>.jpg`
  and `trips/<tripId>/collection/<itemId>.jpg`. That `tripId` prefix is what buys
  per-trip access rules and a single prefix-delete when a trip is deleted — the
  paths are already shaped right, nothing needs redesigning.
- **Both hosts coexist.** `image_url` is just a string, so old GitHub photos keep
  rendering beside new ones. There is no cutover, and the backfill can happen
  later or never. The price of running both is that the GitHub repo can never be
  deleted and its photos stay public.
- `netlify.toml`'s `[images] remote_images` has to list the new host or
  `og-image` refuses to crop cover photos. `og-image.ts:58` already wraps the URL
  in `encodeURIComponent`, so a host whose URLs carry their own query string is
  fine there.
- Resolve the storage client **lazily**, not at module load. `src/lib/firebase.ts`
  is imported by ~17 files including sign-in, so a throw at module scope blanks
  the entire app over a photo feature.
- `CollectionItemCard.tsx`'s retry cache-buster appends `?v=N` on image error.
  Any backend whose URLs already carry a query string needs `&` instead, or the
  second `?` folds the real parameters into a value.

**Done when** uploads land somewhere that isn't a git repo; deleting a trip, day
or collection item takes its image with it (`netlify/functions/delete-trip.ts` is
the place — one prefix delete covers a whole trip); the GitHub PAT and the three
`GITHUB_*` env vars are gone; and there's a decision on whether photos stay
readable by whoever holds the URL or get gated to `member_uids`.

That last one is a real fork, not a detail. Gating reads breaks the public share
link at `/i/:token` and the `og-image` preview card unless both mint signed URLs
— so "unguessable URL, same as today" is the cheap answer and "signed URLs" is
the correct one.

Outstanding either way: the **backfill**, since `image_url` on `trips`, `days`
and collection items holds absolute GitHub URLs today. It has to skip
`images.unsplash.com`, which is a legitimate remote host and not something to
move.

### 10. Move the Gemini key server-side

**Do this alongside item 1** — it's the same class of problem, an API key
anyone can read rather than a database anyone can read.

`generateNarrative` and `suggestCollectionItems` call Gemini straight from the
browser with `import.meta.env.VITE_GEMINI_API_KEY`
(`src/lib/generateNarrative.ts:97`, `src/lib/suggestCollectionItems.ts:90`).
Vite inlines `VITE_*` at build time, so the key is a string in the shipped
bundle — anyone can pull it out of the deployed JS and spend against the
account.

The server-side version already exists and is wired to nothing:
`netlify/functions/generate-narrative.ts` reads `process.env.GEMINI_API_KEY`.
Nothing in `src/` imports it.

**Done when** both AI calls go through Netlify functions that verify a Firebase
ID token (`netlify/functions/lib/` already has that helper, and `search-image`
is the pattern to copy), `VITE_GEMINI_API_KEY` is gone from `src/` and
`.env.example`, and the deployed bundle contains no key —
`curl` the live `assets/index-*.js` and grep for the prefix to confirm. Rotate
the current key afterwards; it has been public in every build so far.

The rest of **Feb 28 Productionizing.md** is either done or overtaken: its
schema-doc and migration section never happened and is worth reopening only if
the legacy optional fields start causing real bugs, and its test section is
blocked on there being no test runner in the project at all.


## Deploy

The app is set up for **Netlify**: build command `npm run build`, publish directory `dist` (see `netlify.toml`).

### Netlify environment variables

In **Site configuration → Environment variables**, set at least:

- **Build / client:** the same `VITE_*` values you use locally (from `.env.example`), so Vite can embed public Firebase config and any client-side keys you rely on.
- **Functions (server-only):** `GEMINI_API_KEY`, `UNSPLASH_ACCESS_KEY`, **`FIREBASE_SERVICE_ACCOUNT_JSON`** (Firebase Admin), and **`GITHUB_TOKEN`**, **`GITHUB_OWNER`**, **`GITHUB_REPO`** if you use custom image uploads. The service account is used for ID token verification **and** for Firestore reads/writes by `share-link`, `shared-trip` and `delete-trip`, so it needs **Cloud Datastore User** as well as auth access — Firebase's auto-generated `firebase-adminsdk` account has both by default, but a hand-scoped one may not. Do **not** set `VITE_GITHUB_TOKEN` on Netlify — it is compiled into the browser bundle and triggers secrets scanning (`ghp_` / `github_pat_`).

### If a service account JSON was committed

Netlify’s secrets scanner will block builds until the private key is gone from the repo (including **history**).

1. Remove the file from the tree, ensure it matches an entry in `.gitignore`, and commit that change.
2. **Purge Git history** for that path (for example [`git filter-repo`](https://github.com/newren/git-filter-repo) with `--path path/to/file.json --invert-paths`), then force-push, or follow [GitHub’s guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) to remove sensitive data.
3. In **Google Cloud Console** → IAM → **Service accounts** → your Firebase admin user → **Keys**, **delete** the leaked key and **add** a new key. Update **`FIREBASE_SERVICE_ACCOUNT_JSON`** in Netlify with the new JSON (one line).
