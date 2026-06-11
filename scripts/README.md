# scripts/

## seed-personas.mjs

Re-runnable seed for Ana's 6 test personas against the **LIVE** Supabase DB
(project `juqgwcipbdzoegodiydh`). Uses the SERVICE ROLE key read from
`.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

```bash
node scripts/seed-personas.mjs
```

### What it does
- Resolves/creates each persona's auth user (auto-confirmed, no email sent).
- Shared password for **all** personas: `ShapiTest!2026`
- Idempotent: deterministic UUIDs + email-keyed upserts. Re-running never
  duplicates. Candidate reference sets self-reconcile to exactly the seeded rows.

### Personas
| Email | Role |
|---|---|
| `ana.vbarber+test1@gmail.com` | Candidate A — white-collar, fully **verified** (6 references all completed), subscription active |
| `ana.vbarber+test2@gmail.com` | Candidate B — blue-collar/pivot, multilingual (Hindi/Urdu+EN), voice-note CV, refs 3 of 6 done |
| `ana.vbarber+company1@gmail.com` | Company owner "Meridian Gulf" (Enterprise) + full org (2 locations, 4 teams, 10 persons, 12 seats, 2 roles, 1 job) |
| `ana.vbarber+test4@gmail.com` | Team member under company1 (accepted `company_members`) |
| `ana.vbarber+test5@gmail.com` | HRBP (Enterprise) — 5 hr_profiles, attendance ledger (1 consented sick), 1 in-progress PIP + audit decision |
| `ana.vbarber+test6@gmail.com` | Referee / hiring manager — wired to Candidate A's reference + a role-share magic-link token |

### ⚠️ The +company1 HARD RESET (pre-approved)
On every run the script **deletes everything** owned by
`ana.vbarber+company1@gmail.com` (all org/HR/brain/decision rows in FK-safe
order, the profile, then the auth user) and recreates it fresh. BEFORE/AFTER
row counts are printed.

Scope is guarded to the single resolved auth id. If that email ever resolves
to 0 or >1 users the script ABORTS without deleting. **No other email/id is
ever deleted.**

### Notes
- The `roles` table (active-hiring) has no committed migration; the script
  probes the live shape and only writes columns that exist. Same defensive
  filtering is applied to `profiles`.
- Calibration Lens metrics (`okr_completion_pct` / `absorbed_capacity_pct` /
  `ai_exposure_score`) are spread across seats so gold/slate/crimson all render.
