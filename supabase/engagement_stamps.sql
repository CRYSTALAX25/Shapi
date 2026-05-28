-- ============================================================================
-- engagement_stamps.sql — idempotency stamps for engagement automations
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- These columns mark "we already sent this transactional/celebration message"
-- so re-runs don't spam users. The /api/cv-builder route checks
-- profile_ready_wa_sent_at before firing the "your profile is live" WhatsApp;
-- the engagement cron uses kit_30d_reengagement_sent_at to gate the 30-day
-- one-time-buyer reactivation message.
--
-- All columns are nullable timestamptz — null = not yet sent.
-- ============================================================================

alter table public.profiles
  add column if not exists profile_ready_wa_sent_at timestamptz,
  add column if not exists kit_30d_reengagement_sent_at timestamptz,
  add column if not exists feedback_nudge_last_sent_at timestamptz;
