-- ============================================================================
-- concierge_replies.sql — Concierge reply capture + auto-booking
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- When a hiring manager replies to a candidate's AI-Concierge outreach, Shapi
-- captures it, surfaces it in-platform, and auto-initiates an interview.
--
-- This migration extends `concierge_queue` with the reply-capture columns and
-- widens the status CHECK constraint to include the new 'replied' state.
--
--   reply_token   — opaque token embedded in the reply-to address
--                   (reply+<token>@<INBOUND_EMAIL_DOMAIN>) so an inbound email
--                   webhook can match the reply back to its draft.
--   replied_at    — when the manager's reply was detected
--   reply_excerpt — first ~300 chars of the reply text (for in-platform display)
--   interview_id  — the auto-created interviews row (one per replied draft)
-- ============================================================================

alter table concierge_queue
  add column if not exists reply_token text,
  add column if not exists replied_at timestamptz,
  add column if not exists reply_excerpt text,
  add column if not exists interview_id uuid references public.interviews(id) on delete set null;

-- Widen the status CHECK constraint to allow 'replied'.
-- The original constraint name is auto-generated; drop by discovering it, then
-- recreate with the full allowed set. Safe to re-run.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.concierge_queue'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if con_name is not null then
    execute format('alter table concierge_queue drop constraint %I', con_name);
  end if;

  alter table concierge_queue
    add constraint concierge_queue_status_check check (
      status in ('pending_approval', 'auto_send', 'approved', 'sent', 'declined', 'stale', 'replied')
    );
end $$;

-- Fast lookup by reply_token for the inbound email webhook.
create unique index if not exists idx_concierge_reply_token
  on concierge_queue (reply_token) where reply_token is not null;
