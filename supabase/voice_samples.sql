-- ============================================================================
-- voice_samples.sql — per-language voice samples for a candidate's profile
-- ============================================================================
-- Idempotent.
--
-- During the WhatsApp interview, candidates can be prompted to send a short
-- voice note in each language they speak. We capture the Twilio media SID,
-- transcript, duration and detected language, then surface a player on the
-- profile (and a gated player on the company-facing public profile).
--
-- Stored as a jsonb keyed by language code (or full language name lowercase):
--   {
--     "english":  { "media_sid": "MEXX...", "message_sid": "MMXX...", "transcript": "...", "duration_s": 22, "recorded_at": "2026-05-19T..." },
--     "croatian": { ... },
--     "arabic":   { ... }
--   }
--
-- Playback is streamed through /api/voice-sample/[candidate]/[lang] which
-- authenticates with Twilio (basic auth using SID + Auth Token) so the raw
-- Twilio URL never leaks to a public client.
-- ============================================================================

alter table profiles
  add column if not exists voice_samples jsonb default '{}',
  -- Tracks which language the WhatsApp webhook is currently waiting for a
  -- sample in. Cleared once the sample is captured.
  add column if not exists awaiting_voice_sample_lang text;

create index if not exists idx_profiles_voice_samples
  on profiles using gin (voice_samples);
