# Shapi Feature Status — 2026-06-03

Living document. Updated whenever a phase ships. Status legend:

- ✅ **Done** — shipped to main, tested
- 🔄 **In progress** — partial / scaffold only / awaiting wiring
- ⏳ **Not done** — planned, not started
- 🔒 **Blocked** — waiting on a prerequisite (usually the schema migration)
- 🅿️ **Parked** — explicit decision to defer

---

## CANDIDATE SIDE

### Account + auth

| Feature | Status | What it does |
|---|---|---|
| Email signup with confirmation | ✅ Done | Standard Supabase auth. Resend button on the "check your email" screen. |
| WhatsApp OTP signup | ✅ Done | Phone-first signup via Twilio. Defaults disabled until Ana enables Supabase Phone Auth + Twilio SMS service. |
| Login + password reset | ✅ Done | Supabase password reset. `/update-password` page handles the recovery session. |
| Profile edit | ✅ Done | `/profile/edit` — name, headline, location, skills, languages, WhatsApp, links. |
| Public profile | ✅ Done | `/p/[id]` — no login required, shareable URL. |

### CV + profile build

| Feature | Status | What it does |
|---|---|---|
| Upload CV (PDF) | ✅ Done | `/upload-cv` parses PDF via AI, seeds the profile. |
| Conversational CV builder | ✅ Done | `/cv-builder` — Claude chat interview, ~5–10 turns, industry-detected. |
| CV draft save & resume | ✅ Done | Chat persists per turn; dashboard shows "Finish your CV" card if incomplete. |
| Industry-specific CV writing | ✅ Done | 10+ industry styles (finance, tech, healthcare, ops, etc.) auto-applied based on parsed role. |
| Multilingual CV (native + English) | ✅ Done | Bilingual download for non-English candidates. |
| CV Pro deep-dive interview | ✅ Done | $59 tier unlocks a deeper industry-specific interview that produces a Pro CV. |
| Voice samples per language | ✅ Done | Post-`[PROFILE_READY]` voice capture for multilingual candidates. WhatsApp `voice` command resumes. |
| Industry-styled CV download | ✅ Done | `/cv-ready` page — gated by Kit ($25) or Pro ($59) one-time purchase. |
| Public-profile share | ✅ Done | After `[PROFILE_READY]`, automatic WhatsApp message with `/p/[id]` link. |
| Profile Preview free hook | ⏳ Not done | Free-tier strategic decision: upload CV → see blurred preview of polished profile → unlock for $25. Sits above current `/upload-cv` flow. |

### Verification + references

| Feature | Status | What it does |
|---|---|---|
| 6-reference cascade (2 managers / 2 peers / 2 reports across 3 jobs) | ✅ Done | `/profile/references` to set up. Magic-link `/reference/[token]` for each referee. |
| Anti-manipulation reference floor | ✅ Done | Refs answer structured QA; cross-checked against each other and candidate self-report. |
| AI Cross-Check | ✅ Done | Fires when 3+ refs land; flags inconsistencies as "Differing Perspectives" (visible to companies — trust by transparency). |
| Verification tier (basic/strong/premium) | ✅ Done | Updates as refs cascade; visible on `/p/[id]`. |
| Reference Day-3 + Day-7 nudge cron | ✅ Done | Polite WhatsApp nudge to referees who haven't engaged; cap 2 per ref. |
| Reference completion celebration | ✅ Done | When a ref completes, candidate gets a celebratory WhatsApp + Active $29 upsell (if not subscribed). |

### Tools (free + paid)

