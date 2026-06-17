-- ─────────────────────────────────────────────────────────────────────────────
-- culture_references_v2 — expand company_culture_references to the locked
-- 9-dimension culture rubric + Shapi-driven sourcing (2026-06-17).
--
-- WHY: v1 had 3 ratings (paid_on_time / real_hours / manager_quality) and was
-- sourced by the COMPANY typing in employee emails (company-curated → breaks
-- independence). v2 adds the full rubric and the columns Shapi needs to source
-- employees ITSELF: past employees from our own candidate pool (work_history
-- match) and current employees via the seat-confirmation piggyback.
--
-- TRUST BOUNDARY UNCHANGED: still NO row-level SELECT policy. Companies never
-- read raw rows; the API (getCultureAggregate) returns averages only, and only
-- once trusted responses >= MIN_RESPONSES (= 3). This table is "Plane B" and is
-- firewalled from the company-queryable Brain (brain_sources/brain_entries).
--
-- Idempotent: safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

-- Who is answering — branches the question set (exit_handled is past-only).
alter table public.company_culture_references
  add column if not exists respondent_type text
    check (respondent_type is null or respondent_type in ('current', 'past'));

-- How Shapi sourced this respondent (analytics + dedupe; never shown to company).
alter table public.company_culture_references
  add column if not exists source text
    check (source is null or source in ('candidate_pool', 'seat_confirmation', 'manual'));

-- If sourced from our own candidate pool, link the candidate so we don't re-ask
-- the same person for the same company. Nullable for seat-confirmation sources.
alter table public.company_culture_references
  add column if not exists candidate_id uuid references auth.users(id) on delete set null;

-- The respondent acknowledged the anonymity terms before answering.
alter table public.company_culture_references
  add column if not exists consent_ack boolean not null default false;

-- ── The 6 new rated dimensions (1-5). paid_on_time / real_hours (= hours
-- respected) / manager_quality already exist from v1. ──
alter table public.company_culture_references
  add column if not exists promise_kept    int,  -- offer matched reality
  add column if not exists respect_safety  int,  -- respect + psychological safety
  add column if not exists growth          int,  -- growth & recognition
  add column if not exists fair_treatment  int,  -- fairness regardless of background
  add column if not exists would_recommend int,  -- headline summary metric
  add column if not exists exit_handled    int;  -- past employees only

-- ── The 2 open questions (anonymised themes, never scored, never shown verbatim
-- in a way that could identify a respondent). `notes` (v1) is retained. ──
alter table public.company_culture_references
  add column if not exists improve_culture text,  -- "What would most improve the culture here?"
  add column if not exists best_thing      text;  -- "What's the best thing about working here?"

-- Range guards for the new 1-5 ratings (named so re-runs don't duplicate).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promise_kept_range') then
    alter table public.company_culture_references add constraint promise_kept_range    check (promise_kept    is null or (promise_kept    between 1 and 5));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'respect_safety_range') then
    alter table public.company_culture_references add constraint respect_safety_range  check (respect_safety  is null or (respect_safety  between 1 and 5));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'growth_range') then
    alter table public.company_culture_references add constraint growth_range          check (growth          is null or (growth          between 1 and 5));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fair_treatment_range') then
    alter table public.company_culture_references add constraint fair_treatment_range  check (fair_treatment  is null or (fair_treatment  between 1 and 5));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'would_recommend_range') then
    alter table public.company_culture_references add constraint would_recommend_range check (would_recommend is null or (would_recommend between 1 and 5));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exit_handled_range') then
    alter table public.company_culture_references add constraint exit_handled_range    check (exit_handled    is null or (exit_handled    between 1 and 5));
  end if;
end $$;

-- Dedupe: at most one row per (company, sourced candidate). Partial unique index
-- so seat-confirmation rows (candidate_id null) are unaffected.
create unique index if not exists culture_refs_company_candidate_uidx
  on public.company_culture_references (company_id, candidate_id)
  where candidate_id is not null;
