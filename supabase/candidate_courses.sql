-- ============================================================================
-- candidate_courses.sql — upskilling tracker + verifiable course credentials
-- ============================================================================
-- Idempotent.
--
-- Powers the /upskill page. The Career Roadmap surfaces skill gaps; this table
-- tracks which courses a candidate is taking / has completed against those gaps,
-- and — critically for the "fountain of truth" principle — whether each
-- completion is VERIFIED (a checkable credential URL/ID was provided, or it was
-- completed through Shapi) vs SELF-REPORTED.
--
-- Trust tiers map to verification_status:
--   verified       → credential_url / credential_id present (companies can check)
--                    OR completed through a Shapi-facilitated pathway
--   self_reported  → candidate's claim, no checkable credential
-- ============================================================================

create table if not exists candidate_courses (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references auth.users(id) on delete cascade not null,
  -- Which roadmap skill gap this course addresses (free text, optional)
  skill text,
  course_name text not null,
  platform text,                    -- Coursera, Udemy, edX, DeepLearning.AI, etc.
  course_url text,                  -- link to the course (often a search URL)
  -- Cost tier the candidate chose
  tier text check (tier in ('free', 'paid', 'financing')) default 'free',
  -- Progress
  status text check (status in ('interested', 'in_progress', 'completed')) default 'interested',
  -- Trust
  verification_status text check (verification_status in ('self_reported', 'verified')) default 'self_reported',
  credential_url text,              -- public certificate verification URL
  credential_id text,               -- credential / badge ID (Credly, Coursera, etc.)
  via_shapi boolean default false,  -- true when completed through a Shapi pathway → auto-verified
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_candidate_courses_candidate
  on candidate_courses (candidate_id, status);

alter table candidate_courses enable row level security;

drop policy if exists "Candidates manage own courses" on candidate_courses;
create policy "Candidates manage own courses" on candidate_courses
  using (auth.uid() = candidate_id)
  with check (auth.uid() = candidate_id);