| Feature | Status | What it does |
|---|---|---|
| AI-readiness check `/ai-proof` | ✅ Done | AI exposure scoring across 6 dimensions. |
| Salary benchmark `/worth` | ✅ Done | Country-aware salary range with currency auto-detect from location (Riyadh→SAR, Dubai→AED). |
| Career translator `/translate` | ✅ Done | Career pivot module — translates skills across fields. |
| Work-style assessment `/work-style` | ✅ Done | Head/Heart/Hand/Spark assessment. |
| Course wallet `/course-wallet` | ✅ Done | Tracks courses in progress + completion — drives Continuous Learning signal. |
| Evidence vault `/evidence` | ✅ Done | Upload work artefacts; EXIF metadata captured for verification. |
| AskShapi widget (career guide variant) | ✅ Done | Bottom-right widget; role-aware (says "career guide" on candidate side). |

### Discovery + subscriptions

| Feature | Status | What it does |
|---|---|---|
| Roles Board `/roles` with 3 free blurred previews | ✅ Done | Non-subscribers see 3 roles with description blurred + "Unlock $19/mo" CTA. |
| Roles Board subscription ($19/mo) | ✅ Done | Open Roles Board — see all verified roles. |
| Active subscription ($29/mo) | ✅ Done | Job scanning, drafted outreach, tracking. |
| Concierge subscription ($89/mo) | ✅ Done | Daily AI shortlist + drafted outreach + interview prep with web search + proctored test (when added). Stripe price locked at $89. |
| Concierge approve-all via WhatsApp | ✅ Done | Text "approve all" → bulk-approves pending drafts + sends now. |
| Bundle subscription ($39/mo Roles Board + Active) | ✅ Done | Discounted bundle. |
| `/applications` (interviews scheduled + feedback owed) | ✅ Done | Status tracking. |
| `/active` Concierge queue | ✅ Done | Subscribers see draft outreach awaiting approval. |
| Stripe checkout (Kit + Pro one-time + recurring tiers) | ✅ Done | Webhook handles `checkout.session.completed`, `invoice.payment_failed` (dunning), `invoice.payment_succeeded`, `customer.subscription.deleted/updated`. |
| Stripe dunning sequence (Day 0/3/7) | ✅ Done | WhatsApp + Customer Portal link; grace-expired status on day 7. |
| Active Hiring trial-ending WhatsApp nudge | ✅ Done | Day-1-remaining heads-up so the auto-charge isn't a surprise. |

### WhatsApp commands

| Command | Status | What it does |
|---|---|---|
| Any voice/text mid-interview | ✅ Done | Continues Claude CV interview. Voice transcribed via Deepgram with keyword bias (Crystalax/Luxynest etc). |
| `voice` / `voice test` | ✅ Done | Resumes per-language voice sample capture. |
| `references` / `refs` | ✅ Done | Lists 6 reference requests with status emoji. |
| `share my profile` / `my link` | ✅ Done | Replies with `/p/[id]` URL. |
| `send my CV` | ✅ Done | Replies with download URL; upsells Kit if not purchased. |
| `prep me for [Company]` | ✅ Done | 150-200-word interview prep brief via Claude + web search. |
| `research [Company]` | ✅ Done | Web-search summary; logs to `company_research_requests` for the lead-gen flywheel. |
| `approve all` (Concierge) | ✅ Done | Bulk-approves pending drafts. |
| `start over` / `reset` | ✅ Done | Wipes interview state, restarts. |
| WhatsApp daily digest cron | ✅ Done | Opted-in subs get a morning summary. |
| Welcome message on first WhatsApp pairing | ✅ Done | OPENING_MESSAGE / NO_CV_MESSAGE depending on flow state. |

### Engagement / nurture

| Feature | Status | What it does |
|---|---|---|
| Nurture sweep cron (3-part welcome) | ✅ Done | New signups get a sequenced welcome. |
| Concierge scan + send cron | ✅ Done | Daily scan of roles, draft outreach, queue for approval. |
| Reference reminders cron | ✅ Done | Day 3/7 nudges to inactive referees + Day 3 candidate "chase X?" nudge. |
| Inbound email handler | ✅ Done | `/api/inbound/email` threads replies back to Concierge. |
| Kit 30-day re-engagement WA | ⏳ Not done | One-time buyer re-engagement — currently just a stamp column added; logic not built. |

---

## CLIENT SIDE (Company)

