# Blueprint v4 Schema Migration — Run Order

Source of truth for the v4 architecture. **Run these in Supabase SQL editor in order.** Each file is idempotent — safe to re-run.

| Order | File | What it adds |
|---|---|---|
| 00 | `blueprint_v4_00_helpers.sql` | pgvector + pgcrypto extensions; `is_company_member()` RLS helper; `touch_updated_at()` trigger function |
| 01 | `blueprint_v4_01_company_tier.sql` | Extends `profiles` with `plan_tier`, `trial_ends_at`, `bespoke_config`, `upload_and_map_count`. Adds `trialing` + `grace_expired` to subscription_status |
| 02 | `blueprint_v4_02_locations_teams.sql` | `locations` + `teams`. **Includes the free-tier 1-location DB trigger** |
| 03 | `blueprint_v4_03_persons_seats.sql` | `persons` (decoupled identity, NOT auth.users) + **`roles_seats` (THE SPINE)** |
| 04 | `blueprint_v4_04_activity_workload.sql` | `activity_catalogue` + `workload_delegations` |
| 05 | `blueprint_v4_05_hr_os.sql` | `employee_hr_profiles` + `employee_attendance_ledger` + `hr_lifecycle_programs`. **HRBP+manager-only RLS** |
| 06 | `blueprint_v4_06_decisions.sql` | `organizational_decisions` — **immutable audit (insert-only)** |
| 07 | `blueprint_v4_07_brain.sql` | `brain_sources` + `brain_entries` with **pgvector HNSW index** |

## How to run

1. Open Supabase Studio → SQL Editor
2. Paste `blueprint_v4_00_helpers.sql` → Run
3. Repeat for 01, 02, 03, 04, 05, 06, 07 in order
4. Each script is idempotent — if it errors halfway, fix the issue, re-run

If you hit a permission error on `create extension vector`, the dashboard has a separate **Database → Extensions** panel. Toggle `vector` and `pgcrypto` ON, then re-run 00.

## Key architectural decisions

- **No separate `companies` table.** The v4 packaging is enforced by extending `profiles` with `plan_tier`. FeatureGate check: `profiles.plan_tier >= required_tier`. Reduces duplication, doesn't break any existing query.
- **`person_id` decoupled from `auth.users(id)`.** Persons are employee records. They MAY link to a Shapi user via `linked_user_id` but don't have to. This is what makes "seat survives departure" work.
- **`roles_seats` is THE spine.** Every other v4 module reads from this table. Workforce Snapshot, Salary Benchmark, Hiring Roadmap, Org Design, Staffing, Cognitive Load, Talent Match, HR OS, Company Brain anchoring — all anchor to a seat.
- **Free tier hard gate is a DB trigger.** `enforce_free_tier_location_limit()` blocks the 2nd location INSERT. App layer cannot bypass it. SQLSTATE `P0001` with hint message → API catches, returns 402, FeatureGate overlay renders.
- **HR OS uses 3-axis RBAC.** Owner + assigned HRBP + reporting manager. Medical-consent-logged attendance rows are doubly gated (manager can't see them unless they're also the HRBP). Per PDPL/GDPR floor.
- **`organizational_decisions` is insert-only.** No UPDATE or DELETE policies. Corrections require new rows with `corrects_decision_id`. Legally defensible audit trail.
- **Brain anchors to seat, not person.** Seat Inheritance Playbook architecture. When `person_id` clears, brain entries stay anchored to the seat.

## Required prereqs in Supabase

- **pgvector extension** — installed by file 00, but the `vector` extension must be enabled in the dashboard if your project hasn't used it. Standard on Supabase Postgres ≥ 15.
- **pgcrypto extension** — also enabled by file 00. Standard.

## What this UNBLOCKS

- HRBP Layer #1 Skill Density Capability Matrix (task #101) — reads `brain_entries.ai_detected_skills_gained` + `workload_delegations.ai_detected_skills_gained` + `roles_seats`
- HRBP Layer #2 Calibration Lens (task #102) — reads `roles_seats.okr_completion_pct` + `absorbed_capacity_pct` + future flight_risk_score
- HRBP Layer #3 PIP/Separation Playbooks (task #103) — writes to `hr_lifecycle_programs` + `organizational_decisions`
- Org Chart Visual Builder (task #88 Prompt 05) — reads/writes `teams` + `roles_seats`
- Company Brain Ingestion (task #90 Prompt 07) — writes `brain_sources` + `brain_entries`
- HR Portal per-staff (task #94) — reads `employee_hr_profiles` + `employee_attendance_ledger` + `hr_lifecycle_programs`
- WhatsApp HR Intents (task #96) — writes `employee_attendance_ledger` with `logged_via='whatsapp'` + `medical_consent_logged=true`
- v4 one-plan packaging UI (task #98) — reads `profiles.plan_tier`
- Bespoke Driver Modifiers (task #97) — reads/writes `profiles.bespoke_config`
- Sub-products refactor — Workforce Snapshot / Salary Benchmark / Hiring Roadmap / Org Design / Staffing / Cognitive Load → all become reads from `roles_seats` instead of re-asking form inputs
