-- ============================================================================
-- blueprint_v4_05_hr_os.sql — Living HR OS (Enterprise tier)
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00..03.
--
-- The Living HR OS is the Enterprise differentiator. Three tables:
--
--   employee_hr_profiles      — comp / leave balance / visa per person (RBAC)
--   employee_attendance_ledger — every leave/sick/parental log (PDPL-aware)
--   hr_lifecycle_programs     — PIPs, separations, redeployments, onboarding
--
-- HRBP RBAC principle: the HR profile + attendance ledger + lifecycle program
-- rows are NOT visible to all company_members. They're scoped to:
--   1. The company owner (auth.uid() = company_id)
--   2. The assigned_hrbp_user_id on the row
--   3. The reporting_manager_user_id on the row
--
-- This is the "encrypted blocks restricted to assigned HRBP" floor referenced
-- in the HRBP layer brief. Full app-layer encryption can come later — for
-- now, RLS gates access at the row level.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- employee_hr_profiles — HR-private state per person.
-- ---------------------------------------------------------------------------
create table if not exists public.employee_hr_profiles (
  id                            uuid primary key default gen_random_uuid(),
  company_id                    uuid not null references auth.users(id) on delete cascade,
  person_id                     uuid not null references public.persons(id) on delete cascade,
  current_seat_id               uuid references public.roles_seats(id) on delete set null,
  -- Comp.
  base_salary_sar               numeric,
  base_salary_currency          text default 'SAR',
  accrued_performance_bonus_sar numeric default 0,
  last_comp_review_at           date,
  -- Leave balances (in days).
  annual_leave_balance_days     numeric default 0,
  sick_leave_taken_ytd_days     numeric default 0,
  parental_leave_balance_days   numeric default 0,
  -- Visa / immigration.
  nationality                   text,                          -- ISO-3166-1 alpha-2
  visa_type                     text,                          -- "work_permit" | "iqama" | "residency" | "citizen"
  visa_expires_at               date,
  -- Contract.
  contract_type                 text check (contract_type in (
    'full_time', 'part_time', 'contract', 'consultant', 'intern'
  )),
  start_date                    date,
  end_date                      date,
  -- RBAC anchors — who can see this row beyond the company owner.
  assigned_hrbp_user_id         uuid references auth.users(id) on delete set null,
  reporting_manager_user_id     uuid references auth.users(id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (company_id, person_id)
);

create index if not exists idx_hr_profiles_company on public.employee_hr_profiles (company_id);
create index if not exists idx_hr_profiles_person on public.employee_hr_profiles (person_id);
create index if not exists idx_hr_profiles_seat on public.employee_hr_profiles (current_seat_id);
create index if not exists idx_hr_profiles_visa_expiry on public.employee_hr_profiles (visa_expires_at)
  where visa_expires_at is not null;

drop trigger if exists hr_profiles_touch_updated_at on public.employee_hr_profiles;
create trigger hr_profiles_touch_updated_at
  before update on public.employee_hr_profiles
  for each row execute procedure public.touch_updated_at();

alter table public.employee_hr_profiles enable row level security;

-- HRBP / manager / owner only — NOT general company_members. This is the
-- "encrypted blocks restricted exclusively to HRBP + direct reporting
-- manager" pattern from the HRBP brief.
drop policy if exists "hr_profiles: hrbp+manager+owner read" on public.employee_hr_profiles;
create policy "hr_profiles: hrbp+manager+owner read"
  on public.employee_hr_profiles for select
  using (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
    or auth.uid() = reporting_manager_user_id
  );

drop policy if exists "hr_profiles: hrbp+owner write" on public.employee_hr_profiles;
create policy "hr_profiles: hrbp+owner write"
  on public.employee_hr_profiles for all
  using (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
  )
  with check (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
  );

-- ---------------------------------------------------------------------------
-- employee_attendance_ledger — every leave/sick/etc entry, PDPL-aware.
-- ---------------------------------------------------------------------------
create table if not exists public.employee_attendance_ledger (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references auth.users(id) on delete cascade,
  person_id       uuid not null references public.persons(id) on delete cascade,
  entry_type      text not null check (entry_type in (
    'annual_leave', 'sick_leave', 'parental_leave',
    'bereavement', 'personal', 'unpaid', 'public_holiday'
  )),
  start_date      date not null,
  end_date        date not null,
  days            numeric not null check (days >= 0),
  notes           text,
  -- PDPL/GDPR floor: medical entries (sick_leave) require explicit consent
  -- to be logged at this level of detail. WhatsApp sick-day handler stamps
  -- this true; UI dashboard logging defaults to false (notes-only).
  medical_consent_logged boolean not null default false,
  logged_via      text not null default 'dashboard'
    check (logged_via in ('dashboard', 'whatsapp', 'email', 'api')),
  approved_at     timestamptz,
  approved_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_attendance_company on public.employee_attendance_ledger (company_id);
create index if not exists idx_attendance_person on public.employee_attendance_ledger (person_id);
create index if not exists idx_attendance_dates on public.employee_attendance_ledger (start_date, end_date);

drop trigger if exists attendance_touch_updated_at on public.employee_attendance_ledger;
create trigger attendance_touch_updated_at
  before update on public.employee_attendance_ledger
  for each row execute procedure public.touch_updated_at();

alter table public.employee_attendance_ledger enable row level security;

-- Owner + assigned HRBP + reporting manager (via hr_profile lookup) can read.
-- Medical-consent-logged rows are EXTRA gated — even reporting manager can't
-- see them unless they're also the assigned HRBP.
drop policy if exists "attendance: hrbp+manager+owner read" on public.employee_attendance_ledger;
create policy "attendance: hrbp+manager+owner read"
  on public.employee_attendance_ledger for select
  using (
    auth.uid() = company_id
    or exists (
      select 1 from public.employee_hr_profiles hp
      where hp.company_id = employee_attendance_ledger.company_id
        and hp.person_id = employee_attendance_ledger.person_id
        and (
          auth.uid() = hp.assigned_hrbp_user_id
          or (auth.uid() = hp.reporting_manager_user_id
              and not employee_attendance_ledger.medical_consent_logged)
        )
    )
  );

drop policy if exists "attendance: owner+hrbp write" on public.employee_attendance_ledger;
create policy "attendance: owner+hrbp write"
  on public.employee_attendance_ledger for all
  using (
    auth.uid() = company_id
    or exists (
      select 1 from public.employee_hr_profiles hp
      where hp.company_id = employee_attendance_ledger.company_id
        and hp.person_id = employee_attendance_ledger.person_id
        and auth.uid() = hp.assigned_hrbp_user_id
    )
  )
  with check (
    auth.uid() = company_id
    or exists (
      select 1 from public.employee_hr_profiles hp
      where hp.company_id = employee_attendance_ledger.company_id
        and hp.person_id = employee_attendance_ledger.person_id
        and auth.uid() = hp.assigned_hrbp_user_id
    )
  );

-- ---------------------------------------------------------------------------
-- hr_lifecycle_programs — PIPs, separations, redeployments, onboardings.
-- ---------------------------------------------------------------------------
create table if not exists public.hr_lifecycle_programs (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references auth.users(id) on delete cascade,
  person_id           uuid not null references public.persons(id) on delete cascade,
  -- The seat involved in the program. For redeployment, source_seat_id +
  -- target_seat_id let us track the move.
  source_seat_id      uuid references public.roles_seats(id) on delete set null,
  target_seat_id      uuid references public.roles_seats(id) on delete set null,
  program_type        text not null check (program_type in (
    'onboarding', 'pip', 'separation', 'redeploy', 'reskill', 'augment'
  )),
  status              text not null default 'open' check (status in (
    'open', 'in_progress', 'completed', 'abandoned', 'escalated'
  )),
  start_date          date not null default current_date,
  target_end_date     date,
  actual_end_date     date,
  -- 30/60/90 milestone blocks. Notes are gated by RLS — not encrypted at
  -- column level yet, but RBAC-restricted to assigned HRBP + reporting
  -- manager (NOT general company_members).
  milestones_30d      jsonb default '[]'::jsonb,
  milestones_60d      jsonb default '[]'::jsonb,
  milestones_90d      jsonb default '[]'::jsonb,
  private_notes       text,
  -- Country-specific legal template reference. App layer maps country →
  -- vetted template; we do NOT auto-generate legal text in PIP rows.
  legal_template_ref  text,                                  -- "UAE-MOL-PIP-v3" | "KSA-NITAQAT-EXIT-v2"
  -- RBAC anchors.
  assigned_hrbp_user_id     uuid references auth.users(id) on delete set null,
  reporting_manager_user_id uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_lifecycle_company on public.hr_lifecycle_programs (company_id);
create index if not exists idx_lifecycle_person on public.hr_lifecycle_programs (person_id);
create index if not exists idx_lifecycle_type_status on public.hr_lifecycle_programs (company_id, program_type, status);

drop trigger if exists lifecycle_touch_updated_at on public.hr_lifecycle_programs;
create trigger lifecycle_touch_updated_at
  before update on public.hr_lifecycle_programs
  for each row execute procedure public.touch_updated_at();

alter table public.hr_lifecycle_programs enable row level security;

drop policy if exists "lifecycle: hrbp+manager+owner read" on public.hr_lifecycle_programs;
create policy "lifecycle: hrbp+manager+owner read"
  on public.hr_lifecycle_programs for select
  using (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
    or auth.uid() = reporting_manager_user_id
  );

drop policy if exists "lifecycle: hrbp+owner write" on public.hr_lifecycle_programs;
create policy "lifecycle: hrbp+owner write"
  on public.hr_lifecycle_programs for all
  using (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
  )
  with check (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
  );
