create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  location text,
  remote bool default false,
  salary_min int,
  salary_max int,
  salary_currency text default 'USD',
  description text,
  requirements text[],
  -- what kind of candidate
  ai_tier_required text check (ai_tier_required in ('user', 'integrator', 'builder', 'any')),
  -- status
  status text default 'draft' check (status in ('draft', 'live', 'closed')),
  -- visa sponsorship
  visa_sponsorship bool default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table jobs enable row level security;

-- Companies can manage their own jobs
create policy "Companies can manage own jobs" on jobs
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- Candidates can view live jobs
create policy "Anyone can view live jobs" on jobs
  for select using (status = 'live');

create trigger jobs_updated_at
  before update on jobs
  for each row execute procedure update_updated_at();