### Account + onboarding

| Feature | Status | What it does |
|---|---|---|
| Company signup | ✅ Done | Same `/signup` form with type toggle. |
| Static onboarding form `/company/onboarding` | ✅ Done | Collects company name, size, industry, location, summary, website, WhatsApp. Sets `onboarding_complete=true`. |
| Conversational onboarding interview | 🔄 In progress | Blueprint Prompt 02 — replace flat form with `/cv-builder`-pattern Claude chat. Route guard half is shipped; chat-UI rebuild pending. |
| Onboarding guard | ✅ Done | Both `/dashboard` and `/company/dashboard` enforce `onboarding_complete` — incomplete users routed to `/company/onboarding`. |
| Team invite (add team member) | ✅ Done | `/company/dashboard` Team-access panel. Invite email sent via Resend; row in `company_members`. |
| Company profile page `/company/profile` | ✅ Done | View-only "how candidates see you" + Glassdoor + Reddit sentiment public signals. |

### Dashboard

| Feature | Status | What it does |
|---|---|---|
| Company dashboard `/company/dashboard` | ✅ Done | Profile-completion ring, "what needs you today" card, candidate pool count, active roles, Snapshot nudge, Active Hiring upsell, team invites. |
| Connect-WhatsApp card | ✅ Done | First-encounter pairing card; hides once paired. Routes to `/company/onboarding` to add the number first if missing. |
| AskShapi widget (workforce co-pilot variant) | ✅ Done | Role-aware: says "workforce co-pilot" on company side. Distinct system prompt + intro. |
| Snapshot-just-done toast | ✅ Done | After running first Workforce Snapshot → `?snapshot=done` toast on dashboard with Growth $799 trial CTA. |

### Workforce Intelligence tools (current state — all 100% unrestricted today)

| Tool | Status | What it does |
|---|---|---|
| Workforce Snapshot `/company/workforce-snapshot` | ✅ Done | 5 inputs → AI-generated readiness score + risk heatmap + at-risk roles + AI integration cost envelope. localStorage persists report; CSV header strip + Template download. |
| Salary Benchmark `/company/salary-benchmark` | ✅ Done | Per-role per-location compensation band with confidence + sources. |
| Hiring Roadmap `/company/roadmap` | ✅ Done | What to hire first, with JDs pre-drafted; WhatsApp "send JD link for [role]" command supported. |
| Hiring Plan `/company/hiring-plan` | ✅ Done | Multi-quarter hiring plan with budget rollup. |
| Org Design `/company/org-design` | ✅ Done | Target-state org with 3-input form OR magic-link prefill from WhatsApp voice intake. |
| Staffing Recommendations `/company/staffing` | ✅ Done | Per-role Replace/Augment/Reskill/Redeploy/Protect + (NEW) Automate recommendations. |
| Cognitive Load `/company/cognitive-load` | ✅ Done | Per-team cognitive load assessment. |
| Strategic Workforce Plan `/company/strategic-plan` (was tier-b) | ✅ Done | 5-step wizard: Diagnostic → Org DNA → 1/3/5/10y Plan → People Outlay Map → Execution Playbook. |
| Workforce OS `/company/os` | ✅ Done | Live monitoring + drift alerts page; HRIS connectors marked "coming soon". |
| AI-Proof a Role `/role/ai-proof` | ✅ Done | Per-role automation exposure analysis. |

### Strategic Workforce Plan deep-dive (recent overhauls)

