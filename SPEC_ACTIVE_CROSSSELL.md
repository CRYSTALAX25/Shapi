# Build Spec — Candidate-Sourced Company Acquisition ("Trojan candidate") · Direction A

Status: **READY TO BUILD** (post-launch #1). Strategy: STRATEGY.md §13b.
Owner decisions needed before code — see §0. This spec is implementation-ready; a
builder should be able to start from §1 once §0 is answered.

---

## The loop in one line

A candidate imports an external job they're chasing → Shapi finds that role's hiring
manager → emails them an **anonymized, verified** candidate teaser for that exact role →
**the company signs up (free) to unlock the candidate** → supply side seeded with a real,
interested, verified candidate already attached.

Direction B (company names a candidate → Shapi reaches them) reuses ~80% of this; build
after A. Notes at the end.

---

## 0. Decisions / secrets required before build (Ana)

| # | Decision | Recommendation |
|---|---|---|
| 0.1 | Enrichment provider | **Hunter.io** (Email Finder + Email Verifier — verifier is what kills the Apollo bounce problem). Backup: **Dropcontact** (EU/PDPL-friendly). |
| 0.2 | Outreach sender identity | Dedicated **subdomain** (e.g. `talent@reach.shapi.io`), NOT `hello@shapi.io`. Protects the primary domain's deliverability. Needs SPF/DKIM set up in Resend + DNS. |
| 0.3 | Volume cap policy | **1 outreach per target company per quarter** (mirror §13), max 1 per hiring-manager email, plus a global daily send cap during warmup (start ~25/day). |
| 0.4 | No-email fallback | If Hunter can't find a confident, verified HM email → **do NOT send** (no spraying `careers@`). Mark the outreach `ready_no_email` and tell the candidate. |
| 0.5 | Pricing placement | Include "Shapi reaches the company for you" as the **headline value of Shapi Pro $59/mo** under fair-use caps (don't gate behind a higher tier — it's the growth engine). |
| 0.6 | Candidate consent | **Mandatory teaser preview + approve before send.** Consent + quality + anonymization review in one step. |

Env vars to add (Vercel + .env.local): `HUNTER_API_KEY`, `OUTREACH_FROM` (e.g.
`talent@reach.shapi.io`), `OUTREACH_DAILY_CAP` (default 25).

---

## 1. Data model (new migration: `supabase/crosssell_outreach.sql`)

Idempotent, RLS on. Two tables.

### `crosssell_outreach`
One row per (candidate, target company+role) outreach attempt.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| candidate_id | uuid → auth.users | the candidate driving it |
| active_application_id | uuid → active_applications | nullable; the imported job |
| direction | text default 'A' | 'A' candidate-led / 'B' company-led (future) |
| company_name | text not null | free text from the imported job |
| company_domain | text | enriched (Hunter) or parsed from job_url host |
| target_role | text | the job title |
| hm_name | text | hiring manager (if known/enriched) |
| hm_email | text | enriched + verified |
| hm_title | text | |
| hm_source | text | 'hunter' \| 'candidate' \| 'posting' |
| teaser_approved | boolean default false | candidate consent gate (§0.6) |
| status | text default 'draft' | see state machine below |
| unlock_token | text unique | the company signup/unlock link token |
| unlocked_company_id | uuid → auth.users | the company account that signed up |
| suppression_reason | text | when status='suppressed' |
| sent_at / opened_at / unlocked_at | timestamptz | |
| created_at / updated_at | timestamptz | |

Unique partial guard: `unique (candidate_id, company_domain, target_role)` — dedupe
re-imports of the same job.

**Status state machine:**
`draft` → (candidate approves) `queued` → (enrich) `enriching` → `ready`/`ready_no_email`
→ (send) `sent` → `opened` → `unlocked` (terminal win) | `declined` | `bounced` |
`suppressed` | `failed`.

### `outreach_suppression`
Global do-not-contact list (opt-outs, bounces, complaints, manual).

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| value | text not null | an email or a domain |
| scope | text not null | 'email' \| 'domain' |
| reason | text | 'unsubscribe' \| 'bounce' \| 'complaint' \| 'manual' |
| created_at | timestamptz | |

Unique on `(scope, lower(value))`.

RLS: both tables are service-role-only (no client policies) — all reads/writes go through
admin-client API routes + cron. The candidate sees their own outreach via a scoped API.

---

## 2. Candidate flow (UI: `/active`)

The "import an external job" UI already exists (`src/app/active/page.tsx` — manual add form
+ "save" on web-searched results, writing to `active_applications`). Add:

1. **On each saved job card: a "Get Shapi to reach them →" button.** Visible to Shapi Pro
   subscribers (gate via `hasProAccess()`); upsell otherwise.
2. Click → **teaser preview modal**: renders the anonymized profile exactly as the hiring
   manager will see it (reuse the `/p/[id]` blurred-profile asset — strengths, verification
   tier, reference count, AI tier, axis proofs; NO name, NO identifying current employer).
   Copy: "This is what {Company}'s hiring manager will see. Approve to let us reach out."
3. **Approve** → `POST /api/active/reach` with `{ active_application_id }` → creates a
   `crosssell_outreach` row (`status='queued'`, `teaser_approved=true`). Show status chip on
   the card: *Queued → Reaching out → Opened → Unlocked 🎉*.
4. Candidate can **withdraw** before send (`DELETE /api/active/reach`).

---

## 3. API routes

| route | method | does |
|---|---|---|
| `/api/active/reach` | POST | create outreach (draft→queued), return teaser preview payload |
| `/api/active/reach` | DELETE | withdraw a not-yet-sent outreach |
| `/api/active/reach` | GET | candidate's own outreach list + statuses |
| `/api/cron/crosssell` | POST (cron) | the worker: enrich → cap/suppression check → send. Add to the daily cron OR a dedicated schedule. |
| `/unlock/[token]` | page | public anonymized teaser + signup CTA |
| `/api/outreach/unsubscribe` | GET | one-click opt-out → adds to `outreach_suppression`, flips status |
| `/api/webhooks/resend` | POST | (optional) open/bounce/complaint events → status + suppression |

Signup-unlock hook: extend the existing tokenless-invite pattern
(`/signup?company_invite=...` in `src/app/api/company/invite`) — use
`/signup?type=company&unlock=<unlock_token>`. On company signup completion, a hook resolves
the token → set `unlocked_company_id`, `status='unlocked'`, `unlocked_at`, then reveal the
candidate to that company + notify the candidate (email + WhatsApp, reuse concierge senders).

---

## 4. Enrichment worker (`/api/cron/crosssell`)

For each `queued` outreach:
1. **Domain**: parse `active_applications.job_url` host; else Hunter Domain Search by
   `company_name`. Store `company_domain`.
2. **Hiring manager email**: Hunter Email Finder (domain + `hm_name` if the candidate gave
   one, else department=`hr`/`executive`). Then **Hunter Email Verifier** — only keep
   `deliverable` results (this is the anti-bounce step). Store `hm_email`, `hm_source`.
3. No confident verified email → `status='ready_no_email'`, surface to candidate, stop.
4. Else `status='ready'`.

Then, for each `ready`: **pre-send gate** →
- not in `outreach_suppression` (email or domain), AND
- `< 1` sent to this `company_domain` in the last 90 days, AND
- under `OUTREACH_DAILY_CAP` for today.
Pass → send (§5), `status='sent'`. Fail cap → leave `ready` for tomorrow. Fail suppression →
`status='suppressed'`.

---

## 5. The teaser email (Resend, from `OUTREACH_FROM`)

- **Subject:** `A verified candidate is pursuing your {target_role}`
- **Body:** anonymized verified highlights (strengths, verification tier, "{N} verified
  references", AI tier) — lead with **verification**, that's the non-spam differentiator.
  CTA button → `/unlock/{token}`: **"See their profile — free"**.
- **Footer:** clear sender identity (Shapi, what it is, why they got this — "a verified
  candidate asked us to share their profile with you for your open {role}") + **one-click
  unsubscribe** (`/api/outreach/unsubscribe?token=...`).
- Send from the warmed subdomain; throttled by the daily cap.

---

## 6. Unlock landing (`/unlock/[token]`, public)

- Renders the **anonymized** verified profile (reuse `/p/[id]` blurred view).
- Headline: "A verified candidate is actively interested in your {role}."
- CTA: **"Sign up free to unlock their name & contact"** → `/signup?type=company&unlock={token}`.
- After signup → reveal full profile, drop them into `/company/dashboard`, seed their
  company profile, and they're now in the marketplace (upsell to roles board / diagnostics).
- Token expired/invalid → graceful state + generic "browse verified talent" CTA.

---

## 7. Build order (phases)

1. **Schema** — `crosssell_outreach.sql` + `outreach_suppression.sql`. (§1)
2. **Candidate trigger** — `/active` button + teaser preview + `POST/DELETE/GET /api/active/reach`. (§2/§3)
3. **Enrichment + send worker** — `/api/cron/crosssell` with Hunter + caps + suppression + Resend. (§4/§5)
4. **Unlock + signup hook** — `/unlock/[token]` + `?unlock=` signup linking + reveal + notify. (§6)
5. **Compliance polish** — unsubscribe route, Resend webhook for bounce/complaint → suppression, subdomain warmup. (§3)
6. **Status surfacing** — candidate sees outreach status on `/active`; admin sees leads in `/admin`.

Phases 1–2 are testable without sending (dry-run). Phase 3 needs the Hunter key + subdomain
(§0). Each phase ships independently.

---

## 8. Reuse map (don't rebuild)

- `active_applications` (imported jobs) — the entry point.
- `/p/[id]` blurred profile — the anonymized teaser asset (preview + email + unlock page).
- `src/app/api/company/invite` tokenless `/signup?...` pattern — the unlock signup.
- Concierge email/WhatsApp senders (`src/lib/email.ts`, `src/lib/whatsapp.ts`) — candidate notifications.
- `company_research_requests` / §13 flywheel — log company leads alongside.
- `/c/[id]` company page — where the company lands once it has a profile.

---

## 9. Direction B (company-led) — follow-on, not now

Same `crosssell_outreach` table with `direction='B'`. A company names a candidate they want
(LinkedIn URL / name) → Shapi enriches the **candidate's** contact (or the company already
has it; Shapi is the broker) → teaser email to the candidate: *"{Company} wants your verified
profile."* → **unlock = candidate signs up.**

Why it matters most: **leakage capture** — routing direct company→candidate outreach through
Shapi keeps the relationship on-platform, so the placement fee + two-sided confirmation
(§leakage) apply. Also a natural paid company feature (sourcing credits / Growth-tier perk).

Extra care vs A: cold-contacting an **individual** is PDPL/GDPR-stricter than B2B. Warm,
opportunity-framed, discreet (never tip off a current employer), candidate controls
visibility, easy decline. Build after A's compliance plumbing is proven.
