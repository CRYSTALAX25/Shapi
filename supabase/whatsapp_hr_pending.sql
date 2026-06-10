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
