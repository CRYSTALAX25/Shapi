-- ============================================================================
-- profiles — add all columns the app code reads/writes that aren't in v1-v3
-- ============================================================================
-- Idempotent. Safe to run multiple times.
--
-- Why this exists: the app code accumulated columns over many features but
-- only profiles.sql / profiles_v2.sql / profiles_v3.sql were committed. The
-- rest were added ad-hoc in Supabase. This consolidates everything so any
-- environment (new dev DB, fresh Supabase project, etc.) lines up with code.
--
-- After running this, the cv-ready page will stop erroring on languages_spoken.
-- ============================================================================

alter table profiles
  -- CV parse output
  add column if not exists nationality text,
  add column if not exists country_of_origin text,
  add column if not exists native_language text,
  add column if not exists languages_spoken jsonb default '[]'::jsonb,
  add column if not exists matched_industries text[] default '{}',
  add column if not exists industry text,

  -- CV product state
  add column if not exists cv_kit_purchased bool default false,
  add column if not exists cv_tier text check (cv_tier in ('kit','pro')),
  add column if not exists cv_cache jsonb default '{}'::jsonb,

  -- WhatsApp interview state
  add column if not exists whatsapp_chat jsonb default '[]'::jsonb,
  add column if not exists whatsapp_language text,
  add column if not exists awaiting_cv_language text check (awaiting_cv_language in ('choice','custom')),
  add column if not exists cv_language_preference text,
  add column if not exists industry_chats jsonb default '{}'::jsonb,

  -- Language proficiency assessment (set by webhook at end of interview)
  add column if not exists english_level text check (english_level in ('A1','A2','B1','B2','C1','C2','unassessed')),
  add column if not exists language_proficiency jsonb,

  -- Profile links (used on public profile page)
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists website_url text,
  add column if not exists portfolio_url text;

-- Helpful indexes for the webhook's whatsapp_number lookup (already common
-- query path), and cv_kit_purchased filtering on admin views
create index if not exists idx_profiles_whatsapp_number
  on profiles (whatsapp_number) where whatsapp_number is not null;
create index if not exists idx_profiles_cv_kit_purchased
  on profiles (cv_kit_purchased) where cv_kit_purchased = true;
create index if not exists idx_profiles_cv_tier
  on profiles (cv_tier) where cv_tier is not null;
