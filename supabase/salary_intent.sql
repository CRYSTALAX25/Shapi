-- Candidate intent status + salary expectations (per-track).
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor (clear it first).

-- Job-search intent: 'actively_looking' | 'open' (passive, open to offers) | 'not_looking'
alter table public.profiles
  add column if not exists job_search_status text;

-- Salary expectations. Private by default (matching / matched companies only).
-- Shape:
-- {
--   "currency": "AED", "period": "month",
--   "includes_allowances": true, "flexible": true,
--   "primary": { "track": "Operations", "min": 25000, "max": 35000 },
--   "pivots": [ { "track": "UX Design", "min": 12000, "max": 18000, "note": "upskilling" } ]
-- }
alter table public.profiles
  add column if not exists salary_expectations jsonb;
