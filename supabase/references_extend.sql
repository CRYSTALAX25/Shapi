-- ============================================================================
-- candidate_references — extend v1 to match the full reference chain spec
-- ============================================================================
-- Idempotent: safe to run multiple times.
--
-- What this adds:
--   • ref_type (manager | colleague | stakeholder) + job_slot (1 | 2)
--   • Phone-first columns (referee_phone, referee_title) + WhatsApp-only refs
--   • Nomination linkage (nominated_by, nominator_name) for blind nominees
--   • Outreach tracking (outreach_channel, outreach_token, last_contacted_at)
--   • Conversation + structured answers (whatsapp_chat, responses jsonb,
--     nominees jsonb, contacted_at)
--   • Status check constraint widened: pending|contacted|opened|completed|
--     declined|no_response
--
-- After running this, set profiles.profile_live=true automatically when both
-- job_slots have a manager + colleague + stakeholder all completed.
-- ============================================================================

-- 1. Drop legacy status CHECK + widen the allowed values
alter table candidate_references drop constraint if exists candidate_references_status_check;
alter table candidate_references
  add constraint candidate_references_status_check
  check (status in ('pending','sent','contacted','opened','completed','declined','no_response'));

-- 2. Allow WhatsApp-only references (drop NOT NULL on email + relationship)
alter table candidate_references alter column referee_email drop not null;
alter table candidate_references alter column referee_relationship drop not null;

-- 3. Reference typing + which job this applies to
alter table candidate_references add column if not exists ref_type text
  check (ref_type in ('manager','colleague','stakeholder'));
alter table candidate_references add column if not exists job_slot int
  check (job_slot in (1, 2));

-- Backfill: any pre-existing row is a manager for job 1
update candidate_references set ref_type = 'manager' where ref_type is null;
update candidate_references set job_slot = 1 where job_slot is null;

-- 4. Phone-first contact info + role/title
alter table candidate_references add column if not exists referee_phone text;
alter table candidate_references add column if not exists referee_title text;

-- 5. Denormalised candidate role context (used in WhatsApp + email body)
alter table candidate_references add column if not exists candidate_company text;
alter table candidate_references add column if not exists candidate_job_title text;
alter table candidate_references add column if not exists candidate_dates text;

-- 6. Nomination chain — colleague/stakeholder pointed-to by manager
alter table candidate_references add column if not exists nominated_by uuid
  references candidate_references(id) on delete set null;
alter table candidate_references add column if not exists nominator_name text;

-- 7. Outreach tracking
alter table candidate_references add column if not exists outreach_channel text
  check (outreach_channel in ('whatsapp','sms','email','whatsapp+email','sms+email','none'));
alter table candidate_references add column if not exists last_contacted_at timestamptz;
alter table candidate_references add column if not exists contacted_at timestamptz;
alter table candidate_references add column if not exists updated_at timestamptz default now();

-- 8. Conversation + structured response data
alter table candidate_references add column if not exists whatsapp_chat jsonb default '[]'::jsonb;
alter table candidate_references add column if not exists responses jsonb;
alter table candidate_references add column if not exists nominees jsonb;

-- 9. Test mode flag — when true, all outreach for this row is routed to the
-- candidate's own phone/email so Ana can test the full chain end-to-end
alter table candidate_references add column if not exists is_test_outreach boolean default false;

-- 9a. Response channel + timing — data signal on referee preference (WhatsApp vs
-- web form vs email click-through). Stamped on the FIRST reply we receive.
alter table candidate_references add column if not exists response_channel text
  check (response_channel in ('whatsapp','web_form','email_reply'));
alter table candidate_references add column if not exists first_responded_at timestamptz;

-- 10. Indexes to support the webhook routing (referee_phone lookup) and the
-- profile completion query (per-candidate, per-job, per-ref-type)
create index if not exists idx_candidate_references_phone
  on candidate_references (referee_phone) where referee_phone is not null;
create index if not exists idx_candidate_references_candidate_job_type
  on candidate_references (candidate_id, job_slot, ref_type);
create index if not exists idx_candidate_references_token
  on candidate_references (token);
create index if not exists idx_candidate_references_status
  on candidate_references (candidate_id, status);

-- 11. Auto-update updated_at trigger (reuse existing if present, else create)
create or replace function update_candidate_references_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists candidate_references_updated_at_trigger on candidate_references;
create trigger candidate_references_updated_at_trigger
  before update on candidate_references
  for each row execute function update_candidate_references_updated_at();

-- 12. Profile auto-completion helper — flips profile_live=true when both
-- job_slots have all 3 references (manager+colleague+stakeholder) completed.
-- Called from app code after each reference is marked completed.
create or replace function recompute_profile_live(p_candidate uuid)
returns void as $$
declare
  job1_complete boolean;
  job2_complete boolean;
begin
  -- A job_slot is "complete" only when all 3 ref_types for it are completed
  select
    count(distinct ref_type) = 3
  into job1_complete
  from candidate_references
  where candidate_id = p_candidate
    and job_slot = 1
    and status = 'completed'
    and ref_type in ('manager','colleague','stakeholder');

  select
    count(distinct ref_type) = 3
  into job2_complete
  from candidate_references
  where candidate_id = p_candidate
    and job_slot = 2
    and status = 'completed'
    and ref_type in ('manager','colleague','stakeholder');

  -- Flip profile_live only when BOTH jobs are fully verified
  if job1_complete and job2_complete then
    update profiles set profile_live = true, updated_at = now() where id = p_candidate;
  end if;
end;
$$ language plpgsql;
