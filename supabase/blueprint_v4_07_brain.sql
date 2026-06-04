-- ============================================================================
-- blueprint_v4_07_brain.sql — Company Brain (Enterprise tier)
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00..03.
--
-- The Company Brain is THE MOAT. Two tables:
--
--   brain_sources — ingestion endpoints. One row per upload/email/voice/chat
--   brain_entries — chunked + embedded content. One row per ~512-token chunk
--
-- Anchored to role_seat_id, NOT person_id. This is the Seat Inheritance
-- Playbook architecture: when an employee leaves, the knowledge anchored to
-- their seat stays with the seat. The successor inherits a conversational
-- onboarding co-pilot on Day 1.
--
-- Embeddings: pgvector vector(1536) for OpenAI text-embedding-3-small. Use
-- HNSW index for cosine similarity queries.
--
-- Sensitivity tiers:
--   • team    — visible to all seats in the same team (default)
--   • manager — visible to managers in the chain only
--   • private — visible only to the seat-holder + assigned HRBP
--
-- Skill detection: ai_detected_skills_gained on brain_entries feeds the
-- Skill Density / Capability Matrix (HRBP Layer #1 — keystone). Without
-- this column populated, the redeployment engine has nothing to query.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- brain_sources — ingestion provenance.
-- ---------------------------------------------------------------------------
create table if not exists public.brain_sources (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references auth.users(id) on delete cascade,
  source_type           text not null check (source_type in (
    'slack_export',
    'email_thread',
    'meeting_transcript',
    'file_upload',
    'whatsapp_voice',
    'whatsapp_text',
    'document_drop',
    'manual_note'
  )),
  source_name           text not null,                       -- "Q3 Strategy Meeting"
  -- Default sensitivity applied to all entries from this source. Individual
  -- entries can override via brain_entries.sensitivity.
  sensitivity           text not null default 'team' check (sensitivity in (
    'team', 'manager', 'private'
  )),
  uploaded_by_user_id   uuid references auth.users(id) on delete set null,
  -- Anchor at the source level — if every entry from this source belongs to
  -- the same seat (e.g., a person's email export), set it here. Entry-level
  -- anchors override.
  default_anchor_seat_id uuid references public.roles_seats(id) on delete set null,
  default_anchor_team_id uuid references public.teams(id) on delete set null,
  -- Storage references (Supabase Storage).
  file_storage_path     text,
  file_size_bytes       bigint,
  file_mime_type        text,
  -- Ingestion lifecycle.
  status                text not null default 'pending' check (status in (
    'pending', 'processing', 'embedded', 'failed', 'rejected'
  )),
  ingestion_error       text,
  raw_metadata          jsonb default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  processed_at          timestamptz
);

create index if not exists idx_brain_sources_company on public.brain_sources (company_id);
create index if not exists idx_brain_sources_status on public.brain_sources (company_id, status);
create index if not exists idx_brain_sources_seat on public.brain_sources (default_anchor_seat_id)
  where default_anchor_seat_id is not null;

alter table public.brain_sources enable row level security;
drop policy if exists "brain_sources: company member read" on public.brain_sources;
create policy "brain_sources: company member read"
  on public.brain_sources for select
  using (public.is_company_member(company_id));
drop policy if exists "brain_sources: company owner write" on public.brain_sources;
create policy "brain_sources: company owner write"
  on public.brain_sources for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- ---------------------------------------------------------------------------
-- brain_entries — chunked content + vector embeddings.
-- ---------------------------------------------------------------------------
create table if not exists public.brain_entries (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references auth.users(id) on delete cascade,
  source_id             uuid not null references public.brain_sources(id) on delete cascade,
  -- THE anchor — anchored to seat (Seat Inheritance Playbook), NOT person.
  -- When a person leaves, the seat stays + their entries stay anchored.
  anchor_seat_id        uuid references public.roles_seats(id) on delete set null,
  anchor_team_id        uuid references public.teams(id) on delete set null,
  content               text not null,
  -- pgvector embedding. text-embedding-3-small returns 1536 dims.
  embedding             vector(1536),
  -- Per-entry sensitivity override (defaults to brain_sources.sensitivity).
  sensitivity           text not null default 'team' check (sensitivity in (
    'team', 'manager', 'private'
  )),
  -- AI-detected skills demonstrated in this entry. THIS COLUMN POWERS the
  -- Skill Density / Capability Matrix (HRBP Layer #1, the keystone). The
  -- ingestion worker runs a Claude call against each chunk asking "what
  -- skills does this content demonstrate?" → text[] array → gin-indexed.
  ai_detected_skills_gained text[] default '{}'::text[],
  -- Chunking metadata.
  chunk_index           int,
  token_count           int,
  created_at            timestamptz not null default now()
);

create index if not exists idx_brain_entries_company on public.brain_entries (company_id);
create index if not exists idx_brain_entries_source on public.brain_entries (source_id);
create index if not exists idx_brain_entries_seat on public.brain_entries (anchor_seat_id)
  where anchor_seat_id is not null;
create index if not exists idx_brain_entries_team on public.brain_entries (anchor_team_id)
  where anchor_team_id is not null;
-- GIN index for Skill Density queries — "show seats with skill X".
create index if not exists idx_brain_entries_skills_gained on public.brain_entries
  using gin (ai_detected_skills_gained);

-- HNSW vector index for semantic search. Cosine distance is the default for
-- text-embedding-3-small. m=16, ef_construction=64 are the standard
-- sensible defaults for sub-1M vectors.
do $$
begin
  if not exists (
    select 1 from pg_indexes where indexname = 'idx_brain_entries_embedding_hnsw'
  ) then
    create index idx_brain_entries_embedding_hnsw
      on public.brain_entries
      using hnsw (embedding vector_cosine_ops)
      with (m = 16, ef_construction = 64);
  end if;
end$$;

alter table public.brain_entries enable row level security;

-- Reading entries is trickier than other tables because of sensitivity.
-- For v1: company member can read team-level entries; only company owner
-- can read manager/private entries. Phase 2 will fold in chain-of-command
-- lookups via roles_seats.team_id traversal.
drop policy if exists "brain_entries: tier-gated read" on public.brain_entries;
create policy "brain_entries: tier-gated read"
  on public.brain_entries for select
  using (
    (public.is_company_member(company_id) and sensitivity = 'team')
    or auth.uid() = company_id
  );

drop policy if exists "brain_entries: company owner write" on public.brain_entries;
create policy "brain_entries: company owner write"
  on public.brain_entries for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);
