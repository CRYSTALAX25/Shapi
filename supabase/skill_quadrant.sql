-- ============================================================================
-- skill_quadrant.sql — 4-axis skill fingerprint for candidates + roles
-- ============================================================================
-- Idempotent.
--
-- The 4 axes (Hands · Heart · Head · Spark) are the O*NET-inspired "ways of
-- working" classification. Every job and every person can be scored on all 4.
-- Matching uses cosine similarity between candidate's vector and role's vector
-- + industry filter on top.
--
-- AI Tier (User/Integrator/Builder) is stored separately in profiles.ai_tier —
-- it's a tool-domain badge, not a working-style axis.
-- ============================================================================

-- Candidates: skill_quadrant + continuous_learning
alter table profiles
  add column if not exists skill_quadrant jsonb,
  -- shape: { hands: 0-10, heart: 0-10, head: 0-10, spark: 0-10, reasoning: "...",
  --          assessed_at: timestamptz, assessed_from: "cv" | "cv+deepdive" }
  add column if not exists continuous_learning jsonb default '{}'::jsonb;
  -- shape: { certifications: [{name, issuer, year, verified}],
  --          events: [{name, year, role: "attendee"|"speaker"|"organizer", verified}],
  --          talks: [{venue, year, title}],
  --          oss: [{repo_url, role, stars}],
  --          courses: [{name, platform, year, completed: bool}] }

-- Roles: same skill_quadrant so we can match
alter table roles
  add column if not exists skill_quadrant jsonb;
  -- Same shape — set by company when posting (or auto-extracted from JD)

-- Index on each axis for fast filtering ("find candidates with Hands ≥ 8")
-- Postgres can't index jsonb numerics directly without expressions; use them inline
create index if not exists idx_profiles_skill_quadrant_hands
  on profiles (((skill_quadrant->>'hands')::int))
  where skill_quadrant is not null;
create index if not exists idx_profiles_skill_quadrant_heart
  on profiles (((skill_quadrant->>'heart')::int))
  where skill_quadrant is not null;
create index if not exists idx_profiles_skill_quadrant_head
  on profiles (((skill_quadrant->>'head')::int))
  where skill_quadrant is not null;
create index if not exists idx_profiles_skill_quadrant_spark
  on profiles (((skill_quadrant->>'spark')::int))
  where skill_quadrant is not null;
