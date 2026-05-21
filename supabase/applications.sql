-- Applications = the hiring pipeline. One row per candidate per role.
-- Holds the stage plus BOTH sides' scorecards (so each can rank when choosing
-- between several candidates / several opportunities).
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor (clear it first).

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  company_id uuid not null references auth.users(id) on delete cascade,
  -- matched | shortlisted | interviewing | offer | hired | passed
  stage text not null default 'shortlisted',
  -- company rates the candidate; candidate rates the opportunity. {param: 1-5}
  company_scorecard jsonb,
  candidate_scorecard jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id)
);

create index if not exists applications_company_idx on public.applications (company_id, role_id);
create index if not exists applications_candidate_idx on public.applications (candidate_id);

alter table public.applications enable row level security;

-- Company manages applications to its own roles.
drop policy if exists "company manages own applications" on public.applications;
create policy "company manages own applications" on public.applications
  using (company_id = auth.uid()) with check (company_id = auth.uid());

-- Candidate can read + update their own applications (API restricts WHICH fields).
drop policy if exists "candidate manages own applications" on public.applications;
create policy "candidate manages own applications" on public.applications
  using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());

-- keep updated_at fresh
create or replace function set_applications_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at before update on public.applications
  for each row execute procedure set_applications_updated_at();
