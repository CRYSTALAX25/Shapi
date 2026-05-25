-- Career Translator: persist the candidate's latest "From role → To role" pivot
-- analysis (financial reality + roadmap + track) so it survives reloads.
-- Idempotent.
alter table profiles add column if not exists career_translation jsonb;
