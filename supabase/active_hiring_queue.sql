-- ─────────────────────────────────────────────────────────────────────────────
-- active_hiring_queue — the company-side mirror of concierge_queue.
--
-- Active Hiring ($499/mo) promises: "a daily shortlist of verified candidates
-- for each open role, with outreach drafted and waiting for your approval."
-- Once a day (cron) we score the candidate pool against each open role of every
-- Active-Hiring company, pick the top matches not already queued, draft a warm
-- recruiter→candidate intro, and drop it here as 'pending_approval'. The company
-- approves with one tap; a sender flips 'approved' → 'sent' and emails the
-- candidate (reply-to = the company), then mirrors into the pipeline.
--
-- Distinct from company_shortlists (the MANUAL saved list). Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.active_hiring_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null,
  candidate_id uuid not null references auth.users(id) on delete cascade,

  match_score int not null default 0,
  match_reasons text[] default '{}',

  draft_subject text,
  draft_body text,

  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'sent', 'dismissed')),

  created_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),

  -- One suggestion per (company, role, candidate) — re-runs skip dupes.
  unique (company_id, role_id, candidate_id)
);

create index if not exists active_hiring_queue_company_idx on public.active_hiring_queue (company_id, status);
create index if not exists active_hiring_queue_send_idx    on public.active_hiring_queue (status) where sent_at is null;

alter table public.active_hiring_queue enable row level security;

-- The owning company can read + approve/dismiss its own queue. Inserts and the
-- send-flip run via the service role (cron), which bypasses RLS.
drop policy if exists active_hiring_queue_select_own on public.active_hiring_queue;
create policy active_hiring_queue_select_own on public.active_hiring_queue
  for select using (company_id = auth.uid());

drop policy if exists active_hiring_queue_update_own on public.active_hiring_queue;
create policy active_hiring_queue_update_own on public.active_hiring_queue
  for update using (company_id = auth.uid()) with check (company_id = auth.uid());
