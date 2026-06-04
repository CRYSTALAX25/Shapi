-- ============================================================================
-- blueprint_v4_02_locations_teams.sql — locations + teams + free-tier gate
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00 + _01.
--
-- This is where the v4 hard gate lives. Free tier = ONE location. A DB trigger
-- (not app-level logic) blocks the INSERT of a 2nd location. That keeps the
-- gate enforceable even if a future bug bypasses the app check, AND surfaces
-- a consistent SQLSTATE the API layer can catch + map to a FeatureGate
-- overlay → drives upgrade conversion.
--
-- Teams form a self-referencing tree per company. Each team lives in a
-- location (a team can't span locations — if it does, that's two teams that
-- collaborate). This matches the org-chart visual builder (Prompt 05).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- locations — physical/legal entity per company. Free tier capped at 1.
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null,                              -- "Riyadh HQ"
  country     text not null,                              -- ISO-3166-1 alpha-2: "SA", "AE", "IN"
  city        text,
  timezone    text,                                       -- "Asia/Riyadh"
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_locations_company on public.locations (company_id);
create unique index if not exists uq_locations_one_primary_per_company
  on public.locations (company_id) where is_primary = true;

drop trigger if exists locations_touch_updated_at on public.locations;
create trigger locations_touch_updated_at
  before update on public.locations
  for each row execute procedure public.touch_updated_at();

alter table public.locations enable row level security;
drop policy if exists "locations: company member read" on public.locations;
create policy "locations: company member read"
  on public.locations for select
  using (public.is_company_member(company_id));
drop policy if exists "locations: company owner write" on public.locations;
create policy "locations: company owner write"
  on public.locations for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- ---------------------------------------------------------------------------
-- THE FREE-TIER HARD GATE — enforced in DB so a UI bug can't bypass it.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_free_tier_location_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_tier text;
  v_count     int;
begin
  select plan_tier into v_plan_tier from public.profiles where id = new.company_id;
  if v_plan_tier is null or v_plan_tier = 'free' then
    select count(*) into v_count from public.locations where company_id = new.company_id;
    if v_count >= 1 then
      raise exception 'free_tier_location_limit_exceeded'
        using
          errcode = 'P0001',
          hint    = 'Free tier supports a single location. Upgrade to Pro to add more.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_tier_location_limit on public.locations;
create trigger enforce_free_tier_location_limit
  before insert on public.locations
  for each row execute procedure public.enforce_free_tier_location_limit();

-- ---------------------------------------------------------------------------
-- teams — self-referencing tree per company. parent_team_id NULL = root.
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references auth.users(id) on delete cascade,
  location_id     uuid not null references public.locations(id) on delete restrict,
  parent_team_id  uuid references public.teams(id) on delete set null,
  name            text not null,                          -- "Engineering"
  function        text,                                   -- "engineering" | "sales" | "ops" | "finance" | "people" | "marketing" | "other"
  description     text,
  -- Activity Catalogue Sliders (brand vocab) — sized at the team level for
  -- now; can drill to individual seats once the catalogue UI ships.
  total_fte       numeric default 0,                      -- sum of all seats' FTE
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_teams_company on public.teams (company_id);
create index if not exists idx_teams_location on public.teams (location_id);
create index if not exists idx_teams_parent on public.teams (parent_team_id);

drop trigger if exists teams_touch_updated_at on public.teams;
create trigger teams_touch_updated_at
  before update on public.teams
  for each row execute procedure public.touch_updated_at();

alter table public.teams enable row level security;
drop policy if exists "teams: company member read" on public.teams;
create policy "teams: company member read"
  on public.teams for select
  using (public.is_company_member(company_id));
drop policy if exists "teams: company owner write" on public.teams;
create policy "teams: company owner write"
  on public.teams for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);
