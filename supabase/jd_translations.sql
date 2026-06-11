-- ============================================================================
-- jd_translations.sql — multilingual job descriptions on roles
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- Companies with offices across countries publish the same role in multiple
-- languages. Translations are produced by /api/company/jd-translate (Claude),
-- reviewed/edited by the company on /company/roles/new, and stored alongside
-- the role as jsonb keyed by locale code:
--
--   roles.translations = {
--     "ar": { "title": "...", "description": "...", "requirements": "..." },
--     "hi": { ... },
--     ...
--   }
--
-- Locale codes match src/lib/i18n/locales.ts (ar, hi, ur, tl, bn, es, fr, hr).
-- The API degrades gracefully if this column doesn't exist yet (saves the
-- role without translations and tells the caller), so running this is safe
-- before OR after deploying the code.
-- ============================================================================

alter table public.roles
  add column if not exists translations jsonb default '{}'::jsonb;

comment on column public.roles.translations is
  'JD translations keyed by locale code: { "ar": { title, description, requirements }, ... }. Written by /api/company/jd-translate flow.';
