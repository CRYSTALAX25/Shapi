-- ============================================================================
-- course_wallet.sql — "Smart Course Wallet" additive columns
-- ============================================================================
-- Idempotent. Extends candidate_courses (see candidate_courses.sql) to power the
-- upgraded /upskill page:
--   liked          → candidate saved/favourited this course (heart toggle)
--   subsidy_type   → who pays: null | 'government' | 'employer'
--   subsidy_detail → free-text label (e.g. "UAE One Million Coders", "Acme L&D")
--   duration_hours → estimated course length in hours (for "⏱️ 12h" badge)
-- ============================================================================

alter table candidate_courses add column if not exists liked boolean not null default false;
alter table candidate_courses add column if not exists subsidy_type text;
alter table candidate_courses add column if not exists subsidy_detail text;
alter table candidate_courses add column if not exists duration_hours integer;

-- Constrain subsidy_type to the supported values (idempotent re-add).
alter table candidate_courses drop constraint if exists candidate_courses_subsidy_type_check;
alter table candidate_courses add constraint candidate_courses_subsidy_type_check
  check (subsidy_type is null or subsidy_type in ('government', 'employer'));
