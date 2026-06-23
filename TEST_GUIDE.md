# Shapi — Testing Guide

A blueprint anyone can follow to test Shapi: what the products are, how to set up
test data, which accounts to use, what flows to walk, and what to ignore (known
not-live-yet). Pair this with **`TEST_PUNCHLIST.md`** (the page-by-page checklist).

---

## 0. What you're testing — the products

Shapi is a **two-sided verified hiring marketplace.** You test it from both sides.

**Candidate side** — build a verified profile, get references sourced independently,
download a positioning CV, browse verified roles, and (Active product) import
external jobs to track + prep + have Shapi reach the hiring manager.

**Company side** — post roles, browse + shortlist verified candidates, run a pipeline,
see an independent workplace **trust score**, and use the workforce-intelligence
suite (snapshot, org spine, Company Brain, HR-OS, skill density, P&L, etc.).

The differentiator throughout is **verification & trust** — every claim is Verified,
Shapi-assessed, or Self-reported.

---

## 1. Setup (≈5 min)

### 1a. Run the database migrations (Supabase SQL editor)
Run these once, in order. All are idempotent (`create … if not exists` — additive,
no data loss):

1. `supabase/blueprint_v4_RUN_ALL.sql`  ← spine, Brain, HR-OS, skill density, P&L, FeatureGate tiers
2. `supabase/RUN_PENDING_2026-06-11.sql`
3. `supabase/RUN_PENDING_2026-06-11b.sql`
4. `supabase/active_applications.sql`  ← Active product
5. `supabase/availability_slots.sql`  ← (re-run the corrected version)
6. `supabase/crosssell_outreach.sql`  ← **NEW** — the cross-sell loop

> If `create extension vector/pgcrypto` errors → Supabase Studio → Database →
> Extensions → toggle `vector` + `pgcrypto` ON, re-run #1.

### 1b. Seed the test personas (one command)
```bash
node scripts/seed-personas.mjs
```
Reads the service-role key from `.env.local`. Idempotent — re-run anytime. It
auto-confirms all accounts (no email needed) and prints a summary + magic-link
tokens at the end. ⚠️ It **hard-resets** the `+company1` account every run (that's
intentional — gives you a clean enterprise org each time).

---

## 2. Test accounts (seeded — log in with data already populated)

**Shared password for ALL accounts:** `ShapiTest!2026`
(All emails are `+`-aliases of `ana.vbarber@gmail.com`, so every one is real & reachable.)

| Email | Side | Persona — what's pre-loaded |
|---|---|---|
| `ana.vbarber+test1@gmail.com` | Candidate | **Amira Hassan** — verified white-collar PM, 6 references all completed, subscription active, 2 imported external jobs |
| `ana.vbarber+test2@gmail.com` | Candidate | **Imran Qureshi** — blue-collar→facilities pivot, multilingual (Urdu/Hindi+EN), voice-note CV, 3 of 6 refs done, free tier |
| `ana.vbarber+company1@gmail.com` | Company | **Meridian Gulf** (Enterprise) — full org: 2 locations, 4 teams, 10 people, 12 seats, HR profiles, 1 PIP + 1 separation, **live workplace trust score**, 2 roles |
| `ana.vbarber+company2@gmail.com` | Company | **Cedar & Co** (Starter/free) — small studio, 2 roles, Glassdoor 4.1, **no trust survey yet** (shows the locked trust state) |
| `ana.vbarber+test4@gmail.com` | Company (member) | Team member under Meridian Gulf — tests the non-owner / restricted-HR view |
| `ana.vbarber+test5@gmail.com` | Company (HRBP) | HRBP attached to Meridian Gulf — sees comp/attendance/PIP data |
| `ana.vbarber+test6@gmail.com` | Magic-link | Referee / hiring manager — wired to Amira's reference + a role-share link |

Magic-link URLs (reference + role-share tokens) are printed at the end of the seed run.

---

## 3. Also test FRESH signups (empty state)

The seeded accounts test "looks great with data." Equally important: sign up brand-new
so you see what a **real first user** sees (empty states, onboarding nudges, upsells).

- **Fresh candidate:** `/signup` → "I'm a candidate" → walk upload-cv / cv-builder →
  dashboard. Verify: no crashes, friendly empty states, clear next-step CTAs.
- **Fresh company:** `/signup` → "I'm hiring" → `/company/onboarding` → dashboard.
  Verify: prompted to complete profile + post first role; tools show empty states, not errors.

> Note: real signup sends a confirmation email via Supabase's default SMTP, which is
> rate-limited/unreliable until we wire Resend SMTP (see §5). If the email doesn't
> arrive, use the **Resend confirmation** button on the "check your email" screen, or
> just test with the seeded accounts (already confirmed).

---

## 4. What to test — flows

