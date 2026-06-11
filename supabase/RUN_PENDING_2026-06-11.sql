-- ============================================================
-- Shapi — PENDING MIGRATIONS (2026-06-11). Paste once, top→bottom.
-- All idempotent — safe to re-run even if one was already applied.
-- 1. whatsapp_hr_pending — 2-step WhatsApp bonus confirmation
-- 2. founding_partner   — real Founding Partner cohort cap (15)
-- 3. verified_org       — seat trust tiers + confirmation tokens
-- ============================================================

-- ===== BEGIN whatsapp_hr_pending.sql =====
-- ============================================================================
-- whatsapp_hr_pending.sql — 2-step confirmation state for WhatsApp HR intents
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor. Requires blueprint_v4_00
-- (touch_updated_at) + _03 (persons) + _05 (employee_hr_profiles).
--
-- Why this exists:
--   Manager-driven bonus approval over WhatsApp is a TWO-step flow so it can't
--   fire on a single fat-finger:
--     1. Manager texts "approve bonus for [name] [amount]"
--        → we resolve the target person + parse the amount, then stash the
--          pending action here and reply with a confirmation card.
--     2. Manager replies "YES"
--        → we look up the most-recent un-consumed pending row for THIS
--          approver phone, apply the bonus to employee_hr_profiles, and mark
--          the row consumed.
--
--   State is keyed by approver_phone (the WhatsApp sender) because the
--   approving manager may not be a Shapi auth user — they're resolved via
--   persons.whatsapp_number / the company owner's profiles.whatsapp_number.
--
-- Lifecycle: rows are short-lived. A pending row older than ~10 minutes is
-- ignored by the handler (treated as expired) so a stale "YES" can't fire a
-- bonus the manager forgot about. consumed_at stamps a terminal row.
--
-- Service-role only (the webhook runs unauthenticated). No RLS policies —
-- service-role bypasses RLS. We still enable RLS so a leaked anon key can't
-- read pending bonus amounts.
-- ============================================================================

create table if not exists public.whatsapp_hr_pending (
  id              uuid primary key default gen_random_uuid(),
  -- The action this row represents. Only 'bonus_approval' today; column kept
  -- generic so future 2-step HR intents (e.g. termination, comp change) reuse it.
  action          text not null default 'bonus_approval'
    check (action in ('bonus_approval')),
  -- Who is approving — the WhatsApp sender's normalised phone (E.164-ish,
  -- spaces/dashes stripped). NOT a foreign key: the manager may be the company
  -- owner (auth user) or a person without a Shapi login.
  approver_phone  text not null,
  -- The auth user id of the approver when we could resolve one (company owner
  -- or persons.linked_user_id). Used to stamp approved_by on downstream rows.
  approver_user_id uuid references auth.users(id) on delete set null,
  -- Tenant scope — every write below is scoped to this company_id.
  company_id      uuid not null references auth.users(id) on delete cascade,
  -- The target employee.
  person_id       uuid not null references public.persons(id) on delete cascade,
  person_name     text not null,
  -- Bonus amount + currency snapshot (so the confirmation card + the apply
  -- step agree even if anything else changes between the two messages).
  amount          numeric not null check (amount > 0),
  currency        text not null default 'SAR',
  consumed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_wa_hr_pending_phone
  on public.whatsapp_hr_pending (approver_phone, consumed_at, created_at desc);
create index if not exists idx_wa_hr_pending_company
  on public.whatsapp_hr_pending (company_id);

drop trigger if exists wa_hr_pending_touch_updated_at on public.whatsapp_hr_pending;
create trigger wa_hr_pending_touch_updated_at
  before update on public.whatsapp_hr_pending
  for each row execute procedure public.touch_updated_at();

alter table public.whatsapp_hr_pending enable row level security;
-- No policies on purpose — service-role only.
-- ===== END whatsapp_hr_pending.sql =====

-- ===== BEGIN founding_partner.sql =====
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
-- ===== END founding_partner.sql =====

-- ===== BEGIN verified_org.sql =====
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
-- ===== END verified_org.sql =====
