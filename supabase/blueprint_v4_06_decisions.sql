-- ============================================================================
-- blueprint_v4_06_decisions.sql — organizational_decisions (IMMUTABLE audit)
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00..03.
--
-- Every restructuring action — hire, separate, redeploy, promote, reorg —
-- writes an immutable row here with a mandatory free-text justification.
-- This is the legally defensible audit trail for:
--   • UAE wrongful-termination disputes (12-24mo severance risk)
--   • KSA Nitaqat reorganization filings
--   • PDPL data-subject-access requests
--   • Investor due diligence on restructuring conducted
--
-- IMMUTABILITY: no UPDATE or DELETE policy. Inserts only. Even the company
-- owner cannot edit the justification post-hoc. A correction = a new row
-- referencing the previous one via corrects_decision_id.
-- ============================================================================

create table if not exists public.organizational_decisions (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references auth.users(id) on delete cascade,
  decision_type         text not null check (decision_type in (
    'hire', 'separate', 'restructure', 'redeploy', 'promote',
    'demote', 'reskill_assign', 'augment_assign', 'comp_change',
    'team_split', 'team_merge', 'location_change'
  )),
  -- MANDATORY free-text justification. Enforce via NOT NULL + min length
  -- check. The HRBP brief Section 13 specifies this as the immutable
  -- advisory routing — a non-empty manager justification is the legal floor.
  justification         text not null check (length(justification) >= 20),
  -- Who made the decision. NOT NULL: every decision has a human owner.
  decided_by_user_id    uuid not null references auth.users(id) on delete restrict,
  -- What this decision affects. Either or both can be set.
  impacted_seat_id      uuid references public.roles_seats(id) on delete set null,
  impacted_person_id    uuid references public.persons(id) on delete set null,
  impacted_team_id      uuid references public.teams(id) on delete set null,
  -- For corrections: a new row pointing to the previous decision being
  -- amended. The original row is never modified.
  corrects_decision_id  uuid references public.organizational_decisions(id) on delete restrict,
  -- Snapshot of the before/after state at decision time. JSONB so the audit
  -- captures the actual values that existed when the decision was made,
  -- independent of later state changes.
  state_snapshot        jsonb not null default '{}'::jsonb,
  decided_at            timestamptz not null default now()
);

create index if not exists idx_decisions_company on public.organizational_decisions (company_id);
create index if not exists idx_decisions_seat on public.organizational_decisions (impacted_seat_id)
  where impacted_seat_id is not null;
create index if not exists idx_decisions_person on public.organizational_decisions (impacted_person_id)
  where impacted_person_id is not null;
create index if not exists idx_decisions_type_date on public.organizational_decisions (company_id, decision_type, decided_at desc);

alter table public.organizational_decisions enable row level security;

-- Read: company member can see the audit log. This is intentional —
-- transparency is the point of an audit trail. If a particular decision row
-- contains sensitive comp data in state_snapshot, that's an app-layer
-- problem (don't snapshot it) not an RLS problem.
drop policy if exists "decisions: company member read" on public.organizational_decisions;
create policy "decisions: company member read"
  on public.organizational_decisions for select
  using (public.is_company_member(company_id));

-- Insert: company owner + any authenticated company_member can record a
-- decision they made.
drop policy if exists "decisions: company member insert" on public.organizational_decisions;
create policy "decisions: company member insert"
  on public.organizational_decisions for insert
  with check (
    public.is_company_member(company_id)
    and decided_by_user_id = auth.uid()
  );

-- IMMUTABLE: no UPDATE or DELETE policies. Postgres denies by default when
-- RLS is enabled with no matching policy. Corrections require inserting a
-- new row with corrects_decision_id set.
