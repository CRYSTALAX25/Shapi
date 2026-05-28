-- ============================================================================
-- dunning.sql — payment-failure dunning state
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- When Stripe fires invoice.payment_failed we record the moment + start a
-- 3-stage dunning sequence (WA at Day 0, Day 3, Day 7). On any successful
-- payment we clear the state. On Day 7 with no payment, we set
-- subscription_status='grace_expired' so the feature gates lock down but the
-- account + data are preserved.
--
-- Columns added to public.profiles:
--   payment_failed_at        timestamptz  — when the most recent failure fired
--   dunning_step             int          — 0 = initial WA sent, 1 = day 3 sent,
--                                           2 = day 7 sent (grace expired)
--   stripe_subscription_id   already exists (used to reverse-link)
-- ============================================================================

alter table public.profiles
  add column if not exists payment_failed_at timestamptz,
  add column if not exists dunning_step int not null default 0;
