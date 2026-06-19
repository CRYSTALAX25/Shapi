-- ─────────────────────────────────────────────────────────────────────────────
-- roles — company job postings (the live "open roles" candidates browse and the
-- matching engine scores against). Distinct from roles_seats (the org-chart spine).
--
-- This table existed live but had no migration — reconstructed from the actual
-- column set (2026-06-18 introspection) + how the code reads/writes it. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  title text not null,
  department text,
  location text,
  remote boolean not null default false,

  -- Compensation
  salary_min integer,
  salary_max integer,
  salary_currency text default 'USD',
  salary_visible boolean not null default true,

  -- Free-text role detail
  description text,
  requirements text,
  what_success_looks_like text,
  team_context text,
  hiring_notes text,

  -- Skills + matching inputs
  must_have_skills text[] default '{}',
  nice_to_have_skills text[] default '{}',
  years_experience_min integer,
  skill_quadrant jsonb,

  -- Engagement + targeting
  employment_type text default 'full_time',
  engagement_type text default 'permanent',
  accepts_pivot_candidates boolean not null default false,
  visa_sponsored boolean,

  -- i18n cache of the JD (jd_translations.sql ALTERs this in)
  translations jsonb default '{}'::jsonb,

  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'closed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roles_company_idx on public.roles (company_id, status);
create index if not exists roles_status_idx  on public.roles (status);

alter table public.roles enable row level security;

-- Anyone authenticated can read ACTIVE roles (the public board); the owning
-- company manages its own rows. (Admin/service-role bypasses RLS for matching.)
drop policy if exists roles_read_active on public.roles;
create policy roles_read_active on public.roles
  for select using (status = 'active' or company_id = auth.uid());

drop policy if exists roles_company_write on public.roles;
create policy roles_company_write on public.roles
  for all using (company_id = auth.uid()) with check (company_id = auth.uid());