| Sub-feature | Status | What it does |
|---|---|---|
| Step 1: Operating Model Diagnostic | ✅ Done | Per-BU current / target / transition path + cross-cutting misalignments. |
| Step 2: Org DNA visual dashboard | ✅ Done | SVG ring chart of average DNA score + horizontal bar chart of 5 dimensions, colour-banded. Drilldown beneath. |
| Step 3: Workforce Plan with 6 buckets | ✅ Done | Y1/Y3/Y5/Y10 scenarios + cost trajectory + counts + ROLE LISTS per bucket (Replace/Augment/Reskill/Redeploy/Protect/Automate). |
| Step 4: People Outlay Map | ✅ Done | Claude extracts role gaps → matched against verified candidate pool → top 5 candidates per gap with match score + verification tier + click-through to `/p/[id]`. |
| Step 5: Execution Playbook visual roadmap | ✅ Done | 30/60/90 timeline header + 2-col hiring/outplacement cards + compliance matrix + accordion comms drafts. |
| Founder Strategy Session CTA | ✅ Done | Card at top of workspace links to `/book-call?topic=founder-session&engagement=[id]`. |
| Input persistence (Step 1 + Step 2) | ✅ Done | localStorage save/restore — no more lost typing on refresh. |
| Engagement lock | ✅ Done | Lock button finalises deliverable + status → 'locked'. |
| People Outlay incoming + outgoing | 🔒 Blocked | Needs persons + roles_seats migration to link "outgoing" candidates to actual employee records. |
| Per-employee HR portal placeholder | ✅ Done | Dashed-border purple card teases the vision (6 tiles: Lifecycle / Comp / Time off / Performance / Training / WhatsApp logging) — see task #94. |

### Talent pipeline

| Feature | Status | What it does |
|---|---|---|
| Roles list `/company/roles` | ✅ Done | List all roles you posted. |
| Post a role `/company/roles/new` | ✅ Done | Manual form OR paste JD → Claude parses. Includes Active Hiring 7-day-trial CTA on success. |
| Role share magic-link `/r/[token]` | ✅ Done | Mobile review/edit/publish — no login required. |
| Edit a role `/company/roles/[id]` | ✅ Done | Edit + see matched candidates. |
| Pipeline `/company/pipeline` | ✅ Done | Interview schedule + feedback owed + status across roles. |
| Pre-interview brief `/company/prep/[roleId]/[candidateId]` | ✅ Done | AI-generated candidate scorecard + diagnostic questions. |
| Candidates list `/candidates` | ✅ Done | Verified pool; names + contact gated behind subscription. |
| Candidate full profile `/candidates/[id]` | ✅ Done | Verification tier + references + voice samples + AI tier + "Differing Perspectives" Cross-Check panel. |
| Shortlist button | ✅ Done | Per-candidate, per-role. |
| Dual experienced + pivot budget bands | ⏳ Not done | Blueprint v4 Pro feature. Needs `roles_seats.experienced_budget_sar` + `pivot_budget_sar` columns. |

### WhatsApp commands (company side)

| Command | Status | What it does |
|---|---|---|
| `shortlist for [role title]` | ✅ Done | Top 5 verified candidates with `/p/[id]` links. |
| `research [candidate name]` | ✅ Done | Web-search summary; logs to flywheel. |
| `send jd link for [role]` | ✅ Done | Mints `/r/[token]` magic link. |
| `design my org` | ✅ Done | Replies with `/company/org-design` link. |
| `design my org via voice` | ✅ Done | 3-step voice intake → AI structures answers → magic-link `/company/org-design?intake=[token]`. |
| `cancel` / `stop` (mid-flow) | ✅ Done | Cancels org-design intake. |
| Any other message → JD intake chat | ✅ Done | Describes a role they want to fill → `[JD_DONE]` saves draft. |

### Subscriptions + billing

| Feature | Status | What it does |
|---|---|---|
| Stripe subscribe routes | ✅ Done | `/api/stripe/subscribe` for candidate + company recurring; `/api/stripe/checkout` for one-time. |
| Active Hiring 7-day trial | ✅ Done | `trial_period_days: 7` in Stripe Checkout. Post-trial auto-charge $499/mo. |
| Active Hiring trial-ending nudge | ✅ Done | Day-1-remaining WhatsApp heads-up. |
| Stripe dunning (Day 0/3/7) | ✅ Done | Same sequence as candidate side. Day 7 → grace-expired status + features locked. |
| Monthly ROI digest cron (25th UTC) | ✅ Done | Per-company per-month: shortlists + interviews + feedback notes + ~hours saved + annual upsell CTA. |
| Founding pricing (Starter $149 / Growth $399) | ✅ Done — but parked | Currently in `lib/subscriptions.ts`. v4 packaging shift means these aliases will need re-mapping. |

