-- "Looking for" — the roles and industries a candidate wants to be contacted for.
-- Drives matching and tells companies the candidate's intent. Idempotent.
-- Paste into the Supabase SQL editor (clear it first).

alter table public.profiles
  add column if not exists target_roles text[];

-- Industries from SUPPORTED_INDUSTRIES (finance, tech, creative, healthcare, legal,
-- marketing, operations, hospitality, education, sales).
alter table public.profiles
  add column if not exists target_industries text[];
