-- ─────────────────────────────────────────────────────────────────────────────
-- company_shortlists — a company's MANUALLY saved candidates per role (the
-- "save / shortlist" action). Distinct from active_hiring_queue (auto-generated
-- daily suggestions). Reconstructed from code usage (api/company/shortlist:
-- upsert on company_id,candidate_id,role_id). Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.company_shortlists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),

  unique (company_id, candidate_id, role_id)
);

create index if not exists company_shortlists_company_idx on public.company_shortlists (company_id, role_id);

alter table public.company_shortlists enable row level security;

-- The owning company manages its own shortlist; candidates can see that they've
-- been shortlisted (read only). (Matching/cron runs via the service role.)
drop policy if exists company_shortlists_company on public.company_shortlists;
create policy company_shortlists_company on public.company_shortlists
  for all using (company_id = auth.uid()) with check (company_id = auth.uid());

drop policy if exists company_shortlists_candidate_read on public.company_shortlists;
create policy company_shortlists_candidate_read on public.company_shortlists
  for select using (candidate_id = auth.uid());
