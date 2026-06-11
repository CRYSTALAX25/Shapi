-- ============================================================================
-- verified_org.sql — VERIFIED ORG: point the verification engine at the spine
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00 + _02
-- + _03 (is_company_member helper, teams, persons, roles_seats).
--
-- The keystone: every seat in roles_seats carries a trust tier exactly like a
-- candidate claim —
--   • self_reported  (default, grey)  — the company typed it in / uploaded CSV
--   • shapi_assessed (amber)          — signal received but contested/partial
--   • verified       (cyan)           — the employee confirmed their own seat
--                                       via magic link (WhatsApp / email / link)
--
-- Employees confirm via /confirm-seat/<token> — no login required. Tokens are
-- minted by /api/company/spine/verify (service path), expire after 14 days,
-- and the public confirm endpoint uses the service role server-side after
-- token lookup (same pattern as /reference/[token]).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. roles_seats — trust tier columns
-- ---------------------------------------------------------------------------
alter table public.roles_seats
  add column if not exists verification_status text not null default 'self_reported';

do $$ begin
  alter table public.roles_seats
    add constraint roles_seats_verification_status_check
    check (verification_status in ('self_reported', 'shapi_assessed', 'verified'));
exception
  when duplicate_object then null;
end $$;

alter table public.roles_seats
  add column if not exists verified_at timestamptz;

alter table public.roles_seats
  add column if not exists verified_via text;

do $$ begin
  alter table public.roles_seats
    add constraint roles_seats_verified_via_check
    check (verified_via is null or verified_via in ('whatsapp', 'email', 'link'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_roles_seats_verification
  on public.roles_seats (company_id, verification_status);

-- ---------------------------------------------------------------------------
-- 2. seat_confirmation_tokens — one magic link per (seat, person) send
-- ---------------------------------------------------------------------------
-- Re-sends expire the previous pending token and mint a fresh one (handled in
-- the API). A token row outlives the response so disputes keep their evidence
-- in `response` jsonb.
create table if not exists public.seat_confirmation_tokens (
  id           uuid primary key default gen_random_uuid(),
  token        text unique not null default replace(gen_random_uuid()::text, '-', ''),
  company_id   uuid not null references auth.users(id) on delete cascade,
  person_id    uuid references public.persons(id) on delete cascade,
  seat_id      uuid references public.roles_seats(id) on delete cascade,
  status       text not null default 'pending'
    check (status in ('pending', 'confirmed', 'disputed', 'expired')),
  -- Channel(s) the link actually went out on: 'whatsapp' | 'email' |
  -- 'whatsapp+email' | 'link' (copyable link only — Twilio trial fallback).
  sent_via     text,
  -- Dispute payload: { correct_title, correct_team, correct_manager, note }
  response     jsonb,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  responded_at timestamptz
);

create index if not exists idx_seat_confirmation_tokens_token
  on public.seat_confirmation_tokens (token);
create index if not exists idx_seat_confirmation_tokens_company
  on public.seat_confirmation_tokens (company_id);
create index if not exists idx_seat_confirmation_tokens_seat
  on public.seat_confirmation_tokens (seat_id, status);

alter table public.seat_confirmation_tokens enable row level security;

-- Company members can SEE their own company's tokens (status panel on the
-- canvas). They can NOT insert/update via the client — minting goes through
-- the service-role API, and the public confirm endpoint also runs service-role
-- server-side after token lookup. No insert/update/delete policies on purpose.
drop policy if exists "seat_confirmation_tokens: company member read" on public.seat_confirmation_tokens;
create policy "seat_confirmation_tokens: company member read"
  on public.seat_confirmation_tokens for select
  using (public.is_company_member(company_id));
