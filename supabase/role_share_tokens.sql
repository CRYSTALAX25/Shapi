-- ============================================================================
-- role_share_tokens.sql — one-tap mobile review/publish links for draft roles
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- The Hiring Roadmap can WhatsApp a hiring manager a draft JD + a tokenised
-- one-tap link to /r/[token] — no login required. The token grants ONLY:
--   • read the role
--   • edit title/description/requirements/salary
--   • publish (status: draft -> active)
-- It does NOT grant any other access. Tokens expire (default 14 days) and
-- can be revoked by clearing the row.
--
-- Tokens are stored cleartext (they're cryptographically random URL-safe
-- strings). RLS isn't required because the lookup happens via service-role
-- from the public /r/[token] route; the route validates the token + expiry
-- before letting the user touch the role.
-- ============================================================================

create table if not exists public.role_share_tokens (
  token text primary key,             -- URL-safe random, ~32 chars
  role_id uuid not null references public.roles(id) on delete cascade,
  company_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,                -- when the link was first opened (telemetry only)
  created_at timestamptz not null default now()
);

create index if not exists role_share_tokens_role_idx
  on public.role_share_tokens (role_id);
create index if not exists role_share_tokens_company_idx
  on public.role_share_tokens (company_id);

-- No RLS — service-role only. Service-role bypasses RLS regardless.
