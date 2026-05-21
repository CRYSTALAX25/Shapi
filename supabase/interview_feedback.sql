-- Two-sided post-interview feedback. One row per side per application.
-- Each side sees only its OWN feedback (RLS scoped by author); aggregates that
-- feed the company trust score / candidate reliability are computed server-side
-- with the service role. Idempotent. Paste into the Supabase SQL editor (clear it first).

create table if not exists public.interview_feedback (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  company_id uuid not null references auth.users(id) on delete cascade,
  author text not null,            -- 'company' | 'candidate'
  rating int,                      -- 1-5
  move_forward boolean,            -- would you continue?
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id, author)
);

create index if not exists ifeedback_company_idx on public.interview_feedback (company_id, role_id);
create index if not exists ifeedback_candidate_idx on public.interview_feedback (candidate_id);

alter table public.interview_feedback enable row level security;

-- Company sees/writes only its own (company-authored) feedback.
drop policy if exists "company own feedback" on public.interview_feedback;
create policy "company own feedback" on public.interview_feedback
  using (company_id = auth.uid() and author = 'company')
  with check (company_id = auth.uid() and author = 'company');

-- Candidate sees/writes only its own (candidate-authored) feedback.
drop policy if exists "candidate own feedback" on public.interview_feedback;
create policy "candidate own feedback" on public.interview_feedback
  using (candidate_id = auth.uid() and author = 'candidate')
  with check (candidate_id = auth.uid() and author = 'candidate');

create or replace function set_ifeedback_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists ifeedback_updated_at on public.interview_feedback;
create trigger ifeedback_updated_at before update on public.interview_feedback
  for each row execute procedure set_ifeedback_updated_at();
