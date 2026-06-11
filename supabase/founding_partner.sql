-- Founding Partner flag (STRATEGY §2, LOCKED v5 — 2026-06-10)
--
-- The Founding Partner offer = first 15 COMPANIES get 50% off their first paid
-- tier (Pro or Growth) for 6 months, then auto-reverts; they are grandfathered.
--
-- This boolean is the count source for the REAL cohort cap. When a founding
-- checkout completes, the Stripe webhook stamps founding_partner = true. The
-- /api/stripe/company-checkout route counts profiles WHERE founding_partner =
-- true and only attaches the founding coupon while that count < 15.
--
-- Run this in the Supabase SQL editor before launch. Idempotent.

alter table public.profiles
  add column if not exists founding_partner boolean not null default false;

-- Index keeps the cap COUNT(*) cheap as the table grows.
create index if not exists profiles_founding_partner_idx
  on public.profiles (founding_partner)
  where founding_partner = true;

comment on column public.profiles.founding_partner is
  'TRUE once this company redeemed the Founding Partner 50%-off-6-months offer. Caps the cohort at 15 (see /api/stripe/company-checkout) and grandfathers them against future price rises.';
