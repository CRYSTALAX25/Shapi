-- ============================================================================
-- subscription_product.sql — distinct add-on products beyond CV Kit / Pro
-- ============================================================================
-- Idempotent.
--
-- Splits the previously-generic 'paid' / 'subscription_tier' flags into a
-- clear `subscription_product` enum so we can:
--   - Charge differently for Open Roles Board vs Shapi Active vs Concierge
--   - Gate features per product
--   - Stack products (a candidate can have Pro + Open Roles + Active)
--
-- A candidate's full entitlement is the union of:
--   cv_tier ('kit' | 'pro') — one-time CV purchase tier
--   subscription_product[] — array of active recurring subscriptions
--
-- Pricing reference (matches SHAPI.md section 3):
--   roles_board_monthly  $19/mo    roles_board_yearly  $149/yr
--   active_monthly       $29/mo    active_yearly       $249/yr
--   concierge_monthly    $79/mo
--   bundle_monthly       $39/mo    bundle_yearly       $349/yr
-- ============================================================================

alter table profiles
  -- Array of currently-active subscription products. Updated by Stripe webhook
  -- on checkout.session.completed + customer.subscription.updated/deleted.
  -- Example: ['roles_board_monthly', 'active_monthly']
  add column if not exists subscription_product text[] default '{}',

  -- Per-product Stripe IDs so we can manage each subscription independently
  -- (cancel one without cancelling the others).
  add column if not exists roles_board_subscription_id text,
  add column if not exists active_subscription_id text,
  add column if not exists concierge_subscription_id text,
  add column if not exists bundle_subscription_id text;

-- Index so company filters like "show me candidates with Open Roles Board"
-- are fast.
create index if not exists idx_profiles_subscription_product
  on profiles using gin (subscription_product);
