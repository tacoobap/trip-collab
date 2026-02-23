# Trup — Product & Build Plan

Collaborative trip itinerary planning. Friends propose ideas into slots, select favorites, and see a beautiful final itinerary.

**Test case:** Paris + London trip (Rad & Tyler)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React + TypeScript |
| Styling | Tailwind CSS + design system from charleston-dreams |
| Animation | Framer Motion |
| Backend / DB | Supabase (Postgres + Auth-free link sharing) |
| Hosting | Netlify |
| Icons | Lucide React |

---

## Repo Setup Steps

```bash
# 1. Create the project
npm create vite@latest tripboard -- --template react-ts
cd tripboard

# 2. Install dependencies
npm install @supabase/supabase-js framer-motion lucide-react react-router-dom
npm install -D tailwindcss postcss autoprefixer @tailwindcss/typography
npx tailwindcss init -p

# 3. Copy over from charleston-dreams:
#    - src/index.css          (full design system: colors, fonts, variables)
#    - tailwind.config.ts     (custom colors: sand, golden, navy, sage, coral, warm-white)
#    - components.json        (shadcn config)
#    - postcss.config.js

# 4. Install shadcn/ui components you'll need
npx shadcn-ui@latest add button card badge dialog input textarea tooltip

# 5. Init git and push
git init
gh repo create tripboard --public --source=. --remote=origin --push
```

---

## Supabase Schema

### `trips`
```sql
id          uuid primary key default gen_random_uuid()
name        text not null           -- "Paris & London · May 2026"
slug        text unique not null    -- "paris-london-rad-tyler" (used in URL)
destinations text[]                 -- ["Paris", "London"]
start_date  date
end_date    date
created_at  timestamptz default now()
```

### `days`
```sql
id          uuid primary key default gen_random_uuid()
trip_id     uuid references trips(id) on delete cascade
date        date
label       text    -- "Day 1 · Paris", "Day 3 · London"
city        text    -- "Paris"
day_number  int
```

### `slots`
```sql
id          uuid primary key default gen_random_uuid()
day_id      uuid references days(id) on delete cascade
time_label  text        -- "Morning", "Afternoon", "Evening", or "9:00 AM"
category    text        -- "food" | "activity" | "travel" | "accommodation" | "vibe"
status      text        -- "open" | "proposed" | "locked"
locked_proposal_id uuid  -- FK to proposals (set null until locked, add FK after)
sort_order  int
```

### `proposals`
```sql
id            uuid primary key default gen_random_uuid()
slot_id       uuid references slots(id) on delete cascade
proposer_name text not null     -- "Rad" or "Tyler" (no auth — link-based)
title         text not null     -- "Wild Common"
note          text              -- "French Quarter, intimate, great wine list"
url           text              -- optional Google Maps / website link
votes         text[]            -- array of proposer names who liked it
created_at    timestamptz default now()
```

> After creating both tables, add the circular FK:
> `ALTER TABLE slots ADD CONSTRAINT fk_locked_proposal FOREIGN KEY (locked_proposal_id) REFERENCES proposals(id);`

### Row Level Security
All tables: enable RLS, add policy `FOR ALL USING (true)` — anyone with the link can read/write. Fine for MVP link-based access.

---

## URL Structure

```
/                          Landing / create a new trip
/trip/:slug                The main planning board (collaborative)
/trip/:slug/itinerary      The final beautiful read-only view
/trip/:slug?name=Rad       Passing your name via query param (persisted to localStorage)
```

---

## Component Architecture

```
src/
  components/
    layout/
      PageHeader.tsx         Trip name, dates, destinations, traveler avatars
      CityDivider.tsx        Visual break between Paris days and London days
    planning/
      PlanningBoard.tsx      Main board — grid of DayColumns
      DayColumn.tsx          One day: label + list of SlotCards
      SlotCard.tsx           A single slot (open / proposed / locked states)
      ProposalCard.tsx       One idea inside a slot — proposer name, title, note, vote button
      AddProposalForm.tsx    Inline form to drop a new idea into a slot
      LockConfirm.tsx        Dialog: "Lock in [Wild Common] for Saturday dinner?"
    itinerary/
      ItineraryView.tsx      The final editorial view (evolved from charleston-dreams)
      DaySection.tsx         (adapted from charleston-dreams)
      TimelineItem.tsx       (adapted from charleston-dreams — now data-driven)
    shared/
      ProposerAvatar.tsx     Colored dot/initial for Rad vs Tyler
      StatusBadge.tsx        "Open" | "2 ideas" | "Locked"
      CityTag.tsx            "Paris" | "London" pill
```

