create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  type text not null check (type in ('candidate', 'company')),
  -- candidate fields
  full_name text,
  headline text,
  location text,
  summary text,
  -- work history (stored as JSONB array)
  work_history jsonb default '[]',
  -- skills
  skills text[] default '{}',
  ai_tier text check (ai_tier in ('user', 'integrator', 'builder')),
  -- onboarding progress
  onboarding_step int default 0,
  onboarding_complete bool default false,
  -- profile status
  profile_live bool default false,
  completion_pct int default 0,
  -- cv upload
  cv_storage_path text,
  cv_parsed bool default false,
  -- whatsapp
  whatsapp_number text,
  whatsapp_conversation_active bool default false,
  -- payment
  paid bool default false,
  stripe_customer_id text,
  -- company fields
  company_name text,
  company_size text,
  company_website text,
  -- timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

-- Users can read and update their own profile
create policy "Users can manage own profile" on profiles
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, type)
  values (new.id, new.raw_user_meta_data->>'type');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at();
