-- ============================================================================
-- company_research_requests.sql — candidate-driven lead-gen flywheel (STRATEGY §13)
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- Captures every "research [Company X]" request a candidate sends over WhatsApp
-- (or in-app later). The AI does the research; we log the request + summary.
-- Phase 2: aggregate by company_name → auto-create unclaimed company profiles +
-- send "you were searched by N verified candidates" outreach.
--
-- Why we log even the AI summary: it gives us (a) a concrete proof signal for
-- the company outreach email (we already know who they are), and (b) a
-- per-candidate audit so we can show value back ("you researched 4 companies
-- this month, 2 are now hiring through Shapi").
-- ============================================================================

create table if not exists public.company_research_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  ai_summary text,
  source text default 'whatsapp',  -- 'whatsapp' | 'web' | etc. for future channels
  created_at timestamptz not null default now()
);

create index if not exists company_research_candidate_idx
  on public.company_research_requests (candidate_id, created_at desc);
create index if not exists company_research_company_idx
  on public.company_research_requests (lower(company_name));

alter table public.company_research_requests enable row level security;

drop policy if exists "candidate reads own research requests" on public.company_research_requests;
create policy "candidate reads own research requests" on public.company_research_requests
  for select using (candidate_id = auth.uid());

-- Inserts come from the WhatsApp webhook running on the service role, so no
-- candidate-side insert policy is needed.
