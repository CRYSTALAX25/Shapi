-- ============================================================================
-- profile_identity.sql — profile image + right-to-work (self-declared)
-- ============================================================================
-- Idempotent.
--
-- Adds a profile photo and a self-declared right-to-work block. Both follow the
-- fountain-of-truth model: shown as ○ self-reported until a future KYC step
-- upgrades right_to_work to ✓ verified (document-checked).
--
-- right_to_work jsonb shape:
--   {
--     "status": "citizen" | "permanent_resident" | "work_visa" | "need_sponsorship" | "other",
--     "authorized_countries": ["UAE", "UK"],
--     "note": "optional free text",
--     "verified": false            -- flipped true only after document verification
--   }
-- ============================================================================

alter table profiles
  add column if not exists profile_image_url text,
  add column if not exists right_to_work jsonb;

-- Public storage bucket for profile photos (id = 'avatars').
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone can read avatars (public bucket); owners can write their own.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
