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
- **Gemini** — Optional. Used for “Generate text” on the itinerary and “Suggest something for me” on the collection. Set **`GEMINI_API_KEY`** (no `VITE_` prefix) — both calls go through Netlify functions, so the key never reaches the browser. There is no client-side fallback, which means AI features need **`netlify dev`** locally; plain `npm run dev` doesn't serve `/.netlify/functions/*` and they'll say so.
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

Both addresses are redirected (in `netlify.toml`, **above** the SPA catch-all) to the `link-preview` function, which rewrites the `og:` and `twitter:` tags before serving the same `index.html`. The rewrite's target names a `kind` and an `id`, but those do not survive it, so the function reads both back off the request path and falls back to the query string only when the path holds no link. Test it through `/trip/<slug>`, not through `/.netlify/functions/link-preview?kind=…&id=…` — the second worked throughout the period the first was serving everyone the generic card. Only crawlers pay for that: a browser's request never touches Firestore, and `firebase-admin` is imported lazily so it isn't even initialised on that path. `og:title` is deliberately the wordmark on every link; the trip's own name rides in `og:description` and on the card.

The card itself comes from `og-image`, which lays it out with satori and rasterises it with resvg — the cover photo is cropped to 1200×630 through Netlify's image CDN first, so the hosts `image_url` can point at have to stay listed under `[images] remote_images`. Its fonts and resvg's wasm live in `public/og/` and are fetched from the CDN at runtime rather than bundled. A trip with no cover photo gets the same card over the app's navy-to-golden wash.

Satori's own text shaping needs a wasm too — harfbuzz's — and that one it loads itself, at import time, from `hb.wasm` next to its own file. Bundle it and the lookup lands in the function's directory instead, where the file isn't, which surfaces as an unhandled rejection during module load: **every** `og-image` request 502s, including the fallback redirect, and the link falls back to a bare card with no photo. `[functions."og-image"] external_node_modules = ["harfbuzzjs"]` in `netlify.toml` keeps the package unbundled so its wasm ships beside it.

Note that this makes a trip's name, cover photo and dates readable by anyone holding the URL, without signing in — which is what a link preview is. The slug's random suffix is still the only thing gating an invite link, exactly as before.

## Scripts

