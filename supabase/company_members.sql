-- ============================================================================
-- company_members.sql — team-invite storage for company accounts
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- /api/company/invite upserts into this table when a hiring manager invites
-- a colleague via the "Team access" panel on /company/dashboard. The invite
-- email goes via Resend with a tokenless signup link
-- (/signup?company_invite=<company_id>&email=<email>). On accept,
-- /api/company/invite/accept stamps accepted_at + accepted_user_id.
--
-- ROOT CAUSE of the "add team member fail" bug: the table simply didn't
-- exist. The upsert with onConflict: 'company_id,email' was failing with a
-- "relation does not exist" error, surfaced as a 500 in the UI.
-- ============================================================================

create table if not exists public.company_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references auth.users(id) on delete cascade,
  email         text not null,
  invited_by    uuid references auth.users(id) on delete set null,
  accepted_at   timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (company_id, email)
);

create index if not exists idx_company_members_company on public.company_members (company_id);
create index if not exists idx_company_members_email on public.company_members (email);

-- RLS: companies can read + manage their own member rows. The /api/company/*
-- routes already use the admin (service-role) client so RLS doesn't gate
-- writes; this policy mainly lets server-side server-client reads work for
-- the company owner.
alter table public.company_members enable row level security;

drop policy if exists "Companies can view their members" on public.company_members;
create policy "Companies can view their members"
  on public.company_members for select
  using (auth.uid() = company_id);

drop policy if exists "Companies can manage their members" on public.company_members;
create policy "Companies can manage their members"
  on public.company_members for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);
