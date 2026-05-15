create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  type text not null check (type in ('candidate', 'company')),
  created_at timestamptz default now()
);

alter table waitlist enable row level security;

create policy "Service role full access" on waitlist
  using (true)
  with check (true);
