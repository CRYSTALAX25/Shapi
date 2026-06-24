-- active_applications = the candidate's OWN tracker for EXTERNAL jobs they're
-- pursuing via the Active product (jobs surfaced by web-search in /active, or
-- added manually). This is NOT the internal Shapi pipeline (that's `applications`,
-- which is keyed to a Shapi role_id). External jobs have free-text company names
-- and a job_url, no Shapi role. The Active product + dashboard count + interview
-- prep all read/write this table.
--
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor.

create table if not exists public.active_applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  -- external job (free text — no Shapi role_id)
  company_name text not null,
  job_title text not null,
  company_website text,
  job_url text,
  location text,
  salary_range text,
  match_score int,
  match_reason text,
  key_requirements jsonb,
  hiring_manager_name text,
  -- researching | applied | interviewing | offer | rejected | withdrawn
  stage text not null default 'researching',
  -- interview prep guide (JSON) written by /api/active/prep
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defensive: if an older/minimal active_applications table already existed,
-- `create table if not exists` above was a no-op — so ensure every column the
-- app + seed use actually exists.
alter table public.active_applications add column if not exists company_website text;
alter table public.active_applications add column if not exists job_url text;
alter table public.active_applications add column if not exists location text;
alter table public.active_applications add column if not exists salary_range text;
alter table public.active_applications add column if not exists match_score int;
alter table public.active_applications add column if not exists match_reason text;
alter table public.active_applications add column if not exists key_requirements jsonb;
alter table public.active_applications add column if not exists hiring_manager_name text;
alter table public.active_applications add column if not exists stage text not null default 'researching';
alter table public.active_applications add column if not exists notes text;

create index if not exists active_applications_candidate_idx
  on public.active_applications (candidate_id, created_at desc);

alter table public.active_applications enable row level security;

-- The candidate fully owns their own external-job tracker.
drop policy if exists "candidate manages own active applications" on public.active_applications;
create policy "candidate manages own active applications" on public.active_applications
  using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());

-- keep updated_at fresh
create or replace function set_active_applications_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists active_applications_updated_at on public.active_applications;
create trigger active_applications_updated_at before update on public.active_applications
  for each row execute procedure set_active_applications_updated_at();

-- Make PostgREST pick up the new columns immediately (avoids "column not
-- found in schema cache" until the next auto-reload).
notify pgrst, 'reload schema';