---

## The Three Views

### 1. Planning Board (`/trip/:slug`)
- Grid layout: columns = days, rows = time blocks (Morning / Afternoon / Evening)
- Each slot shows its status visually:
  - **Open**: dashed border, "+ Add idea" button — feels like an invitation
  - **Proposed**: solid border, shows proposal count + proposer avatars
  - **Locked**: filled background, locked icon, proposer credit shown
- Clicking an open slot expands an inline `AddProposalForm`
- Clicking a proposed slot opens a drawer/sheet showing all proposals for that slot with vote buttons and a "Lock this one" button

### 2. Proposal Detail Drawer
- Shows all proposals for a slot side by side
- Each card shows: proposer avatar + name, title, note, optional link, vote count
- "Lock it in" button on each — triggers `LockConfirm` dialog
- After locking, the slot animates to locked state and the drawer closes

### 3. Final Itinerary View (`/trip/:slug/itinerary`)
- Read-only, beautiful
- Evolved version of the charleston-dreams layout
- Shows locked items only, grouped by city/day
- Ken Burns on photos, animated timeline — all the charleston-dreams polish
- Shareable as a standalone link

---

## Proposer Identity (No Auth)

On first visit to a trip, show a name prompt:
```
"Who are you?"
[ Rad ]  [ Tyler ]  [ + Someone else ]
```
Store in `localStorage` as `trup_name`. Pass as `?name=Rad` in any links shared.
This name attaches to every proposal and vote they make.

Color assignment: each unique name gets a consistent color (hash the name → pick from a palette). Rad might always be teal, Tyler always golden. These carry through avatars, vote indicators, and the "added by" credits.

---

## Phased Build Order

### Phase 1 — Foundation
- [ ] Repo setup, design system imported
- [ ] Supabase project created, schema applied
- [ ] Supabase client wired up (`src/lib/supabase.ts`)
- [ ] `trips` CRUD: create a trip, generate slug, basic landing page

### Phase 2 — Planning Board
- [ ] Load a trip + its days/slots/proposals
- [ ] Render `PlanningBoard` with `DayColumn` + `SlotCard`
- [ ] `AddProposalForm` — submit a proposal to a slot
- [ ] Proposal drawer — view all proposals for a slot
- [ ] Vote on a proposal
- [ ] Lock a proposal → slot status updates to "locked"

### Phase 3 — Itinerary View
- [ ] `/trip/:slug/itinerary` route
- [ ] Render locked proposals in editorial timeline layout
- [ ] City dividers between Paris and London sections
- [ ] "Still planning" state for slots not yet locked

### Phase 4 — Polish
- [ ] Name/identity prompt on first visit
- [ ] Proposer color system (ProposerAvatar)
- [ ] Animations: slot state transitions, proposal lock animation
- [ ] Mobile layout for planning board (stack columns, swipe between days)
- [ ] Trip creation flow (landing page)

---

## Design Principles to Carry Over

- **Same typographic system**: Playfair Display serif + DM Sans
- **Same warm palette**: sand, golden, coral, navy, sage — all defined in `index.css`
- **Planning mode feels "loose"**: dashed borders, soft fills, Post-it energy
- **Locked/final mode feels "editorial"**: the charleston-dreams aesthetic
- The transition between the two states should feel satisfying — like ideas crystallizing into a real trip

---

## Paris + London Test Data

Suggested initial structure to seed when setting up:

```
Trip: "Paris & London · May 2026"
Slug: paris-london-2026

Days:
  Day 1 · Paris — Arrive, settle in, first dinner
  Day 2 · Paris — Full day
  Day 3 · Paris — Morning, then Eurostar to London
  Day 4 · London — Full day
  Day 5 · London — Last morning, fly home

Travelers: Rad, Tyler
```