### Engagement / nurture (company)

| Feature | Status | What it does |
|---|---|---|
| Company WhatsApp daily digest cron | ✅ Done | New candidate interest + upcoming interviews + feedback owed. |
| Ghosting feedback nudge cron | ✅ Done | Interview ≥5 days ago with no company feedback → WhatsApp nudge to hiring manager. |
| Workforce Audit leads in admin | ✅ Done | `/admin` shows Snapshot runs sorted by readiness ASC for Tier B outreach. |
| Company research requests aggregated in admin | ✅ Done | `/admin` shows companies people asked Shapi about. |
| Book-a-call request admin pipeline | ✅ Done | `/admin` shows all `/book-call` submissions with topic chip; founder-session marked with 👋. |

### Marketing pages

| Page | Status | What it does |
|---|---|---|
| `/` homepage | ✅ Done | 9-locale i18n, hero with "I'm a candidate / I'm hiring" pre-selecting `/signup?type=`. |
| `/for-candidates` | ✅ Done | USPs + comparison table vs LinkedIn / Indeed / Bayt / GulfTalent. |
| `/for-companies` | ✅ Done | USPs + comparison table vs Workday / Greenhouse / Jack&Jill. ChartHop comparison column NOT YET added. |
| `/company/pricing` | ✅ Done — but parked | Current Starter $149 / Growth $399 cards — needs v4 rebuild (Free / Pro $499 / Enterprise $2,500-5,000). |
| `/blog` + `/blog/[slug]` | ✅ Done | Content marketing. |
| `/terms` + `/privacy` | ✅ Done | Legal. |

### Magic-link / no-login surfaces

| Route | Status | What it does |
|---|---|---|
| `/r/[token]` | ✅ Done | Hiring manager mobile role review/publish. 14-day TTL with ExpiredOrInvalid handler. |
| `/reference/[token]` | ✅ Done | Anonymous referee QA. |
| `/culture/[token]` | ✅ Done | Anti-manipulation employee culture-reference survey (min 3 responses). |
| `/company/org-design?intake=[token]` | ✅ Done | Form pre-filled with 3 voice-note transcripts from WhatsApp. |
| `/p/[id]` | ✅ Done | Public candidate profile. |
| `/book-call` | ✅ Done | Replaces broken mailto: dead-ends. Topic-aware (strategic-plan / founder-session / workforce-os / workforce-intelligence). Calendly integration. |

### Email infrastructure

| Feature | Status | What it does |
|---|---|---|
| Resend transactional emails | ✅ Done | Signup confirmation, reference outreach, reset password, /book-call confirmation, WelcomeCV, etc. |
| Resend SMTP wired to Supabase Auth | ⏳ Not done | Ana mentioned but didn't ship — current Supabase emails go via default rate-limited service. Bug: signup confirmation often fails. |
| hello@shapi.io inbound forwarding | ✅ Done | Cloudflare Email Routing → ana.vbarber@gmail.com. |
| Send-as hello@shapi.io from Gmail | ✅ Done | Gmail Send-As via Resend SMTP. |

---

## BLUEPRINT v4 — NEW BUILD WORK

The big architectural shift. Everything below depends on the schema migration landing first.

### Schema migration (THE prerequisite)