| Command   | Description        |
|----------|--------------------|
| `npm run dev`    | Start dev server   |
| `npm run build`  | TypeScript + Vite build |
| `npm run preview`| Preview production build |
| `npm run lint`   | Run ESLint        |
| `npm run typecheck:functions` | Type-check `netlify/functions/` (the build doesn't) |
| `npm run test:rules`  | `firestore.rules` against the Firestore emulator |
| `npm run test:access` | The real trip subscription against those rules |

## Testing the security rules

There's no test runner in the project, but `firestore.rules` has two suites,
because a rules mistake is invisible until it locks everyone out of the app.

Both need a JDK for the emulator. It's keg-only, so rather than changing your
PATH:

```bash
PATH="/usr/local/opt/openjdk/bin:$PATH" npm run test:rules
```

- **`test:rules`** (`scripts/test-firestore-rules.mjs`) — what an outsider, a
  member and an invitee may read and write, every query in `src/services/`, the
  self-join and takeover cases, and that a query not filtering on `trip_id` is
  refused.
- **`test:access`** (`scripts/test-trip-access.mjs`) — bundles the real
  `getTripBySlug` and `subscribeToTrip` with `@/lib/firebase` swapped for a stub
  and runs them against the emulator with the rules enforced. This is the seam
  the rules tests can't see: it covers an invitee landing on a link, joining, and
  the itinerary opening without a reload.

**Deploying rules.** Netlify does not deploy `firestore.rules` — it builds the
app only, so this is a manual step, and the order matters.

**App first, rules second.** The current client works under either version of
the rules: it resolves a slug from your own trips and falls back to the
`resolve-trip` function, neither of which the old rules mind. The reverse isn't
true — under the new rules the old client's `where('slug', '==', slug)` is a
list it isn't allowed to make, so deploying rules first breaks every open tab
until it reloads.

To confirm that before shipping, run the access suite against the rules that are
currently live:

```bash
git show HEAD:firestore.rules > /tmp/live.rules && RULES_FILE=/tmp/live.rules npm run test:access
```

So: push, let Netlify finish, then

```bash
firebase deploy --only firestore:rules
```

A tab left open across the rules deploy still holds the old bundle and will fail
to open a trip until it's reloaded.

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
- `src/components/` — UI: planning board, itinerary sections, collection, stays, shared layout. `layout/PageHeader` is the single bar (mark, trip name, tabs, tools, menu) plus the phone tab bar; `layout/TripTools` supplies the To-dos and Stays buttons and drawers as separate pieces.
- `src/services/` — Data layer: `tripService`, `planningService`, `staysService`, `collectionService`.
- `src/hooks/` — `useTrip`, `useStays`, `useCollectionItems`, `useDisplayName`, `useNarrativeGeneration`, `useCollectionSuggestions`, `useItineraryExport`, `useShareLink`, etc.
- `src/lib/` — Firebase, utils, time/URL helpers, `dateRange` (timezone-safe date maths), `slotEmojis` (icon set + search + auto-assign), image upload/search, `aiRequest` (posts to the Gemini functions), narrative and suggestion payload builders.
- `src/types/database.ts` — Shared Firestore/document types.
- `netlify/functions/` — Serverless:
  - `search-image` — Unsplash proxy.
  - `generate-narrative` — Gemini itinerary copy. Holds the key, the system prompt and the prompt builder.
  - `suggest-collection-items` — Gemini collection suggestions. Same shape.
  - `upload-github-image` — GitHub image upload with the PAT server-side.
  - `share-link` — mint or revoke a trip's public share token (members only).
  - `shared-trip` — public, unauthenticated read of a shared itinerary by token.
  - `delete-trip` — owner-only cascading delete of a trip and its documents.
  - `link-preview` — serves `/trip/:slug` and `/i/:token` with per-trip meta tags.
  - `og-image` — draws the 1200×630 card those tags point at.

  Note: `netlify/functions` isn't covered by `tsconfig.app.json` (which includes only `src`), so `npm run build` does **not** type-check it — esbuild strips types at deploy time without checking them. Type-check functions separately if you change them.

## Future to-dos / enhancements

Items 1–8 came out of a full review of the app on **5 Sep 2026** and are ordered
by what to do first. Items 1, 2, 4, 5, 6, 7, 8 and 10 are done; 3 was dropped;
11 is a recorded "no" rather than work. **Open: 9, 12 and 13.** Each is written
to be picked up cold in a fresh session — what's wrong, where it lives, and what
"done" looks like. Item 9 predates that review;
item 10 came out of **Feb 28 Productionizing.md**, which is otherwise finished
or superseded and is kept only as a record of that round; 11 and 12 came out of
the rules work on 7 Sep.

The numbers are stable — don't renumber a finished item away, since sessions
refer to them by number. A done item keeps its heading and says so.

### 1. Lock down `firestore.rules` — **done (7 Sep 2026)**

Every collection used to be `allow read: if request.auth != null`, so any
signed-in account could run `getDocs(collection(db, 'trips'))` and read every
trip in the database, then evict the members and take ownership.

**What it is now.** Reads are scoped to trips you're on, for `get` and `list`
alike. The single exception is `get` on one `/trips/{id}`, which any signed-in
user may make — that is the invite landing page, where someone has to see a trip
before deciding to join it. `owner_uid` and `member_uids` are pinned on the
edit branch, and the self-join branch takes the old member list plus the caller
and nothing else, so a joiner can neither evict anyone nor add a third party.

**The two things that make these rules hard to read**, both measured against the
emulator rather than reasoned about, and both written at the top of
`firestore.rules`:

- A `list` rule is evaluated against **the query**, not the documents it
  returns, using a synthetic document holding only the fields the query
  constrains. A rule can therefore only read a field the query filters on — and
  an unfiltered collection read sees an empty document and is denied, which is
  what closes the hole.
- A query's rule gets ~20 document access calls, and an `in` filter spends one
  per value, so a rule that resolves each value separately fails once a query is
  big enough. Every rule reads `trip_id` off the document instead — one call at
  any size — and every query in `src/services/` filters on `trip_id` to match.
  Both halves matter: filter on something else and the query is refused on its
  first run, which is the failure you want. Getting there needed
  `scripts/backfill-trip-ids.mjs`, since 42 slots and proposals predated
  `trip_id` and could only be resolved through the day they hung off.

**Client changes.** `getTripBySlug` can't resolve a slug with
`where('slug', '==', slug)` any more, so it looks in your own trips first and
falls back to `netlify/functions/resolve-trip.ts`, which is authenticated and
returns only the document id. And because days are now members-only,
`subscribeToTrip` is three flat listeners on one trip — days, slots and
proposals, each filtered on `trip_id` — rather than a day-chunked cascade that
re-subscribed slots and proposals whenever the day list moved. It also holds the
itinerary subscription back until you're a member —
otherwise an invitee's listener is refused, `rebuild()` never runs and the join
screen sits on a spinner. It opens the itinerary from the **server-confirmed**
trip snapshot: Firestore fires that listener optimistically off the local write
when you join, and a listener opened on that snapshot races the write to the
server, is refused by rules that still see the old `member_uids`, and stays dead.
That is also why the trip listener asks for `includeMetadataChanges`.

**Tests.** `npm run test:rules` covers the rules; `npm run test:access` runs the
real `getTripBySlug` and `subscribeToTrip` against them, which is where both
bugs above were found. Both need a JDK for the emulator — see **Testing** below.

**Left alone.** `SeedPage` (dev-only, behind `import.meta.env.DEV`) resolves a
slug with a `list` and can no longer do so. It was already half-broken, since
`allow delete` on trips has been `false` for longer than that.

### 2. Key identity on `uid`, not display name — **done (7 Sep 2026)**

Everything that recorded *who* stored a display name, so two travellers with the
same Google name shared one identity and a rename orphaned every vote, like and
assignment that person had made.

**What it is now.** `proposals.votes[]`, `collection_items.likes[]` and
`created_by`, `stays.proposed_by`, and `trip_todos`'
`created_by`/`assigned_to`/`completed_by` all hold uids. Where a label is still
wanted for someone who has since left the trip, a name snapshot rides alongside
the uid rather than replacing it: `proposer_name` next to the new
`proposer_uid`, and the new `created_by_name` / `proposed_by_name` /
`author_uid`. Names are resolved for display only.

**Where names come from.** `TripPeopleProvider`
(`src/contexts/TripPeopleContext.tsx`) holds the roster for a trip and hands
down `nameFor(id, fallback)`, `isMe(id)` and `me`. It's mounted by TripPage,
CollectionPage and ItineraryPage, and reads through `useTripMembers`, which now
caches per trip and shares one in-flight request — the roster is needed on every
surface that shows a name, not just when the to-dos sheet opens.

**Old and new documents coexist.** `isMe` matches the uid *or* the display name,
and `nameFor` falls back to the stored string when it isn't a uid, so nothing
breaks before the migration runs. Un-voting removes both forms, so a vote left
under a name doesn't get stuck.

**The migration.** `scripts/migrate-identities.mjs` rewrites the stored names to
uids, resolving each against that trip's own members. Dry run by default:

```bash
TRIP_SLUG=your-trip-slug node scripts/migrate-identities.mjs   # then APPLY=1
```

It needs `GOOGLE_APPLICATION_CREDENTIALS`, is safe to re-run, and leaves two
cases alone rather than guessing: a name matching no current member (someone who
left) and a name shared by two members — that second one is the collision this
item exists to fix, and it's the only part needing a human. Verified against the
emulator, including the dry run writing nothing and a re-run being a no-op.

**Also.** `firestore.rules` now pins `proposer_uid` to the caller when it's
present, so a proposal can't be filed under someone else's uid. Absent it still
passes, so a tab running the old bundle mid-deploy keeps working.

### 3. Offline — **dropped (7 Sep 2026)**

Not being pursued. The data cache did ship and is still there:
`src/lib/firebase.ts` initialises Firestore through `initializeFirestore` with
`persistentLocalCache` + `persistentMultipleTabManager`, so reads are mirrored
into IndexedDB and offline writes queue until reconnection. The rest — web app
manifest, service worker, cache-state UI — was dropped rather than parked.

### 4. Schedule a collection idea without going to the board — **done (7 Sep 2026)**

A collection card now carries a calendar icon next to edit and delete;
`ScheduleIdeaDialog` (`src/components/collection/ScheduleIdeaDialog.tsx`) picks
the day. It lands **locked**, the way the board's own quick-add does — the
collection is where undecided ideas live, so moving one to a day is the
decision. Time is two optional fields, parsed by `formatTimeLabel` — the same
free-text convention `ProposalDrawer` uses. Both blank is the day's "sometime
this day" shelf; a start alone runs `DEFAULT_DURATION_MIN`; an end replaces
that. `resolveSchedule` is shared by the live hint and the commit so the two
can't disagree.

The day list is filtered to the idea's own city — `splitByCity` matches
`item.destination` against `day.city` on the same case-insensitive rule
`CollectionList` groups by — with the rest folded behind a "N days in other
cities" toggle. Two cases have nothing to split on and show every day instead:
a legacy item with no `destination`, and an idea whose city no day is in.
Hiding every day behind a toggle there would be a worse list, not a shorter
one.

`addLockedSlot` gained `note` / `url` so `place_name` and `google_maps_url`
carry across the way `handlePickFromCollection` does.

### 5. Give signed-out visitors something to land on — **done (7 Sep 2026)**

`/` is now `MarketingPage` (`src/pages/MarketingPage.tsx`) for anyone signed
out; `RootRoute` in `App.tsx` sends a signed-in visitor straight to `/home`, and
`/sign-in` keeps the bare form so `?from=` redirects still land somewhere
focused. The page shows the product with drawn mockups
(`src/components/marketing/Mockups.tsx`) rather than screenshots — the app is
behind sign-in, so a real capture would need an account and somewhere to host
the file, and would go stale on every UI change. They're built from the same
tokens and proportions as the real surfaces. Nothing on the page starts at
`opacity: 0`: a landing page shouldn't need JS to become readable, so the
entrance animations went.

An invitee arriving signed out at `/trip/:slug` (or its `/itinerary` and
`/collection` siblings) now gets `TripInvitePreview` — the trip's cover photo,
name, dates and destinations, then **Sign in to join**. The fields come from a
new public `trip-preview` function, a thin wrapper over the `lookupTrip` that
`link-preview` already uses, so it reads through the Admin SDK and
`firestore.rules` stays closed. It reveals exactly what pasting the link into a
chat already reveals, and nothing more.

Two things worth keeping in mind. The `!user` check had to move **above** the
trip load in all three pages: rules deny an unauthenticated read, so waiting for
`useTrip` only ever arrived at "Trip not found" for someone holding a perfectly
good invite link. And `formatRange` in `netlify/functions/lib/tripPreview.ts`
can't be imported from `src`, so `TripInvitePreview` has its own range collapse
— building the tail from the ISO string, because Intl asked for a day and a year
and nothing else renders "2026 (day: 18)".

The related label fix is done too: the "Sign in with Google" links outside the
sign-in page now read "Sign in".

### 6. Per-trip browser tab title — **done (7 Sep 2026)**

`useDocumentTitle` (`src/hooks/useDocumentTitle.ts`), called from `useTrip`, so
every trip-scoped page gets it. The tab reads `<trip name> · Trup` and restores
the base title on unmount. It reads that base from `index.html` once at module
load rather than hardcoding it, and only ever restores it — which is what keeps
it clear of `useItineraryExport`, which swaps the title in and out around
`window.print()` to seed the PDF filename.

### 7. Navigation — three metaphors for five destinations — **done (8 Sep 2026)**

A trip's surfaces were reached three ways — tabs for Planning/Collection/Itinerary,
unlabelled icons for Stays and To-dos, the avatar menu for settings — and Stays
and To-dos were trip-wide data reachable only from Planning. So were Edit trip,
Undo and Invite; Collection didn't even show which trip you were on.

**The rule that settled it.** Planning and Collection carry the trip's working
tools. The itinerary is the output and carries the trip in its own hero and
nothing else — it already has the sharing affordance appropriate to a finished
itinerary, the read-only link in its customize panel. Ruling Itinerary out is
what made this cheap: every expensive part (a dark over-hero icon variant, a
second bar over a full-bleed hero) was Itinerary's.

**It is all one bar.** `PageHeader` carries the mark, the trip's name and dates
(`showTripId`, off for the itinerary which has them in its hero and for settings
which has its own heading), the centred tabs, an `actions` slot, and the menu.
There is no second bar; the trip bar that briefly existed was folded in.

**Below `sm` the tabs move to a bottom bar.** Not a preference — arithmetic. At
375px the three text tabs measure 238 of the 335 usable pixels, and the mark,
trip name, To-dos, Stays and the menu cannot share the remaining 97. Icon-only
tabs were tried and are worse than they look: everything else in the row is
`shrink-0`, so the trip name absorbs the whole shortfall and collapses to 21px —
a name in the bar in name only. Moving the tabs to the bottom is the only
arrangement that keeps the name legible and the labels intact, and it puts
navigation where a thumb is. It does not save pixels (57px bottom + 61px top vs
110px for the two bars it replaced); it spends them better.

**`useTripTools`** (`src/components/layout/TripTools.tsx`) returns the To-dos and
Stays controls as two separate pieces — `buttons` for the header's `actions`
slot, `drawers` rendered at page level. They must be separated: the header sets
`backdrop-blur`, and an element with a `backdrop-filter` becomes the containing
block for every `position: fixed` descendant, so a drawer rendered inside the
header is positioned against the header rather than the viewport and collapses
to a sliver. The phone tab bar is a sibling of `<header>` for the same reason —
check `getBoundingClientRect().bottom === innerHeight` if you ever move it.

`UndoButton` goes in the same `actions` slot on Planning only; it undoes board
drags, not trip-wide actions.

Pages that render `PageHeader` add `MOBILE_TABBAR_PAD` so the tab bar doesn't
cover their last row — including TripPage, whose board is `h-dvh flex flex-col`
and would otherwise size itself to the full viewport.

**Page actions live in the page, not the bar.** Collection's Suggest and Add sit
at the top of `<main>`, aligned to the list they act on. They were briefly in the
header; a bar carrying a page's own actions stops reading as the trip.
`CollectionHeader` is gone — its `<h1>Collection</h1>` repeated the lit tab, and
its blurb and full-width stacked buttons cost 288px of phone chrome above the
first idea, now 212px.

**Everything you administer moved to the settings page**, which now has Trip
details, Invite link and Public share link. Two reasons beyond tidiness. The two
links are only legible next to each other — separately, "invite link" and "share
link" sound identical, when one lets people join and edit and the other is
read-only. And **the pencil was load-bearing**: `TripSetupPanel`, the other route
to `EditTripModal`, only renders when `days.length === 0`, so on any trip with
days the trip bar's pencil was the sole way to edit dates and destinations. Trip
details therefore opens that same modal rather than being a name field — which it
had to anyway, since dates move as a range through `syncTripDays`.

So `UserMenu` ends up shallow on purpose: the trip's name as a heading, Trip
settings, a divider, Sign out. Off a trip it's just Sign out, exactly as before.

**One stacking bug this surfaced.** `PageHeader` was `sticky top-0 z-20`, and
`sticky` with a `z-index` makes it its own stacking context — so the menu inside
it could never out-paint a sibling however high its own `z-index` went. The
board's day headers are also `z-20` and come later in the DOM, and its hour
gutter is `z-[25]`, so an open menu was covered by the day photos. The header is
`z-30` now. If you add a board layer above 30, this breaks again.

`PageHeader` also had to learn that `/settings` is not a tab: Planning was the
"none of the others" branch, so the settings page lit the Planning tab.

**Parked: tabs back in the top bar on phones.** Considered and stopped on
8 Sep 2026, mid-implementation, in favour of keeping the bottom bar for now —
recorded because the arithmetic is the expensive part to rediscover. The shape
was: no bottom bar, no trip name on phones, To-dos and Stays moved into the
menu, Undo left as a button. It does **not** fit. Tabs (238) + Undo (44) +
avatar (41) + the mark (16) + gutters (40) plus inter-group gaps comes to about
395 in a 375px viewport, roughly 20px over — *after* removing the name and the
two tool buttons. Something further has to give: dropping the mark on phones
(~24px, with "All trips" moved into the menu) is the cleanest, tightening the
tab padding the other. Revisit if the bottom bar proves unpopular on a real
device; the half-finished version put `max-sm:hidden` on the tool buttons and
gave `UserMenu` a `phoneActions` prop for the menu rows.

The trip name is capped (`sm:max-w-[22rem] lg:max-w-[26rem]`) because the tabs
are absolutely centred and will not be pushed — without it a long name runs
underneath them. `SharedItineraryPage` renders no `PageHeader`, so a public
viewer still gets no trip navigation.

### 8. Error boundary, and type-check the functions — **done (7 Sep 2026)**

**Error boundary.** `src/components/shared/ErrorBoundary.tsx` is mounted twice:
route-level in `App.tsx`, wrapping `<Routes>` inside the router, and top-level in
`main.tsx`, outside it, so a throw in `AuthProvider`, `ToastProvider` or the
router itself is caught too. The fallback is an apology, a **Reload** button and
a link to `/home`; in DEV it also prints the stack. `componentDidCatch` logs to
the console with the component stack and sends a GA `exception` event — a no-op
without `VITE_GA_MEASUREMENT_ID`, which is otherwise the only reason nobody ever
hears about a production crash.

Two things worth knowing before changing it. The route boundary takes the
pathname as `resetKey` rather than as React's `key`: a caught error is sticky by
design, but keying the boundary would remount all of `<Routes>` on every
navigation and throw away healthy page state, whereas `resetKey` only clears an
error already on screen — which is what makes a browser Back out of a crashed
page recover. And the fallback's **Back to home** is a plain `<a href>`, not a
`<Link>`: whatever broke is still mounted above it, so a fresh document is the
only guaranteed reset.

Standard limits still apply — a boundary sees throws from rendering, lifecycles
and constructors, but not from event handlers, `setTimeout` or a rejected
promise. Those keep needing the try/catch-and-toast the pages already do.

**Type-checking the functions.** `tsconfig.functions.json` covers
`netlify/functions/`, run by `npm run typecheck:functions`. It is deliberately
**not** in `tsconfig.json`'s `references`, so `npm run build` is unchanged —
Netlify bundles functions with its own esbuild pass, and a type error there
shouldn't be able to fail the site build. Its first run found one: `verifyAuth.ts`
typed `match` as `false | RegExpMatchArray | null` via `&&`, and `?.` doesn't
short-circuit on `false`. It happened to behave (`false[1]` is `undefined`), but
the type was a lie; it's a ternary now.

Not done: there is still no CI. That grew past a footnote — it's **item 13**.

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

### 10. Move the Gemini key server-side — **done (7 Sep 2026)**

`VITE_GEMINI_API_KEY` was read in the browser, and Vite inlines `VITE_*` at
build time — so the key was a plain string in the shipped bundle, there for
anyone to pull out of the deployed JS and spend against the account.

**What it is now.** Both AI calls go through Netlify functions that verify a
Firebase ID token: `generate-narrative` (which existed and was wired to nothing)
and the new `suggest-collection-items`. Each holds the key, the system prompt and
the prompt builder. `VITE_GEMINI_API_KEY` is gone from `src/` and
`.env.example`, and `@google/generative-ai` is no longer imported from `src/` at
all, so the SDK left the client bundle with the key.

**The client sends structured data, not a prompt.** `buildPayload` in each lib
flattens `DayWithSlots` down to a flat wire shape and the function builds the
prompt from it. Posting the prompt itself would have been a smaller diff and
would have turned the endpoint into an open Gemini proxy for anyone with an
account — the token gate stops strangers, not a signed-in user asking it for an
essay. The cost is that the wire types are duplicated: `netlify/functions/` is
outside `tsconfig.app.json` and can't import `src/types/database`, so the
`InputDay` / `LockedItem` shapes in each function and the `buildPayload` that
feeds them have to be kept in step by hand. Both sides carry a comment saying so.

**The parked function was stale, in a way that would have shipped broken.** It
had been written before the client gained `suggested_time` and the 4–10-word
tagline rule, and it was still on `gemini-2.0-flash-lite` with
`maxOutputTokens: 2000` — a cap worth removing rather than porting, since
`gemini-2.5-flash` spends tokens on thinking before it emits any JSON. Worse,
its `buildPrompt` never wrote the day or proposal ids into the prompt, so the
model had nothing to echo back into `day_id` / `proposal_id` and every result
would have failed to match up against the board. Don't trust a parked function
to still describe the client that outgrew it.

**Verified** by bundling both handlers with esbuild against mocked
`firebase-admin` and `@google/generative-ai` and calling them with fabricated
events — the same trick `src/services/` tests use, since there's no test runner.
That covers the auth gate (401 with no token, 401 with an unverifiable one, 405
on GET), the day cap, and a malformed generation becoming a 500 with a log line
instead of a `JSON.parse` throw in the browser. The check worth repeating if you
touch a prompt: run the **old** client `buildPrompt` and the **new**
`buildPayload` → server `buildPrompt` over the same board and diff the strings.
They come out byte-identical on every ordinary board, which is what says the
move changed nothing the model sees.

The one deliberate difference that diff turned up: a slot marked `locked` whose
`locked_proposal_id` points at a deleted proposal. The old client kept it past
the filter and then skipped it in the loop, so the day printed its header and
then nothing; the new code drops it earlier, so the day reads "No locked
activities yet". That is the more accurate sentence, and it's the only case
where the two disagree.

**The key was rotated on 8 Sep 2026** and the old one deleted — moving it
server-side doesn't un-publish a value that shipped in every previous build, and
Netlify keeps old deploys live at their own permalinks, so those bundles stayed
downloadable until the key itself was revoked. `GEMINI_API_KEY` is now marked
**secret** in Netlify, which also means the build fails if the value ever
reappears in `dist` — a useful tripwire if someone reintroduces a `VITE_` read.

**Local dev now needs `netlify dev`.** There is no client-side fallback — that
was the bug. Under plain `vite`, `/.netlify/functions/*` isn't served and the
SPA fallback answers with `index.html`, so `aiRequest.ts` treats an unparseable
body in DEV as "functions aren't running" and says to use `netlify dev` rather
than surfacing a JSON parse error.

The rest of **Feb 28 Productionizing.md** is either done or overtaken: its
schema-doc and migration section never happened and is worth reopening only if
the legacy optional fields start causing real bugs, and its test section is
blocked on there being no test runner in the project at all.


### 11. Consider moving trip data into subcollections

**Not recommended today** — recorded so the reasoning isn't re-derived, and so
the trigger for reconsidering is written down. Came out of the rules work on
**7 Sep 2026**.

**The idea.** `days`, `slots`, `proposals`, `collection_items`, `stays`,
`trip_todos` and `trip_notes` are top-level collections carrying a `trip_id`
field. They could instead live under the trip — `trips/{tripId}/slots/{slotId}`
— and `firestore.rules` would then take the trip from the document's *path*:

```
match /trips/{tripId}/slots/{slotId} {
  allow read: if tripMember(tripId);
}
```

**What that would buy.** Exactly one thing: queries would no longer have to
filter on `trip_id`. Today a rule reads `trip_id` off the document, and a list
rule only sees the fields the query filters on, so every query in
`src/services/` has to carry `where('trip_id', '==', tripId)` — see item 1. With
subcollections there'd be nothing for a query to forget.

**What it would not buy**, both worth knowing before anyone reaches for this:

- **No cost saving.** The rule still has to `get()` the trip document to read
  `member_uids`, so it's one access call per query either way.
- **No help with orphans.** Firestore does not cascade-delete subcollections, so
  a deleted trip would strand its children exactly as it does now — see item 12.

**What it would cost.** Every read and write path changes shape:
`doc(db, 'slots', id)` becomes `doc(db, 'trips', tripId, 'slots', id)`, so every
function taking a slot or day id needs a trip id threaded to it. That's most of
`planningService.ts`, plus the functions that read trip data with the Admin SDK
(`shared-trip`, `link-preview`, `og-image`, `delete-trip`), which are the hardest
things here to test. Then a data migration relocating ~400 documents across seven
collections, with a dual-read window or a moment of downtime, and index rebuilds.

**Why it doesn't clear the bar.** The convention it removes already fails safely:
a query that doesn't filter on `trip_id` is refused on its first run, in dev,
with a clear permission error, and `npm run test:rules` pins that. That's very
different from the bug this replaced, which was silent and scaled with trip
length — fine at ten days, broken at twenty.

**Reconsider when** any of these is true, at which point it earns its own
schema project rather than being bolted onto something else:

- The `trip_id` filter convention actually bites — someone ships a query without
  it, or the rules grow a second field they have to agree on.
- Per-trip export, hard-delete or per-trip access control is wanted; those are
  natural with subcollections and awkward without.
- The schema is being reworked for another reason anyway.

If a comparable app were being started fresh, subcollections would be the right
model from day one — they cost nothing to adopt at the start.

### 12. Delete a trip's children with the trip

**What's wrong.** Trip `nfjax8ZH0fynNChNFgn3` no longer exists, but 5 days and
14 slots still point at it — found while backfilling `trip_id` on **7 Sep 2026**.
Firestore doesn't cascade, so whatever deleted that trip left its children
behind, and `netlify/functions/delete-trip.ts` is where that should happen.

They're unreachable from the app — nothing lists a trip that isn't there — so
this is untidiness and storage rather than a live bug. But it means "is this
document orphaned?" can't be answered by looking at the document.

**Done when** deleting a trip removes its days, slots, proposals, collection
items, stays, to-dos and notes, and the existing orphans are cleared out.
`scripts/backfill-trip-ids.mjs` already reports documents whose parent is
missing, which is the shape a cleanup script wants.

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


### 13. No CI — nothing is checked before it reaches `main`

Was a footnote under item 8 until **8 Sep 2026**; promoted because it kept being
invisible there. There is no `.github/workflows` at all, so `lint`, `build` and
`typecheck:functions` only ever run on whichever machine happened to push.

**The gap that isn't obvious.** Netlify already builds on push, so a broken
`npm run build` does surface — late, but it surfaces. What nothing catches is
`netlify/functions/`. `tsconfig.app.json` covers only `src`, so `npm run build`
skips the functions, and Netlify bundles them with its own esbuild pass, which
strips types **without checking them**. A type error in a function therefore
ships green and fails at runtime as a 500. `npm run typecheck:functions` exists
precisely for this and is run by nothing automatic.

That matters more than usual here because two sessions commit to `main`
concurrently — on 8 Sep one swept another's in-progress files into its own
commit and pushed, which put production in a half-shipped state for a while.

**What can actually be gated, measured 8 Sep 2026:**

| command | status | gate now? |
| --- | --- | --- |
| `npm run build` | clean | yes |
| `npm run typecheck:functions` | clean | yes |
| `npm run lint` | **112 errors, 72 warnings** | no |
| `test:rules`, `test:access` | need a JDK | yes, with `actions/setup-java` |

Do **not** put `npm run lint` in the first workflow. It is red today — mostly
`react-hooks/set-state-in-effect` and a `require()` in `tailwind.config.ts` —
and a check that is red on day one gets ignored, which is worse than not having
it. Either land it as non-blocking (`continue-on-error`) or clean the 112 first
and gate it after.

**Done when** a push to `main` and any PR runs `build` and
`typecheck:functions`, the emulator tests run with a JDK step, and `lint` is
either green and gating or explicitly non-blocking with a note saying why.

**Worth being honest about what this doesn't buy.** Neither bug found on 8 Sep —
the account menu painting behind the board's day photos, and `/settings` lighting
the Planning tab — would have been caught by any of these. Both were behavioural
and were found by driving the page and measuring it. CI protects against
regressions in what already type-checks; it is not a substitute for looking.
