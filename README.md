# Trup — Trip planning, together

Collaborative trip itinerary planning. Create a trip, add days and time slots, propose ideas, vote, and lock in the plan. View a polished itinerary and manage a shared collection of ideas.

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

- `src/pages/` — Route-level pages (Landing, Trip, Itinerary, Collection, Seed).
- `src/components/` — UI: planning board, itinerary sections, collection, stays, shared layout.
- `src/services/` — Data layer: `tripService`, `planningService`, `staysService`, `collectionService`.
- `src/hooks/` — `useTrip`, `useStays`, `useCollectionItems`, `useDisplayName`, `useNarrativeGeneration`, `useCollectionSuggestions`, etc.
- `src/lib/` — Firebase, utils, time/URL helpers, image upload/search, narrative and suggestion (Gemini).
- `src/types/database.ts` — Shared Firestore/document types.
- `netlify/functions/` — Serverless: `search-image` (Unsplash proxy), `generate-narrative` (optional server-side Gemini), `upload-github-image` (GitHub image upload with PAT server-side).

## Next up (productionizing)

- **Done:** All collection writes (add/update/delete/like) live in `collectionService`; trip/days edit flows (EditTripModal, EditDayModal, add first day when no dates, destinations normalized); chunked slots in useTrip; toast system (`ToastProvider` + `useToast`) with user-facing feedback for hero upload, narrative generate/update, collection suggestions and add/delete; AI hooks `useNarrativeGeneration` and `useCollectionSuggestions` (ItineraryPage and CollectionPage).
- **Next:** Schema docs & migrations; tests. See **Feb 28 Productionizing.md** for the full plan.

## Deploy

The app is set up for **Netlify**: build command `npm run build`, publish directory `dist` (see `netlify.toml`).

### Netlify environment variables

In **Site configuration → Environment variables**, set at least:

- **Build / client:** the same `VITE_*` values you use locally (from `.env.example`), so Vite can embed public Firebase config and any client-side keys you rely on.
- **Functions (server-only):** `GEMINI_API_KEY`, `UNSPLASH_ACCESS_KEY`, **`FIREBASE_SERVICE_ACCOUNT_JSON`** (Firebase Admin for ID token verification), and **`GITHUB_TOKEN`**, **`GITHUB_OWNER`**, **`GITHUB_REPO`** if you use custom image uploads. Do **not** set `VITE_GITHUB_TOKEN` on Netlify — it is compiled into the browser bundle and triggers secrets scanning (`ghp_` / `github_pat_`).

### If a service account JSON was committed

Netlify’s secrets scanner will block builds until the private key is gone from the repo (including **history**).

1. Remove the file from the tree, ensure it matches an entry in `.gitignore`, and commit that change.
2. **Purge Git history** for that path (for example [`git filter-repo`](https://github.com/newren/git-filter-repo) with `--path path/to/file.json --invert-paths`), then force-push, or follow [GitHub’s guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) to remove sensitive data.
3. In **Google Cloud Console** → IAM → **Service accounts** → your Firebase admin user → **Keys**, **delete** the leaked key and **add** a new key. Update **`FIREBASE_SERVICE_ACCOUNT_JSON`** in Netlify with the new JSON (one line).
