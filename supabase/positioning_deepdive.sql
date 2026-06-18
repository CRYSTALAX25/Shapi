-- ─────────────────────────────────────────────────────────────────────────────
-- positioning_deepdive — conversation state + extracted result for the
-- Positioning Deep-Dive (the WhatsApp interview that surfaces the proof for the
-- Verified Positioning CV, across the 4 skill axes + off-CV gems).
--
-- Shape (jsonb):
-- {
--   "status": "in_progress" | "completed",
--   "chat": [ { "role": "assistant"|"user", "content": "..." } ],
--   "started_at": "...", "completed_at": "...",
--   "result": {
--     "headline": "...", "roleLabel": "...", "narrative": "...",
--     "proofs": [ { axis, number, outcome, context, verifier, source, confidence } ]
--   }
-- }
--
-- Separate from industry_chats (industry-coverage deep-dive) on purpose — this
-- one is career-wide, axis-driven, and feeds the positioning CV. Additive.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists positioning_deepdive jsonb;
