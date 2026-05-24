-- Let candidates log events they personally attended (with a proof photo of them
-- there), kept alongside the Shapi-recommended events in the same table.
--   photo_url  — public URL of the attendance photo (optional)
--   is_custom  — true = candidate added it themselves; false = Shapi-recommended
-- Idempotent: safe to re-run.

alter table candidate_events add column if not exists photo_url text;
alter table candidate_events add column if not exists is_custom boolean not null default false;
