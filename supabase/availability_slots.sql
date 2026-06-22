-- availability_slots = interview time slots an interviewer (company) offers; a
-- candidate books one. Backs /api/company/book (book a slot, send .ics) and
-- /api/candidate/availability. NOTE: no UI surfaces this yet — backend-ready
-- only — but the routes 500 without the table, so create it to unblock them.
--
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor.

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slot_datetime timestamptz not null,
  duration_mins int not null default 30,
  -- open | booked
  status text not null default 'open',
  booked_by uuid references auth.users(id) on delete set null,
  booked_role_id uuid references public.roles(id) on delete set null,
  booked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists availability_slots_owner_idx
  on public.availability_slots (owner_id, slot_datetime);
create index if not exists availability_slots_booked_idx
  on public.availability_slots (booked_by);

alter table public.availability_slots enable row level security;

-- Owner manages their own slots.
drop policy if exists "owner manages own slots" on public.availability_slots;
create policy "owner manages own slots" on public.availability_slots
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Anyone authenticated can read open slots (to book) + read slots they booked.
drop policy if exists "read open or own-booked slots" on public.availability_slots;
create policy "read open or own-booked slots" on public.availability_slots
  for select using (status = 'open' or booked_by = auth.uid() or owner_id = auth.uid());

-- A booker can mark an open slot booked (the API scopes the update to status='open').
drop policy if exists "booker can book open slot" on public.availability_slots;
create policy "booker can book open slot" on public.availability_slots
  for update using (status = 'open') with check (booked_by = auth.uid());
