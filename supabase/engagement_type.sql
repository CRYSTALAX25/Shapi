-- Engagement type (light temp/contract support).
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor (clear it first).

-- Roles: permanent (default) | contract | temp
alter table public.roles
  add column if not exists engagement_type text default 'permanent';

-- Candidates: which engagement types they're open to, e.g. ['permanent','contract']
alter table public.profiles
  add column if not exists open_to_engagement text[];
