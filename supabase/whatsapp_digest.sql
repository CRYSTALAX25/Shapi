-- ============================================================================
-- whatsapp_digest.sql — opt-in flag for the daily WhatsApp digest
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor (clear it first).
--
-- Subscribers (Roles Board / Active / Concierge / Bundle, plus CV Kit/Pro
-- trial users) are auto-opted-in. The candidate can toggle this off later
-- from their profile UI. Default TRUE so the first send goes out the day
-- after a candidate subscribes — no extra step required.
-- ============================================================================

alter table public.profiles
  add column if not exists whatsapp_digest_opt_in boolean not null default true;

-- Last successful digest send. Used by the cron to skip candidates who've
-- already received today's digest (guards against duplicate sends when Vercel
-- re-invokes the daily cron within the same UTC day).
alter table public.profiles
  add column if not exists whatsapp_digest_last_sent_at timestamptz;
