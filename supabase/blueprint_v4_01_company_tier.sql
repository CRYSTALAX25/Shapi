-- ============================================================================
-- blueprint_v4_01_company_tier.sql — Extend profiles with v4 tier state
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor.
--
-- The blueprint v4 packaging model uses ONE plan with three cumulative tiers
-- (free / pro / enterprise) plus a 14-day Pro trial. Rather than introducing
-- a separate `companies` table that duplicates the company-level fields
-- already on profiles (company_name, company_size, etc.), we extend profiles
-- with the v4 tier state. The FeatureGate cumulative check becomes:
--
--     profiles.plan_tier >= required_tier
--
-- Locked numbers (see memory project-pricing-locked-v4):
--   • Free: single-location org chart + 1 upload-and-map. No export.
--   • Pro $499/mo: multi-location + Talent Match + Active Hiring.
--   • Enterprise $2,500-5,000/mo: Strategic Planner + HR OS + Company Brain.
--   • Bespoke $15-25k: bespoke_config jsonb, sold INSIDE Enterprise.
-- ============================================================================

alter table public.profiles
  add column if not exists plan_tier text default 'free'
    check (plan_tier in ('free', 'pro', 'enterprise')),
  -- 14-day Pro trial: when not null + in the future, gates render Pro features.
  -- Stripe webhook stamps this on checkout.session.completed with
  -- subscription.status = 'trialing'.
  add column if not exists trial_ends_at timestamptz,
  -- Bespoke Transformation ($15-25k) config: severance multipliers, custom
  -- overhead %, taxonomy overrides. Populated only when the per-engagement
  -- Bespoke product is purchased on top of an active Enterprise subscription.
  add column if not exists bespoke_config jsonb default '{}'::jsonb,
  -- Free tier hard gate: caps Anthropic spend at ~$0.50/free user. Increment
  -- on every /api/company/upload-and-map run; if >= 1 AND plan_tier = 'free',
  -- the endpoint returns 402 + FeatureGate overlay drives upgrade.
  add column if not exists upload_and_map_count int default 0,
  -- Subscription lifecycle from Stripe (extends existing subscription_status).
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_canceled_at timestamptz;

-- The existing subscription_status check constraint only allowed
-- inactive/active/cancelled/past_due. Pro trial needs 'trialing'. Drop +
-- re-add the constraint with the expanded set.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_subscription_status_check'
  ) then
    alter table public.profiles drop constraint profiles_subscription_status_check;
  end if;
end$$;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in (
    'inactive', 'trialing', 'active', 'cancelled', 'past_due', 'grace_expired'
  ));

-- Index for FeatureGate lookups + Stripe webhook handler trial-expiry sweeps.
create index if not exists idx_profiles_plan_tier on public.profiles (plan_tier);
create index if not exists idx_profiles_trial_ends_at on public.profiles (trial_ends_at)
  where trial_ends_at is not null;
