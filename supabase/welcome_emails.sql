-- Welcome nurture sequence tracking.
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor (clear it first).

-- Tracks how far through the 3-part welcome sequence each candidate is:
--   0 = none sent yet
--   1 = welcome email sent
--   2 = career pivot map email sent
--   3 = social proof email sent (sequence complete)
alter table public.profiles
  add column if not exists welcome_stage integer not null default 0;
