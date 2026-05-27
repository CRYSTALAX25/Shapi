-- ============================================================================
-- active_hiring_subscription.sql — STRATEGY §14 Tier 1 + §16 Active Hiring SKU
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- Adds the per-product subscription-id column for the new "Active Hiring"
-- company-side SKU ($499/mo or $4990/yr). The Stripe webhook stores the
-- subscription_id here on checkout.session.completed and clears it on
-- customer.subscription.deleted, matching the pattern used for the candidate
-- subscriptions (roles_board, active, concierge, bundle).
--
-- Feature gating is read off profiles.subscription_product[] (the array
-- holding 'active_hiring_monthly' / 'active_hiring_yearly'); this column
-- is the reverse-lookup so we can cancel one product without affecting
-- the others.
-- ============================================================================

alter table public.profiles
  add column if not exists active_hiring_subscription_id text;

create index if not exists profiles_active_hiring_sub_idx
  on public.profiles (active_hiring_subscription_id)
  where active_hiring_subscription_id is not null;
