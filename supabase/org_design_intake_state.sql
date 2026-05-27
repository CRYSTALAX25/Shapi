-- ============================================================================
-- org_design_intake_state.sql — WhatsApp voice-driven Org Design intake (§16)
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- The hiring manager texts "design my org via voice" → the WhatsApp webhook
-- walks them through 3 sequential voice-note questions:
--   1. current team composition (roles + headcount)
--   2. strategy (1–2 year direction)
--   3. AI integration plans
--
-- This column stores the in-flight state so the webhook knows which question
-- we're on AND retains the prior answers' transcripts until we've got all 3.
--
-- Shape:
--   {
--     "step": 1 | 2 | 3,
--     "current_team_text"?: "...",   -- saved after step 1
--     "strategy_text"?: "...",        -- saved after step 2
--     "ai_plan_text"?: "...",         -- saved after step 3 (then state cleared)
--     "started_at"?: "2026-05-27T..."
--   }
--
-- Distinct from `awaiting_voice_sample_lang` which drives the per-language
-- voice-sample capture for CANDIDATE profiles. This column is exclusive to
-- company-type profiles and gets cleared once the 3-step intake completes
-- (or the user types "cancel"). NULL = not currently in an org-design intake.
-- ============================================================================

alter table public.profiles
  add column if not exists org_design_voice_state jsonb;

-- ============================================================================
-- org_design_intake_tokens — magic link that opens the org-design page with
-- the captured intake data pre-filled. Mirrors role_share_tokens. Tokens are
-- URL-safe random strings (~32 chars) and expire after 14 days.
-- ============================================================================

create table if not exists public.org_design_intake_tokens (
  token text primary key,
  company_id uuid not null references auth.users(id) on delete cascade,
  current_team_text text not null,
  strategy_text text not null,
  ai_plan_text text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists org_design_intake_tokens_company_idx
  on public.org_design_intake_tokens (company_id);

-- No RLS — service-role only. Service-role bypasses RLS regardless.
