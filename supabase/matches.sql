-- Matches table: scores candidate profiles against live job postings
create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  candidate_id uuid references profiles(id) on delete cascade not null,
  job_id uuid references jobs(id) on delete cascade not null,
  score integer default 0 check (score >= 0 and score <= 100),
  status text default 'pending' check (status in ('pending', 'viewed', 'contacted', 'rejected')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(candidate_id, job_id)
);

-- Updated_at trigger
create or replace function update_matches_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger matches_updated_at
  before update on matches
  for each row execute function update_matches_updated_at();

-- RLS
alter table matches enable row level security;

-- Companies can see matches for jobs they own
create policy "company reads own job matches" on matches
  for select using (
    job_id in (select id from jobs where company_id = auth.uid())
  );

-- Candidates can see their own matches
create policy "candidate reads own matches" on matches
  for select using (candidate_id = auth.uid());

-- Authenticated users can upsert matches (the API runs as the authenticated user)
create policy "authenticated upsert matches" on matches
  for insert with check (auth.uid() is not null);

create policy "authenticated update matches" on matches
  for update using (auth.uid() is not null);

-- Index for fast lookups
create index if not exists matches_candidate_idx on matches(candidate_id);
create index if not exists matches_job_idx on matches(job_id);
create index if not exists matches_score_idx on matches(score desc);