### Candidate side (log in as test1, or fresh)
- **Profile build:** `/upload-cv` (PDF parse) and `/cv-builder` (Claude chat). → profile populates.
- **Positioning CV:** `/cv-lab` → `/cv-ready` (download). *(Now linked from the dashboard.)*
- **References:** `/profile/references` → set up the 6-ref cascade. (test1 has them done; test2 mid-way.)
- **Public profile:** `/p/[id]` — open it logged-out; it should be shareable + no login.
- **Roles board:** `/roles` — ranked by match; click a **company name → `/c/[id]`** (the trust page).
  Meridian Gulf shows a **live** trust score; Cedar & Co shows the **locked** state.
- **Active product:** `/active` — test1 has 2 imported jobs. Add one manually. On a job card,
  click **"Get Shapi to reach them →"** → anonymized teaser modal → it queues (see §4 cross-sell).
- **Applications:** `/applications` — interview/feedback tracking.
- **Free tools:** `/worth`, `/ai-proof`, `/translate`, `/work-style`, `/course-wallet`, `/evidence`.

### Company side (log in as company1 for full data, company2 for starter, or fresh)
- **Dashboard:** `/company/dashboard` — completion ring, "what needs you," pool count, upsells.
- **Profile + trust:** `/company/profile` — "how candidates see you" + your trust card + **View public page ↗** (`/c/[id]`).
- **Roles:** `/company/roles` → `/company/roles/new` (manual or paste-JD) → `/company/roles/[id]`.
- **Candidates:** `/candidates` → **View full profile** → `/candidates/[id]` → shortlist (from a role).
- **Pipeline:** `/company/pipeline` — seeded with candidates at stages.
- **Intelligence suite (company1 has rich data):** `/company/workforce-snapshot`, `/company/spine`
  (org chart), `/company/brain`, `/company/people` (+ a person → HR tiles; PIP/separation),
  `/company/skill-density`, `/company/workforce-pl`, `/company/strategic-plan`, `/company/staffing`,
  `/company/salary-benchmark`, `/company/roadmap`, `/company/hiring-plan`, `/company/org-design`,
  `/company/cognitive-load`, `/company/os`.
- **Restricted view:** log in as **test4** (team member) and open a person under Meridian Gulf —
  comp/time-off/lifecycle should show a **"restricted access"** state (not blank).

### Magic-link surfaces (no login — use the tokens the seed prints)
- `/reference/[token]` — referee answers the structured QA.
- `/r/[token]` — hiring manager reviews/publishes a role on mobile.
- `/culture/[token]` — employee culture survey (9 dims).
- `/confirm-seat/[token]` — employee confirms an org-chart seat (+ culture piggyback).

### The cross-sell loop — Direction A (candidate-sourced company acquisition)
This is the new growth engine. **Test mode is on by default** (no Hunter key / no
`OUTREACH_FROM` set), so it's safe — teaser emails route to the candidate's OWN inbox
with a `[TEST]` subject instead of contacting real hiring managers.
1. As **test1**, go to `/active`, pick an imported job → **"Get Shapi to reach them →"**.
2. Approve the anonymized teaser in the modal → it shows **Queued**.
3. Trigger the worker: hit `GET /api/cron/crosssell` (or wait for the daily cron). It enriches
   (no Hunter key → marks "no verified contact found" gracefully; with a key → finds + verifies an email).
4. To exercise the full send path, set `OUTREACH_FROM` + `HUNTER_API_KEY` locally, or just confirm
   the **status chips** progress and the **`/unlock/[token]`** page renders (open the unlock URL from
   the queued row) → "Sign up free to unlock" → `/signup?type=company&unlock=…` → the company unlocks the candidate.

---

## 5. Known NOT-live yet — don't flag these as bugs

These are env/launch-gated, intentionally off for now:
- **Signup confirmation emails** — Supabase default SMTP is flaky; Resend SMTP wiring is a launch task. (Seeded accounts are pre-confirmed; fresh signups can use the Resend-confirmation button.)
- **Stripe is in TEST mode** — use Stripe test cards; live keys go in at launch.
- **WhatsApp / OTP signup** — Twilio is on trial; flows exist but may not send. Email signup is the default.
- **Cross-sell outreach send** — runs in TEST mode (emails to self) until `HUNTER_API_KEY` + `OUTREACH_FROM` (outreach subdomain) are set.
- **FeatureGate enforcement** — off (`NEXT_PUBLIC_GATES_ENFORCE` unset); all tiers visible for testing.
- **Direction B** of the cross-sell loop (company → candidate) — not built yet (post-launch).

---

## 6. How to log what you find

Use **`TEST_PUNCHLIST.md`** — every page is listed with a `Notes:` line. As you walk a
page, jot the change on its line (BUG / COPY / UX / DATA / CUT / LATER). When you've done a
batch, hand the notes over and they get fixed + the box ticked. That keeps fixes scoped and
nothing gets lost.
