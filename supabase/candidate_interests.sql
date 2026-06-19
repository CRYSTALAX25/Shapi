-- ─────────────────────────────────────────────────────────────────────────────
-- candidate_interests — a candidate expressing interest in a role (the other
-- half of a mutual match: company shortlists + candidate interested = connect).
-- Reconstructed from the live columns (id, candidate_id, role_id, created_at)
-- + how api/candidate/interest and the company dashboard read it. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.candidate_interests (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),

  unique (candidate_id, role_id)
);

create index if not exists candidate_interests_role_idx      on public.candidate_interests (role_id);
create index if not exists candidate_interests_candidate_idx on public.candidate_interests (candidate_id);

alter table public.candidate_interests enable row level security;

-- The candidate manages their own interests. Companies read interest in their
-- roles via the service role (matching/dashboard), which bypasses RLS.
drop policy if exists candidate_interests_own on public.candidate_interests;
create policy candidate_interests_own on public.candidate_interests
  for all using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());
