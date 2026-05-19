-- ============================================================================
-- jd_chat.sql — WhatsApp JD intake for hiring companies (mirror of candidate flow)
-- ============================================================================
-- Idempotent.
--
-- The candidate WhatsApp interview captures their work history into a
-- structured profile. JD-via-WhatsApp is the company-side mirror:
-- a company chats their job opening over WhatsApp, Claude extracts the role
-- into a draft row in `roles`, and the company opens the dashboard to polish
-- and publish.
--
-- Storage:
--   profiles.jd_chat              jsonb[]  — running [{role,content}] for the
--                                            in-progress JD conversation
--   profiles.jd_conversation_active boolean — true while JD intake is mid-flight
--   profiles.jd_active_role_id    uuid    — the draft `roles` row being built
-- ============================================================================

alter table profiles
  add column if not exists jd_chat jsonb default '[]',
  add column if not exists jd_conversation_active boolean default false,
  add column if not exists jd_active_role_id uuid;

create index if not exists idx_profiles_jd_active
  on profiles (id) where jd_conversation_active = true;

-- Extend `roles` to carry the structured fields the JD extractor produces.
-- All idempotent.
alter table roles
  add column if not exists employment_type text default 'full_time',
  add column if not exists must_have_skills text[] default '{}',
  add column if not exists nice_to_have_skills text[] default '{}',
  add column if not exists years_experience_min int,
  add column if not exists visa_sponsored boolean,
  add column if not exists hiring_notes text;
