-- availability_slots = interview time slots. The CANDIDATE offers their
-- availability (candidate_id = owner); a COMPANY books one. Backs
-- /api/candidate/availability (candidate creates/lists/deletes own slots) and
-- /api/company/book (company books an open slot + sends .ics).
--
-- NOTE: the table already existed in the DB (candidate_id-based) — this file is
-- the missing repo record of it. Fully idempotent: create-if-not-exists plus
-- add-column-if-not-exists, so it's safe to (re-)run against the live table.
-- No UI surfaces this yet.

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  slot_datetime timestamptz not null,
  duration_mins int not null default 30,
  -- open | booked
  status text not null default 'open',
  booked_by uuid references auth.users(id) on delete set null,
  booked_role_id uuid references public.roles(id) on delete set null,
  booked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Defensive: ensure every column the routes use exists, even if an older
-- version of the table predates them.
alter table public.availability_slots add column if not exists status text not null default 'open';
alter table public.availability_slots add column if not exists booked_by uuid references auth.users(id) on delete set null;
alter table public.availability_slots add column if not exists booked_role_id uuid references public.roles(id) on delete set null;
alter table public.availability_slots add column if not exists booked_at timestamptz;
alter table public.availability_slots add column if not exists duration_mins int not null default 30;

create index if not exists availability_slots_candidate_idx
  on public.availability_slots (candidate_id, slot_datetime);
create index if not exists availability_slots_booked_idx
  on public.availability_slots (booked_by);

alter table public.availability_slots enable row level security;

-- The candidate owns and manages their own slots.
drop policy if exists "candidate manages own slots" on public.availability_slots;
create policy "candidate manages own slots" on public.availability_slots
  using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());

-- Any authenticated user can read open slots (to book) + slots they booked.
drop policy if exists "read open or own-booked slots" on public.availability_slots;
create policy "read open or own-booked slots" on public.availability_slots
  for select using (status = 'open' or booked_by = auth.uid() or candidate_id = auth.uid());

-- A booker can mark an open slot booked (the API scopes the update to status='open').
drop policy if exists "booker can book open slot" on public.availability_slots;
create policy "booker can book open slot" on public.availability_slots
  for update using (status = 'open') with check (booked_by = auth.uid());