| Task | Status | Blocks |
|---|---|---|
| `persons` table (decoupled identity) | ⏳ Not done | Everything below |
| `companies` table with plan_tier enum | ⏳ Not done | Multi-location, FeatureGate enforcement |
| `locations` table + free-tier trigger | ⏳ Not done | Multi-location org chart |
| `teams` self-referencing tree | ⏳ Not done | Org chart visual builder |
| `roles_seats` (THE spine) | ⏳ Not done | Every sub-tool rewrite |
| `activity_catalogue` + FTE math | ⏳ Not done | Workload sizing |
| `employee_hr_profiles` | ⏳ Not done | HR Portal |
| `employee_attendance_ledger` with medical_consent_logged | ⏳ Not done | WhatsApp leave logging |
| `workload_delegations` | ⏳ Not done | Workload delegation engine |
| `organizational_decisions` immutable audit | ⏳ Not done | Restructuring audit trail |
| `brain_sources` + `brain_entries` + pgvector | ⏳ Not done | Company Brain |

### Org chart visual builder (Blueprint Prompt 04/05)

| Sub-feature | Status |
|---|---|
| 3-intake builder (manual / upload-and-map / AI advice) | 🔒 Blocked on schema |
| Visual template engine (functional/divisional/flat/matrix) — swappable lenses | 🔒 Blocked on schema |
| Drag-and-drop = single DB save | 🔒 Blocked on schema |
| Layout-change suggestion bar (never auto-snap) | 🔒 Blocked on schema |

### Sub-products refactor (read from spine, not re-ask)

| Refactor target | Status |
|---|---|
| Workforce Snapshot → reads from `roles_seats` not form inputs | 🔒 Blocked on schema |
| Salary Benchmark → reads from `roles_seats` + location | 🔒 Blocked on schema |
| Hiring Roadmap / Hiring Plan → reads from `roles_seats` status='planned' | 🔒 Blocked on schema |
| Org Design → IS the org chart canvas (merged) | 🔒 Blocked on schema |
| Staffing / Cognitive Load → reads team + activity_logs | 🔒 Blocked on schema |

### Living HR OS (Product 3 — Enterprise tier)

| Feature | Status | Notes |
|---|---|---|
| Per-employee HR portal UI | 🔒 Blocked on schema | Placeholder card teases vision in Execution Playbook |
| WhatsApp leave logging (sick / annual / parental) | 🔒 Blocked on schema | Including `medical_consent_logged` privacy guard + payload encryption |
| WhatsApp bonus approval cards (manager-driven) | 🔒 Blocked on schema | 2-step confirmation flow |
| In-app secure file drop zone (high-sensitivity assets) | 🔒 Blocked on schema | Magic-link from WhatsApp when user tries to attach files |
| Workload delegation % sliders | 🔒 Blocked on schema | Background WhatsApp polling for covering staff |
| Skill acquisition extraction from delegated deliverables | 🔒 Blocked on schema | Async worker on file uploads |
| Fair-Share Performance Bonus auto-flags | 🔒 Blocked on schema | Reads delegation + quality scores |
| Lifecycle scenario paths (replace/redeploy/reskill/augment/protect/automate) | 🔒 Blocked on schema | Each stage writes to organizational_decisions + hr_lifecycle_programs |

### Company Brain (Product 3 — Enterprise tier)

| Feature | Status |
|---|---|
| Three intake vectors (dashboard upload, Twilio WA, email forwarding) | 🔒 Blocked on schema + pgvector |
| Sensitivity classification (team / manager / private) | 🔒 Blocked on schema |
| Embedding pipeline (OpenAI text-embedding-3-small, 1536 dim) | 🔒 Blocked on schema |
| Anchored to role_seat_id (not human) — Seat Inheritance Playbook | 🔒 Blocked on schema |
| RAG retrieval for new hires (Day 1 conversational co-pilot) | 🔒 Blocked on schema |
| Predictive turnover + span-of-control heatmaps | 🔒 Blocked on schema |

### Pricing v4 + FeatureGate enforcement

