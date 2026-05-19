-- ============================================================================
-- concierge_queue.sql — daily AI-shortlisted matches + drafted outreach
-- ============================================================================
-- Idempotent.
--
-- The Concierge tier ($79/mo) does the candidate's job-hunting work for them:
-- once per day, we scan open roles, pick the best 3-5 matches for each
-- Concierge candidate, and AI-draft a personalised intro message for each.
-- Drafts await the candidate's approval (one tap) before being sent — OR if
-- the candidate has opted into auto-send, we fire them automatically and just
-- show them what went out.
--
-- Each draft has its own lifecycle:
--   pending_approval  → candidate must tap approve / decline
--   auto_send         → will fire on the next batch run
--   sent              → outreach delivered
--   declined          → candidate said no
--   stale             → role closed / candidate paused
-- ============================================================================

create table if not exists concierge_queue (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references auth.users(id) on delete cascade not null,
  role_id uuid not null,
  -- Matching telemetry — so we can audit why this was suggested
  match_score int not null,
  match_reasons text[] default '{}',
  -- AI-drafted intro that the candidate can edit/approve
  draft_body text not null,
  draft_subject text,
  -- Lifecycle
  status text default 'pending_approval' check (
    status in ('pending_approval', 'auto_send', 'approved', 'sent', 'declined', 'stale')
  ),
  approved_at timestamptz,
  sent_at timestamptz,
  declined_at timestamptz,
  -- For audit + re-runs
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_concierge_candidate_status
  on concierge_queue (candidate_id, status);
create index if not exists idx_concierge_role
  on concierge_queue (role_id);
create unique index if not exists idx_concierge_unique_pair
  on concierge_queue (candidate_id, role_id);

alter table concierge_queue enable row level security;

-- Candidates see/manage their own queue
drop policy if exists "Candidates manage own concierge queue" on concierge_queue;
create policy "Candidates manage own concierge queue" on concierge_queue
  using (auth.uid() = candidate_id)
  with check (auth.uid() = candidate_id);

-- Service role bypasses (cron + AI scanner)

-- Candidate-side preferences for the Concierge feature
alter table profiles
  add column if not exists concierge_auto_send boolean default false,
  add column if not exists concierge_last_scan_at timestamptz,
  add column if not exists concierge_paused_until date;
