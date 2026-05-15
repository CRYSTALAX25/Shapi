-- Evidence table: stores photo/doc uploads for work verification
create table evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size int not null,
  -- EXIF / metadata extracted server-side
  taken_at timestamptz,
  gps_lat double precision,
  gps_lng double precision,
  device text,
  -- verification status
  status text default 'pending' check (status in ('pending', 'verified', 'rejected')),
  caption text,
  created_at timestamptz default now()
);

alter table evidence enable row level security;

create policy "Users can manage own evidence" on evidence
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket for evidence files (run in Supabase dashboard Storage section)
-- Bucket name: evidence
-- Public: false
-- Max file size: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/heic, application/pdf
