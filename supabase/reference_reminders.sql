-- ============================================================================
-- reference_reminders.sql — chase outstanding references after 3 days
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- Adds two columns to candidate_references so the daily cron can send polite
-- nudges to referees who were contacted but never engaged. Without these we
-- have no way to dedupe — the nudge would either never fire or fire every
-- single day until the ref completes.
--
--   reminder_sent_at      timestamptz  — when the most recent nudge went out
--                                       (null = never nudged)
--   reminder_count        int          — how many nudges have been sent
--                                       (we cap at 2 to avoid harassing refs)
--
-- Cron behaviour (src/app/api/cron/daily/route.ts → runReferenceReminders):
--   • status in ('contacted','opened')
--   • contacted_at < now() - 3 days (give the ref 3 days to engage organically)
--   • reminder_count < 2
--   • reminder_sent_at is null OR < now() - 4 days
--   → send one WhatsApp nudge from the ref's stored phone; bump count + stamp
-- ============================================================================

alter table public.candidate_references
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists reminder_count int not null default 0;

-- Helpful index for the cron sweep.
create index if not exists idx_candidate_references_reminder_due
  on public.candidate_references (status, contacted_at)
  where status in ('contacted', 'opened') and reminder_count < 2;
