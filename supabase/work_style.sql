-- ============================================================================
-- work_style.sql — optional work-style self-assessment result
-- ============================================================================
-- Idempotent.
--
-- Stores the candidate's work-style profile (5 spectrum scores 0-100).
-- Self-answered → surfaced as ◆ Shapi-assessed, never ✓ verified.
--
-- Shape:
--   { "scores": { "collaboration": 70, "leadership": 55, "structure": 40,
--                 "decisions": 80, "communication": 60 },
--     "assessed_at": "2026-05-20T..." }
-- ============================================================================

alter table profiles
  add column if not exists work_style jsonb;
