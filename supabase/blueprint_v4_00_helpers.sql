-- ============================================================================
-- blueprint_v4_00_helpers.sql — Extensions + RLS helper functions
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Run FIRST before any other
-- blueprint_v4_* migration.
--
-- What this does:
--   1. Enables pgvector for brain_entries.embedding (Company Brain semantic search)
--   2. Enables pgcrypto for future column-level encryption on HR-private data
--   3. Defines is_company_member(company_id) — used in every RLS policy across
--      the blueprint v4 schema so the company owner AND invited team members
--      (via company_members) can access tenant data, but nobody else can.
--
-- Why this matters:
--   The blueprint v4 schema is heavily multi-tenant. Without the helper, every
--   policy would have to repeat the company_id = auth.uid() OR EXISTS (SELECT
--   FROM company_members ...) pattern. One helper, all tables consistent.
-- ============================================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- is_company_member(company_id uuid) — true if auth.uid() is the company
-- owner OR an accepted member of company_members. Used in every blueprint_v4
-- RLS policy. SECURITY DEFINER so it can read company_members without
-- triggering its own RLS recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if v_uid = p_company_id then return true; end if;
  return exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and accepted_user_id = v_uid
      and accepted_at is not null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- touch_updated_at() — generic trigger function for updated_at columns.
-- Defined once here, re-used by every blueprint v4 table.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
