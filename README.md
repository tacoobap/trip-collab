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
- **GitHub (image upload)** — Optional. For uploading custom hero/day images. Set `VITE_GITHUB_TOKEN`, `VITE_GITHUB_OWNER`, `VITE_GITHUB_REPO`.

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
- `src/hooks/` — `useTrip`, `useStays`, `useCollectionItems`, `useProposerName`.
- `src/lib/` — Firebase, utils, time/URL helpers, image upload/search, narrative and suggestion (Gemini).
- `src/types/database.ts` — Shared Firestore/document types.
- `netlify/functions/` — Serverless: `search-image` (Unsplash proxy), `generate-narrative` (optional server-side Gemini).

## Deploy

The app is set up for **Netlify**: build command `npm run build`, publish directory `dist`. Configure environment variables in the Netlify dashboard (same keys as `.env.example`, without the `VITE_` prefix for server-side function secrets like `GEMINI_API_KEY` and `UNSPLASH_ACCESS_KEY`).
