-- ============================================================================
-- references_v2.sql — peer references + verification tier + AI cross-check
-- ============================================================================
-- Idempotent. Run after references_extend.sql + profiles_extend.sql.
--
-- Adds:
--   • ref_type='peer' — current-role colleague reference (discretion-protected,
--     candidate doesn't have to expose they're job-hunting to current manager)
--   • is_current_role flag — distinguishes current-role peer from past managers
--   • suggested_reason — Claude's reasoning for why this role was auto-picked
--   • profiles.verification_tier — 'unverified' | 'basic' | 'strong' | 'premium'
--   • profiles.verification_report jsonb — AI cross-check output
-- ============================================================================

-- 1. Widen ref_type to include 'peer'
alter table candidate_references drop constraint if exists candidate_references_ref_type_check;
alter table candidate_references
  add constraint candidate_references_ref_type_check
  check (ref_type in ('manager','colleague','stakeholder','peer'));

-- 2. Mark current-role references so they don't trigger nominee cascade
alter table candidate_references add column if not exists is_current_role bool default false;

-- 3. Smart-picker reasoning (shown to candidate as "why we picked this role")
alter table candidate_references add column if not exists suggested_reason text;

-- 4. Verification tier on the profile
alter table profiles
  add column if not exists verification_tier text
    check (verification_tier in ('unverified','basic','strong','premium'))
    default 'unverified',
  add column if not exists verification_report jsonb;

-- 5. Index on tier so company filters are fast
create index if not exists idx_profiles_verification_tier
  on profiles (verification_tier) where verification_tier != 'unverified';
