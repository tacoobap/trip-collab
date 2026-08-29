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
- The planning board's mobile day column is `w-[calc(100vw-2.5rem)]`, coupled to
  that `px-5`. Change both together.
- Page content is capped at `max-w-7xl`.

## Firestore

- `day_number` is **derived from date order**, never stored independently. Anything
  that can move a day (date edits, range changes) must go through `syncTripDays` or
  `renumberTripDays` in `src/services/planningService.ts`.
- `npm run build` does not type-check `netlify/functions/` — only `src`.
