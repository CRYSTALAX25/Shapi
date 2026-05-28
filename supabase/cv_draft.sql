-- ============================================================================
-- cv_draft.sql — persist in-flight CV-builder chat so users can resume
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- The Claude CV-builder interview on /cv-builder used to be React-state only:
-- if a candidate refreshed the tab or closed the browser mid-interview, every
-- answer was lost. This column persists the running conversation so the
-- dashboard can show a "Finish your CV" resume card and the page can restore
-- the chat on next visit.
--
-- Shape: jsonb array of { role: 'user' | 'assistant', content: string }.
-- Cleared (or just ignored) once profiles.cv_parsed = true or the AI emits
-- [PROFILE_READY] and the profile is built — the draft has served its purpose.
-- ============================================================================

alter table public.profiles
  add column if not exists cv_builder_chat jsonb,
  add column if not exists cv_builder_chat_updated_at timestamptz;
