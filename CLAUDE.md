# Working in this repo

Trup — a React 19 + Vite + Firestore trip planner. Hosted on Netlify at
`lets-plan-a-trip.netlify.app`, with serverless functions in `netlify/functions/`.
See `README.md` for setup, env vars and the full file map.

## Deploys — never poll for them

Netlify builds automatically on push to `main`. **Do not start a background task
that polls the live site to watch a deploy land.** It leaves a task hanging for
minutes, tells the user nothing they can't see in the Netlify dashboard, and the
exit condition is easy to get subtly wrong — which has produced confidently wrong
"it isn't deployed yet" reports.

After pushing, just say the push succeeded and that Netlify builds from `main`.
If the user specifically asks whether something is live, do **one** check and
report the result.

### Don't compare bundle filename hashes

`dist/assets/index-<hash>.js` from a local build will **never** match Netlify's,
because Vite embeds the `VITE_*` values at build time and Netlify's environment
differs from the local `.env`. The hash differs even when the source is identical.

To check what's actually deployed, grep the live bundle for a string unique to
the change:

```bash
curl -s https://lets-plan-a-trip.netlify.app/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
```

then fetch that asset and grep it. Pick a string that is genuinely unique — a
class or literal added by the change — and verify it isn't already used elsewhere
in `src/` first.

## Verifying UI changes

The app is behind Google sign-in, so the dev server lands on the sign-in page and
real trips aren't reachable. **Never sign in as the user to verify.** Instead
mount the components under test on a throwaway Vite entry with fabricated props:

1. Write `src/__scratch_preview.tsx` and `preview.html` at the repo root
2. `preview_start` the `trip-collab` config, navigate to `/preview.html`
3. Measure with `getBoundingClientRect()` rather than eyeballing screenshots —
   layout and spacing bugs here are a few pixels wide
4. **Delete both scratch files** before committing

For pure logic in `src/services/`, prefer bundling with esbuild against an
in-memory Firestore mock over clicking through the UI — there is no test runner
installed, and `--alias:firebase/firestore=<mock>` works well.

## Layout conventions

- Mobile gutter is `px-5`, desktop `sm:px-6`, on every page container — the page
  header, the trip bar, and each page's `<main>`. Keep them in sync; they were
  drifting at 8/12/16px before.
- The planning board is the time grid in `TimeGridBoard.tsx`. On phones it shows
  one day per screen: each column is `calc(100vw-6.25rem)` — the viewport less
  the left page gutter (`px-5`), the `w-9` hour gutter (`sm:w-12`), the column
  gap and `1.75rem` of air on the right, so a card is not flush to the edge of
  the screen. That air is why a day column stops 8px short of the page gutter on
  phones; it is deliberate, not drift. A column's `scroll-ml` must equal hour
  gutter + gap — `3.25rem` on phones — which is also column 0's `offsetLeft`;
  `dayColumns` reads it back from there. The gutter only fits its hour labels at
  `w-9`, so the two `12 AM` edge toggles render a compact `12a` below `sm`. Paging between days is
  ours, not the browser's: below `sm` the wrapper is `touch-pan-y`, so a touch
  can only scroll the hours natively, and `beginSwipe`/`trackSwipe`/`endSwipe`
  drive `scrollLeft` for swipes judged sideways. That is what keeps a vertical
  swipe's sideways drift from riding the snap fling onto the next day, so don't
  hand x back to `touch-action` without replacing it. Snapping is left on only
  to settle a swipe or a pill tap. Desktop keeps the free multi-column scroll at
  `w-[260px]`. `DAY_HEADER_PX` in
  `src/lib/timeGrid.ts` must stay identical across columns or the timelines stop
  lining up.
  (`DayColumn.tsx` / `SlotCard.tsx` are the old stacked board — still in the tree,
  no longer rendered. The `w-[calc(100vw-2.5rem)]` convention that used to live
  here is theirs, not the grid's.)
- The day header **is** the photo: it fills all `DAY_HEADER_PX`, with the day
  label on a bottom scrim and the "sometime this day" chips floating along the
  top, instead of a photo, a label row and a shelf row stacked. Two consequences.
  `data-shelf` now lives on the header root, so the whole header is the
  unschedule drop target — `TimeGridBoard` hit-tests one `[data-shelf]` per
  column in column order, so keep it to exactly one. And the photo box is
  `overflow-hidden`, so anything that has to escape it — the photo menu popover
  — renders as a sibling at the header root instead. A day with no photo swaps
  the white-on-scrim treatment for ordinary text on a dashed muted ground; white
  on a light placeholder is unreadable.
- Don't call `getComputedStyle` (or other unknown globals) in a component body:
  the React Compiler eslint pass bails on the whole component and
  `react-hooks/preserve-manual-memoization` fails the build.
- Page content is capped at `max-w-7xl`.
- Bottom sheets cap at `sm:max-w-3xl` with `mx-auto` — centred by auto margins,
  never a translate, which framer-motion's own transform would overwrite.

## Link previews

`/trip/:slug` and `/i/:token` are redirected to the `link-preview` function in
`netlify.toml`. Those two rules **must stay above the `/*` catch-all** — Netlify
takes the first match, so moving them below it silently restores the old generic
card with nothing failing.

- The card is drawn by `og-image` with satori, then rasterised by resvg. Its
  three fonts and resvg's `.wasm` live in `public/og/` and are **fetched from the
  CDN at runtime**, not bundled — `included_files` paths differ between local dev
  and Lambda, and this sidesteps that. Deleting anything in `public/og/` breaks
  the card, not the build.
- Satori collapses the space in `", 2026"` — it reads a comma followed by digits
  as one numeric token — so `metaText` in `ogCard.ts` swaps in a non-breaking
  space. Check any new text on the card at full size before trusting it.
- `og:title` is the wordmark on every link on purpose, not an oversight. The trip
  name lives in `og:description` and on the card itself.
- Verify with a crawler UA, since a normal request is served the plain shell:
  `curl -sA facebookexternalhit/1.1 <url> | grep 'og:'`

## Firestore

- `day_number` is **derived from date order**, never stored independently. Anything
  that can move a day (date edits, range changes) must go through `syncTripDays` or
  `renumberTripDays` in `src/services/planningService.ts`.
- A day's date is therefore its identity, not one of its fields, and there is no
  per-day date editor on purpose. Re-dating one day only shuffles it in the
  sequence — it can collide with its neighbour, or strand itself outside the
  range for the next `syncTripDays` to delete or bolt onto the end. Dates move as
  a range in `EditTripModal`; `EditDayModal` sets the day's **city** and nothing
  else.
- `npm run build` does not type-check `netlify/functions/` — only `src`.
