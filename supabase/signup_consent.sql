-- Signup consent + attribution
-- Adds marketing opt-in and "how did you hear about us" to profiles, and updates
-- the signup trigger to copy them from auth user metadata. Idempotent — safe to
-- re-run. Paste into the Supabase SQL editor (clear the editor first).

alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default false;

alter table public.profiles
  add column if not exists referral_source text;

-- Recreate the signup trigger function so new accounts persist consent + source.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, type, marketing_opt_in, referral_source)
  values (
    new.id,
    new.raw_user_meta_data->>'type',
    coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false),
    new.raw_user_meta_data->>'referral_source'
  );
  return new;
end;
$$;
