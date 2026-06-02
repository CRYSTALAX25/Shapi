-- ============================================================================
-- book_call_requests.sql — enterprise / Strategic Workforce Plan call requests
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- The /book-call form (replaces the broken mailto: links) POSTs into here
-- before firing the Resend notification emails. Storing the request means:
--   • the lead survives even if Resend has an outage
--   • /admin shows a leads table Ana can triage from
--   • we can later add status (replied, scheduled, dropped) without a schema
--     change since status defaults to 'new'
-- ============================================================================

create table if not exists public.book_call_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  email         text not null,
  company       text not null,
  role          text,
  company_size  text,
  timeline      text,
  message       text,
  topic         text default 'strategy-call',
  status        text not null default 'new',  -- new | replied | scheduled | dropped
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_book_call_requests_created on public.book_call_requests (created_at desc);
create index if not exists idx_book_call_requests_status on public.book_call_requests (status);
create index if not exists idx_book_call_requests_email on public.book_call_requests (email);