| Task | Status |
|---|---|
| `<FeatureGate/>` component scaffold | ✅ Done | Inert until `NEXT_PUBLIC_GATES_ENFORCE=true` flag flipped |
| Entitlement map (FEATURE → tier) | ✅ Done | Tier-agnostic; reshapes for v4 in one edit |
| v4 tier prices in lib/subscriptions.ts (Pro $499, Enterprise $2,500) | ⏳ Not done | Locked numbers, just need code update |
| Pricing page rebuild `/company/pricing` | ⏳ Not done | Three cards: Free + Pro $499 + Enterprise $2,500-5,000 |
| Candidate `/pay` page refresh | ⏳ Not done | Confirm Concierge $89 on the page |
| Bespoke Driver Modifiers UI (Enterprise only) | 🔒 Blocked on schema | Custom severance/overhead/taxonomy override panels |
| Bespoke Transformation $15-25k upsell teaser | ⏳ Not done | Greyed-out card on Free/Pro per Section 9 |
| 14-day Pro trial with card-required signup | ⏳ Not done | Stripe Checkout `subscription_data.trial_period_days: 14` |
| ChartHop comparison column on `/for-companies` | ⏳ Not done | Saved as `[[reference-competitor-charthop]]` memory |

### Marketing copy refresh

| Task | Status |
|---|---|
| Content rule pass — strip "no fluff" / "honestly" / em-dash mic-drops | ⏳ Not done | Per blueprint Principle 3 |
| Brand vocab adoption (Seat Inheritance Playbook / Activity Catalogue Sliders / AI-Exposure Score per seat) | ⏳ Not done | Across homepage + for-companies + pricing |
| Quick-strike sales pitch on homepage | ⏳ Not done | ChartHop dismantle wording |
| Italian locale (master doc Standing Rules) | ⏳ Not done | 10th locale alongside existing 9 |

### Logo + design system

| Task | Status |
|---|---|
| Refined North Star SVG (long axis + cross-points + asymmetric facet) | ⏳ Not done | Needs Ana's visual eye |
| 16px favicon legibility test | ⏳ Not done | Simplification rules |
| Palette E platform-wide design pass | 🅿️ Parked | Last step per master doc (Step 7) |

### Pre-launch bug sweep (Section 7 from blueprint)

| Bug | Status |
|---|---|
| Workforce Snapshot connection drop | ✅ Done |
| Add-team-member fail | ✅ Done |
| CSV upload mapping | ✅ Done |
| Homepage candidate button routing | ✅ Done |
| Voice transcript code-side keyword bias | ✅ Done |
| Voice transcript LIVE-data regex cleanup | 🅿️ Parked | No live data yet — Ana's +test users only |

---

## Open conflicts / strategic decisions still parked

| Item | Status |
|---|---|
| Supabase SMTP via Resend (auth emails) | ⏳ Not done | Bug: signup confirmation rate-limited via Supabase default |
| Stripe Products predefined (move off `price_data` inline) | 🅿️ Parked | Post-launch when pricing has held a month |
| Phone OTP signup (Twilio + Supabase Auth wiring) | 🅿️ Parked | Pre-incorporation; Twilio still on trial |
| WABA (WhatsApp Business API) | 🅿️ Parked | Needs Shapi incorporation first |

---

## Last 5 ships (newest first)

1. `<FeatureGate/>` scaffold + entitlements layer (inert by default)
2. v4 pricing locked memory + ChartHop battlecard memory
3. Strategic Plan execution playbook visual redesign + HR Portal placeholder
4. `/company/tier-b` → `/company/strategic-plan` URL rename + onboarding guards
5. Workforce Plan 6 buckets with role lists + Org DNA dashboard + Y10 horizon

## Next up (in this exact order, my recommendation)

1. **Wire FeatureGate to a few showcase pages** with `enforce=false` so layout doesn't break (free dry-run)
2. **Update `lib/subscriptions.ts`** with locked v4 prices (Pro $499, Enterprise $2,500, Bespoke $15-25k)
3. **Rebuild `/company/pricing`** with the three v4 cards + 14-day trial CTA
4. **Then schema migration (Blueprint Prompt 04)** — THE unlock for everything blocked
5. **Then everything else in priority order** — Org Chart spine → sub-products refactor → Company Brain → HR OS
