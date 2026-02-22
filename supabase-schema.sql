-- Tripboard Supabase Schema
-- Run this in your Supabase SQL Editor

-- 1. trips
create table trips (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  destinations text[] not null default '{}',
  start_date   date,
  end_date     date,
  created_at   timestamptz default now()
);

-- 2. days
create table days (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid references trips(id) on delete cascade,
  date        date,
  label       text not null,   -- "Day 1 · Paris"
  city        text not null,   -- "Paris"
  day_number  int  not null
);

-- 3. slots
create table slots (
  id                  uuid primary key default gen_random_uuid(),
  day_id              uuid references days(id) on delete cascade,
  time_label          text not null,        -- "Morning", "Afternoon", "Evening"
  category            text not null,        -- "food" | "activity" | "travel" | "accommodation" | "vibe"
  status              text not null default 'open',  -- "open" | "proposed" | "locked"
  locked_proposal_id  uuid,                -- FK added after proposals table
  sort_order          int  not null default 0
);

-- 4. proposals
create table proposals (
  id             uuid primary key default gen_random_uuid(),
  slot_id        uuid references slots(id) on delete cascade,
  proposer_name  text not null,
  title          text not null,
  note           text,
  url            text,
  votes          text[] not null default '{}',
  created_at     timestamptz default now()
);

-- 5. Add circular FK after proposals table exists
alter table slots
  add constraint fk_locked_proposal
  foreign key (locked_proposal_id)
  references proposals(id)
  on delete set null;

-- 6. Row Level Security — open access for link-based sharing
alter table trips    enable row level security;
alter table days     enable row level security;
alter table slots    enable row level security;
alter table proposals enable row level security;

create policy "Public access" on trips     for all using (true) with check (true);
create policy "Public access" on days      for all using (true) with check (true);
create policy "Public access" on slots     for all using (true) with check (true);
create policy "Public access" on proposals for all using (true) with check (true);

-- =============================================================================
-- SEED DATA: Paris & London · May 2026
-- Run AFTER the schema above. Replace trip_id/day_id values from the output.
-- =============================================================================

-- Insert trip
insert into trips (name, slug, destinations, start_date, end_date)
values (
  'Paris & London · May 2026',
  'paris-london-2026',
  ARRAY['Paris', 'London'],
  '2026-05-10',
  '2026-05-14'
);

-- To seed days + slots, run the following after grabbing the trip's id:
-- (Replace 'TRIP_ID_HERE' with the uuid from above)

/*
insert into days (trip_id, date, label, city, day_number) values
  ('TRIP_ID_HERE', '2026-05-10', 'Day 1 · Paris', 'Paris', 1),
  ('TRIP_ID_HERE', '2026-05-11', 'Day 2 · Paris', 'Paris', 2),
  ('TRIP_ID_HERE', '2026-05-12', 'Day 3 · Paris → London', 'Paris', 3),
  ('TRIP_ID_HERE', '2026-05-13', 'Day 4 · London', 'London', 4),
  ('TRIP_ID_HERE', '2026-05-14', 'Day 5 · London', 'London', 5);

-- Then for each day_id, insert slots like:
insert into slots (day_id, time_label, category, sort_order) values
  ('DAY1_ID', 'Morning',   'activity',      0),
  ('DAY1_ID', 'Afternoon', 'activity',      1),
  ('DAY1_ID', 'Evening',   'food',          2),
  ...
*/
