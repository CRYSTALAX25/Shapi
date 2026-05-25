-- Train-to-Hire / Pivot-friendly roles.
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor (clear it first).

-- Roles: true when the employer is open to career-changers and will train on the job.
alter table public.roles
  add column if not exists accepts_pivot_candidates boolean not null default false;
