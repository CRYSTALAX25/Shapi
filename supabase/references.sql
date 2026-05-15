create table references (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references auth.users(id) on delete cascade not null,
  -- referee details (provided by candidate)
  referee_name text not null,
  referee_email text not null,
  referee_relationship text not null,
  -- token for the public form link (no auth needed)
  token uuid default gen_random_uuid() unique not null,
  -- status
  status text default 'pending' check (status in ('pending', 'sent', 'completed', 'declined')),
  email_sent_at timestamptz,
  completed_at timestamptz,
  -- referee responses
  response_quality text,
  response_achievement text,
  response_skills text,
  response_would_rehire text,
  response_anything_else text,
  -- extracted skills (Claude-parsed from responses)
  extracted_skills text[],
  created_at timestamptz default now()
);

alter table references enable row level security;

-- Candidates can read their own references
create policy "Candidates can read own references" on references
  for select using (auth.uid() = candidate_id);

-- Candidates can insert references
create policy "Candidates can create references" on references
  for insert with check (auth.uid() = candidate_id);

-- Service role can update (for webhook/email flows)
-- No RLS restriction on service role by default
