-- Interviews — booked inside Shapi, attached to an application (candidate+role).
-- v1: one current interview per application (reschedule = update). Idempotent.
-- Paste into the Supabase SQL editor (clear it first).

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  company_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz,
  -- google_meet | zoom | teams | in_person | other
  video_platform text,
  meeting_link text,
  location text,
  -- scheduled | completed | cancelled
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id)
);

create index if not exists interviews_company_idx on public.interviews (company_id, role_id);
create index if not exists interviews_candidate_idx on public.interviews (candidate_id);

alter table public.interviews enable row level security;

drop policy if exists "company manages own interviews" on public.interviews;
create policy "company manages own interviews" on public.interviews
  using (company_id = auth.uid()) with check (company_id = auth.uid());

drop policy if exists "candidate reads own interviews" on public.interviews;
create policy "candidate reads own interviews" on public.interviews
  for select using (candidate_id = auth.uid());

create or replace function set_interviews_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists interviews_updated_at on public.interviews;
create trigger interviews_updated_at before update on public.interviews
  for each row execute procedure set_interviews_updated_at();
