-- ============================================================
-- Shapi — PENDING MIGRATIONS, batch B (2026-06-11). Paste once, top→bottom.
-- All idempotent — safe to re-run even if one was already applied.
--
-- Found during the 2026-06-11 route audit: these columns are referenced by
-- live code but missing from the production DB. Until this runs:
--   1. cv_draft           — /dashboard "Finish your CV" resume card stays
--                           hidden; CV-builder chat drafts aren't persisted
--   2. dunning            — payment-failure WA sequence + recovery clearing
--                           are inert (Stripe webhook degrades quietly)
--   3. whatsapp_digest    — daily candidate + company WA digests never send
--   4. product flags      — strategic_plan_purchased_at / brain_hr_os_active
--                           had NO migration file anywhere; entitlements.ts
--                           gates Product 2 / Product 3 on them
-- ============================================================

-- ===== 1. BEGIN cv_draft.sql =====
alter table public.profiles
  add column if not exists cv_builder_chat jsonb,
  add column if not exists cv_builder_chat_updated_at timestamptz;
-- ===== END cv_draft.sql =====

-- ===== 2. BEGIN dunning.sql =====
alter table public.profiles
  add column if not exists payment_failed_at timestamptz,
  add column if not exists dunning_step int not null default 0;
-- ===== END dunning.sql =====

-- ===== 3. BEGIN whatsapp_digest.sql =====
alter table public.profiles
  add column if not exists whatsapp_digest_opt_in boolean not null default true;

alter table public.profiles
  add column if not exists whatsapp_digest_last_sent_at timestamptz;
-- ===== END whatsapp_digest.sql =====

-- ===== 4. BEGIN product flags (Product 2 / Product 3 entitlements) =====
-- strategic_plan_purchased_at: set when a company buys the Strategic
-- Workforce Plan engagement ($5-10k). Gates 'strategic_workforce_plan'
-- features in src/lib/entitlements.ts.
-- brain_hr_os_active: true while the Brain / HR OS retainer subscription is
-- live. Gates 'brain_hr_os' features.
alter table public.profiles
  add column if not exists strategic_plan_purchased_at timestamptz,
  add column if not exists brain_hr_os_active boolean not null default false;
-- ===== END product flags =====
