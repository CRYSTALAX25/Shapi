-- ============================================================================
-- candidate_events.sql — track roadmap-recommended events (book / attend status)
-- ============================================================================
-- Idempotent.
--
-- The Career Roadmap suggests events to attend. This table overlays the
-- candidate's status on each: interested → booked → attended / not_attended.
-- "attended" is self-reported by default (a calendar claim), consistent with
-- the fountain-of-truth model — verification (ticket/photo) is a later add.
-- ============================================================================

create table if not exists candidate_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references auth.users(id) on delete cascade not null,
  event_name text not null,
  event_when text,
  event_where text,
  event_url text,
  status text check (status in ('interested', 'booked', 'attended', 'not_attended')) default 'interested',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_candidate_events_candidate
  on candidate_events (candidate_id);
-- One status row per candidate per event name
create unique index if not exists idx_candidate_events_unique
  on candidate_events (candidate_id, event_name);

alter table candidate_events enable row level security;

drop policy if exists "Candidates manage own events" on candidate_events;
create policy "Candidates manage own events" on candidate_events
  using (auth.uid() = candidate_id)
  with check (auth.uid() = candidate_id);

-- ── Company-sponsored courses ────────────────────────────────────────────────
-- When a candidate is hired through Shapi and the employer funds their
-- upskilling, we record the sponsor so it shows on the course ("Sponsored by
-- <Company>"). Foundation for the placement-driven sponsorship flow.
alter table candidate_courses
  add column if not exists sponsored_by text,
  add column if not exists sponsor_amount numeric;

