-- ============================================================================
-- career_roadmap.sql — AI resilience + personalised upskill/pivot plan
-- ============================================================================
-- Idempotent.
--
-- Two new columns power the Career Roadmap (Pro-tier-gated):
--   • ai_resilience_score (0-10): how AI-proof is the candidate's CURRENT role?
--     Computed by Claude analysing their role + recent AI displacement trends.
--   • career_recommendations jsonb: personalised plan with:
--       - resilience_reasoning
--       - skills_gaps[]      (what to learn, why, priority, suggested courses)
--       - pivot_paths[]      (where to move, why, transferable skills, actions)
--       - events_to_attend[] (relevant conferences/meetups, next 12 months)
--       - generated_at
--
-- Per Ana's vision (Shapi differentiator #6): "Career transition engine for
-- AI-displaced workers". This is the upskill/pivot half of Continuous Learning.
-- The first half (passive: what they've already done — certifications, events,
-- talks, OSS, courses) lives in profiles.continuous_learning (added earlier).
-- ============================================================================

alter table profiles
  add column if not exists ai_resilience_score int
    check (ai_resilience_score between 0 and 10),
  add column if not exists career_recommendations jsonb;

-- Index so company filters like "find AI-resilient hospitality managers" are fast
create index if not exists idx_profiles_ai_resilience
  on profiles (ai_resilience_score)
  where ai_resilience_score is not null;
