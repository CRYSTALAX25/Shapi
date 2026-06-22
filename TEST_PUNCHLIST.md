# Shapi — Page-by-Page Test Punchlist

How to use: walk each page in order, click everything, and write what needs
changing on its **Notes:** line (leave blank = page is fine). When you've done a
batch, tell me "fix punchlist 12–18" or paste the notes — I'll fix them and tick
the box. `[ ]` = not reviewed, `[x]` = reviewed + fixed.

Legend for your notes: **BUG** (broken), **COPY** (wording), **UX** (flow/layout),
**DATA** (wrong/missing data), **CUT** (remove this), **LATER** (post-launch).

---

## A. Public / marketing / auth

- [ ] **`/`** — Homepage + waitlist · Notes:
- [ ] **`/signup`** — Create account (candidate/company toggle, email + WhatsApp) · Notes:
- [ ] **`/login`** — Sign in · Notes:
- [ ] **`/reset-password`** — Request reset · Notes:
- [ ] **`/update-password`** — Set new password (recovery) · Notes:
- [ ] **`/for-candidates`** — Candidate marketing + comparison table · Notes:
- [ ] **`/for-companies`** — Company marketing + comparison table · Notes:
- [ ] **`/for-hrbps`** — HRBP marketing page · Notes:
- [ ] **`/company/pricing`** — Company plans + checkout · Notes:
- [ ] **`/blog`** + **`/blog/[slug]`** — Content · Notes:
- [ ] **`/terms`** / **`/privacy`** — Legal · Notes:
- [ ] **`/book-call`** — Calendly booking (topic-aware) · Notes:
- [ ] **`/business`** — (verify what this is / keep?) · Notes:
- [ ] **`/hero-3d`** — (verify — demo page? keep/cut?) · Notes:
- [ ] **`/preview`** — (verify what this is / keep?) · Notes:

## B. Candidate journey (in order)

- [ ] **`/upload-cv`** — Upload CV (PDF parse → seed profile) · Notes:
- [ ] **`/cv-builder`** — Claude conversational CV interview · Notes:
- [ ] **`/cv-lab`** — Positioning CV preview · Notes:
- [ ] **`/cv-ready`** — Industry-styled CV download (gated) · Notes:
- [ ] **`/pay`** — Payment page → Stripe checkout · Notes:
- [ ] **`/pay-success`** — Post-payment · Notes:
- [ ] **`/onboarding`** — 5-step manual profile (Skip path) · Notes:
- [ ] **`/dashboard`** — Candidate dashboard · Notes:
- [ ] **`/profile`** — Candidate's own profile view · Notes:
- [ ] **`/profile/edit`** — Edit profile fields · Notes:
- [ ] **`/profile/references`** — Set up the 6-reference cascade · Notes:
- [ ] **`/profile/positioning`** — Positioning CV view · Notes:
- [ ] **`/profile/print`** + **`/profile/print/preview`** — Printable CV · Notes:
- [ ] **`/p/[id]`** — Public shareable profile (no login) · Notes:

## C. Candidate tools (free + paid)

- [ ] **`/roles`** — Verified roles board (3 free blurred, subscribe to unlock) · Notes:
- [ ] **`/applications`** — Interviews scheduled + feedback owed · Notes:
- [ ] **`/active`** — Active product: import external jobs, track, prep · Notes:
- [ ] **`/worth`** — Salary benchmark (lead magnet) · Notes:
- [ ] **`/ai-proof`** + **`/role/ai-proof`** — AI-readiness check · Notes:
- [ ] **`/translate`** — Career translator / pivot · Notes:
- [ ] **`/work-style`** — Head/Heart/Hand/Spark assessment · Notes:
- [ ] **`/course-wallet`** — Course tracking · Notes:
- [ ] **`/evidence`** — Evidence vault (work artefacts + EXIF) · Notes:

## D. Company journey (in order)

- [ ] **`/company/onboarding`** — Company setup form · Notes:
- [ ] **`/company/welcome`** — (verify — post-signup welcome?) · Notes:
- [ ] **`/company/dashboard`** — Company dashboard · Notes:
- [ ] **`/company/profile`** — "How candidates see you" + trust card + **View public page** · Notes:
- [ ] **`/c/[id]`** — NEW public company trust page (candidate-facing) · Notes:
- [ ] **`/company/roles`** — List posted roles · Notes:
- [ ] **`/company/roles/new`** — Post a role (manual or JD paste) · Notes:
- [ ] **`/company/roles/[id]`** — Edit role + matched candidates · Notes:
- [ ] **`/company/pipeline`** — Interview schedule + feedback owed · Notes:
- [ ] **`/company/prep/[roleId]/[candidateId]`** — Pre-interview brief · Notes:
- [ ] **`/candidates`** — Browse verified pool (gated) → **View full profile** · Notes:
- [ ] **`/candidates/[id]`** — Candidate full profile · Notes:

## E. Company intelligence tools

- [ ] **`/company/workforce-snapshot`** — Readiness score + risk heatmap · Notes:
- [ ] **`/company/salary-benchmark`** — Comp bands · Notes:
- [ ] **`/company/roadmap`** — Hiring roadmap · Notes:
- [ ] **`/company/hiring-plan`** — Multi-quarter plan + budget · Notes:
- [ ] **`/company/org-design`** — Target-state org · Notes:
- [ ] **`/company/staffing`** — Replace/Augment/Reskill/etc. · Notes:
- [ ] **`/company/cognitive-load`** — Per-team load · Notes:
- [ ] **`/company/strategic-plan`** — 5-step strategic workforce plan · Notes:
- [ ] **`/company/tier-b`** — ⚠️ possible stale duplicate of strategic-plan — verify/redirect/cut · Notes:
- [ ] **`/company/os`** — Workforce OS monitoring (+ HRIS "coming soon") · Notes:
- [ ] **`/company/workforce-pl`** — Workforce P&L Ledger (now schema-live) · Notes:
- [ ] **`/company/spine`** — Org chart builder (now schema-live) · Notes:
- [ ] **`/company/brain`** — Company Brain (now schema-live) · Notes:
- [ ] **`/company/people`** + **`/company/people/[personId]`** + **`.../lifecycle`** — HR-OS / per-employee (now schema-live) · Notes:
- [ ] **`/company/delegation`** — Workload delegation (now schema-live) · Notes:
- [ ] **`/company/skill-density`** — Capability matrix (now schema-live) · Notes:

## F. Magic-link / no-login surfaces

- [ ] **`/reference/[token]`** — Referee answers QA · Notes:
- [ ] **`/culture/[token]`** — Employee culture survey (9 dims) · Notes:
- [ ] **`/confirm-seat/[token]`** — Employee confirms org-chart seat (+ culture piggyback) · Notes:
- [ ] **`/r/[token]`** — Hiring manager mobile role review/publish · Notes:

## G. Admin

- [ ] **`/admin`** — Leads pipeline (snapshots, research requests, book-call) · Notes:

---

## Cross-cutting checks (note here, not per-page)

- [ ] Mobile layout on the pages you care most about · Notes:
- [ ] Email confirmation actually arrives on signup (known weak point — Supabase SMTP) · Notes:
- [ ] Stripe checkout in TEST mode completes + unlocks the right tier · Notes:
- [ ] WhatsApp flows (if Twilio enabled) · Notes:
- [ ] i18n — language switch on `/` and key pages · Notes:
- [ ] Any link that 404s or lands on the wrong dashboard · Notes:
