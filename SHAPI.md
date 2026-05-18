# Shapi — Product Overview & Reference

> Verified-talent platform. Two-sided marketplace.
> Mission: every candidate gets a CV that actually wins interviews + a verified profile companies can trust.
> Founder: Ana O. Barber.
> UAE-first launch May 2026.

---

## 1. The big idea (one line)

**Shapi turns a CV into a verified profile by interviewing the candidate over WhatsApp, contacting their references independently, and writing them a CV that actually wins interviews — in every language they speak.**

---

## 2. What makes Shapi different (the moats)

| # | USP | Why nobody else does this |
|---|---|---|
| 1 | **Conversational profile builder via WhatsApp** — voice notes in any language, Claude conducts the interview | Most CV services are forms or template editors. This is a real interview. |
| 2 | **Independent reference outreach + blind nominees** — line manager nominates a colleague + stakeholder, we contact those people, candidate never sees who or what they said | Reference checks today are candidate-controlled (they pick who, they brief them). Ours are independently verified. |
| 3 | **AI cross-check verification report** — Claude compares CV claims against reference responses, flags inconsistencies, badges what's verified | No competitor cross-references. This is the company-facing differentiator. |
| 4 | **Multi-language CV in one purchase** — one $25 unlocks every language the candidate speaks (English, Croatian, Italian, Tagalog, Arabic, etc.) | Other services charge per language or only English. |
| 5 | **Skill Quadrant matching** — Hands/Heart/Head/Spark fingerprint × industry × AI tier — multi-dimensional candidate↔role matching | Everyone else matches on keywords or job titles. |
| 6 | **Career Roadmap (Pro)** — AI resilience score + personalised pivots + events to attend | Closest is LinkedIn Learning suggestions; ours is personalised + tied to verified work history + AI-displacement trends. |
| 7 | **Industry-specific deep-dive interviews (Pro)** — Claude analyses candidate vs "exceptional CV in this industry" rubric → gap-targeted questions → world-class CV | Generic CV writers don't have industry briefs that deep. |
| 8 | **Voice samples per language (planned)** — companies can HEAR fluency before scheduling interviews | Brand-new — no competitor does this. |

---

## 3. Pricing tiers

### Candidate side

| Tier | Price | What's included | Who it's for |
|---|---|---|---|
| **Sign-up** | Free | CV uploaded + parsed + WhatsApp interview + skill fingerprint + initial profile. **Preview only — no CV download.** | Anyone testing the platform |
| **CV Kit** | **$25 one-time** | Everything above + **download multi-language CVs** (English + every CV-listed language + Universal + per-industry English) + WhatsApp/email send. Cached forever — re-download anytime. | Candidates who just want a great CV |
| **CV Pro** | **$59 one-time** | Kit + **industry deep-dive interview** (up to 3 industries, hyper-targeted via gap-analysis) + **verification chain** (references + AI cross-check + tier badge) + **Career Roadmap** (AI resilience score, skills gaps, pivot paths, events) | Candidates serious about a great career move |
| **Open Roles Board** | **$19/mo or $149/yr** add-on | Pro + visible to hiring companies on the platform, get shortlisted, inbound match notifications, Glassdoor company intel | Passive — "let opportunities find me" |
| **Shapi Active** | **$29/mo or $249/yr** add-on | Pro + job scanner (external job search) + AI cover letter drafts + applications tracker + interview prep briefs (company snapshots, social intel, conversation starters) | Active hunters — "I'm searching now" |
| **Active Concierge** | **$79/mo** add-on (planned) | Active + daily auto-shortlist + AI drafts outreach using verified refs → candidate one-tap approves/sends → optional auto-send for 9+/10 matches after 30-day trust period | Senior candidates who want a part-time AI recruiter |
| **Career bundle** | **$39/mo or $349/yr** | Pro + Open Roles + Active. Discount vs separate. | Serious job seekers, max value |

### Company side

| Tier | Price | What's included |
|---|---|---|
| **Starter** | **$299/mo** | See all verified candidates + basic reference summary ("3 references confirmed strong fit") + match scoring |
| **Growth** | **$799/mo** | Starter + **full AI cross-check report** (claims verified vs unverified, conflict flags, skill validation), Skill Quadrant filtering, voice sample playback per language |
| **Enterprise** | Custom | Growth + white-glove sourcing, advanced filtering by tier badge, dedicated success manager, branded integration |
| **Placement fee** | **$500 per hire** | After 30 days in role. Optional for companies on subscription tiers. |

---

## 4. Verification tiers (candidate-side badges)

Free for candidates to earn by completing verification. Companies see badges and filter by them.

| Badge | Requirements | What it signals |
|---|---|---|
| 🔵 **Basic Verified** | 1 of 2 reference chains complete (1 manager + 1 colleague + 1 stakeholder all responded) | Partially verified |
| 🟢 **Strongly Verified** | 2 of 2 reference chains complete + 1 current-role peer reference | Full verification — profile_live=true, 100% complete |
| 🟡 **Premium Verified** | Strong + AI cross-check ran with zero flagged conflicts between candidate's claims and references | Highest credibility — companies pay attention |

---

## 5. The Skill Quadrant (4-axis matching)

Every candidate and every role scored 0-10 on 4 working-style axes:

| Axis | Covers | Example high scorer |
|---|---|---|
| 🔧 **Hands** | Physical / practical / dexterity / on-site | Trades, F&B service, manufacturing, surgery |
| ❤️ **Heart** | Interpersonal / leadership / customer-facing / care | Sales, HR, hospitality, teaching, nursing |
| 🧠 **Head** | Analytical / technical / systems / problem-solving | Engineering, finance, data, research |
| ✨ **Spark** | Creative / strategic / innovation / design | Creative direction, product, R&D, founders |

Plus **AI Tier** badge (separate axis): 🤖 **User** / 🤖 **Integrator** / 🤖 **Builder** — what tools they use, not how they work.

Matching = cosine similarity between candidate vector + role vector, then filtered by industry.

---

## 6. Supported industries (10)

`finance · tech · creative · healthcare · legal · marketing · operations · hospitality · education · sales`

Each has a rich **industry brief** in `src/lib/industry-briefs.ts` covering:
- Sub-segment anchors (e.g. property type + brand for hospitality, sub-specialty for healthcare)
- Numbers recruiters look for
- Hidden goldmines candidates always forget
- Vocabulary of expertise
- Red flags + common mistakes
- One exemplary achievement showing the bar

The brief drives BOTH deep-dive questions (gap-analysis vs the brief) AND CV-writer style.

---

## 7. WhatsApp interview flow

### With CV uploaded
6 quality signals interview, ~9 exchanges:
1. Quantified impact (numbers)
2. Scope of responsibility (scale)
3. A real challenge (resilience)
4. Career progression logic (story)
5. Evidenced skills (proof)
6. Hidden gem (always asked last)

### Without CV uploaded
Two-phase, ~13-17 exchanges:
- **Phase 1** (~7-9 exchanges): build work history role-by-role + education + certifications + languages
- **Phase 2** (~6-8 exchanges): the 6 signals across captured roles

At `[DONE]`:
- Language proficiency assessment (CEFR + IELTS equivalent + English level)
- Chat-to-profile extraction (no-CV path only — populates the structured profile)
- CV language picker fires
- Email confirmation sent

### Candidate commands (intent-handled by Claude)
- `"skip"` / `"next"` — move on
- `"repeat"` / `"what was the question"` — re-ask
- `"start over"` / `"restart"` — wipes chat, fresh interview
- `"I'm done"` — wrap up if 3+ signals covered
- `"I don't know"` — reassure, move on
- Voice notes work in any language (Deepgram auto-detects, Claude responds in same language)

### Language handling
- Detects what language candidate writes in → responds in same language
- If candidate writes in a language NOT on their CV → asks "I see Croatian, Italian, English on your CV — should I add [Spanish] to your spoken languages?" → adds on confirm
- Catches CV parsing errors (e.g. Croatian misdetected as Ukrainian) via the same flow

---

## 8. References flow (Pro tier)

### Structure per candidate (with discretion-protection)
- **1 current-role peer reference** (colleague — NOT current manager — protects candidates job-hunting discreetly)
- **2 past-role manager references** (smart-picker chooses the most relevant roles based on target industries; candidate can override)

### Chain per past manager (blind nominees)
Manager replies → Claude asks reference questions on WhatsApp → at end, manager nominates:
- **1 colleague** (someone who worked alongside the candidate)
- **1 stakeholder** (client / cross-functional partner the candidate worked with)

Shapi contacts those 2 nominees independently. Candidate never sees who or what they said.

### Channels
- WhatsApp first (with "*Just reply to this message*" invite — Claude conducts Q&A)
- Email always sent in parallel (web form link as fallback for referees who prefer typing)
- Voice notes + any language supported throughout

### AI cross-check (after all references done)
Claude analyses all reference responses + candidate's CV → produces Verification Report:
- `claims_verified` — skills/achievements multiple referees confirmed
- `claims_unverified` — candidate-stated claims with no referee corroboration
- `conflicts` — where referees disagreed (surfaced as "perspectives differ" to companies)
- `top_skills` — most-cited skills across references
- `tone_summary` — overall sentiment
- `summary_en` — 2-3 sentence elevator pitch for hiring managers

If conflicts == 0 → Premium Verified badge.

### Test mode
- Checkbox on `/profile/references` routes ALL outreach (manager + auto-cascaded colleague + stakeholder = up to 7 messages per chain) to the candidate's own phone & email
- Lets the founder/QA play all 3 roles + validate the full chain without real contacts
- Cascades automatically to nominees

---

## 9. Profile completion math

`CV parsed (25%) + WhatsApp interview (25%) + CV Kit purchased (25%) + References bonus`

References bonus (tiered):
- 0 of 2 jobs verified → 0 → **75% total**
- 1 of 2 jobs verified → +10 → **85% total**
- 2 of 2 jobs verified → +25 → **100% total + profile_live=true**

---

## 10. Tech stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Plus Jakarta Sans
- **Auth**: Supabase Auth (@supabase/ssr)
- **Database**: Supabase Postgres
- **Hosting**: Vercel
- **Email**: Resend (sending from hello@shapi.io)
- **Payments**: Stripe (live + test mode toggle via `STRIPE_MODE` env)
- **AI conversations + CV writing**: Claude API (model `claude-sonnet-4-6`)
- **Voice transcription**: Deepgram (Nova-2, auto language detection)
- **WhatsApp**: Twilio WhatsApp Business
- **CV file parsing**: Claude Vision (PDF document support)
- **Storage**: Supabase Storage (planned for voice samples)

---

## 11. Pages map (candidate side)

| Path | Purpose | Tier |
|---|---|---|
| `/` | Homepage + waitlist | Public |
| `/signup`, `/login` | Auth | Public |
| `/upload-cv` | CV upload or "no CV needed" entry | Auth required |
| `/cv-builder` | Conversational CV builder via web (alternative to WhatsApp) | Auth |
| `/onboarding` | 5-step manual profile form (skip-CV path fallback) | Auth |
| `/dashboard` | Main candidate dashboard — % complete, status, next actions | Auth |
| `/profile` | Public-style profile view of own data + verification badge + radar + sections | Auth |
| `/profile/edit` | Edit everything: identity, languages, work history, links | Auth |
| `/profile/print` | Print-ready CV (any language via dropdown, save-as-PDF) | Kit/Pro |
| `/profile/references` | Submit references, see status, test mode toggle | Auth (Pro for chain) |
| `/cv-ready` | After-purchase landing — multi-language CV download buttons | Kit/Pro |
| `/pay`, `/pay-success` | Payment flow + post-checkout polling page | Auth |
| `/evidence` | Photo/document evidence uploads | Auth |
| `/roles` | Open Roles Board — browse + express interest in active roles | Roles Board |
| `/active` | Shapi Active — job scanner, applications, interview prep | Active |
| `/reference/[token]` | Public referee form (web fallback when they don't reply on WhatsApp) | Public via token |
| `/p/[id]` | Public profile (companies see this version) | Public |

---

## 12. Build status — shipped

- ✅ Auth + signup + onboarding
- ✅ CV upload + Claude PDF parsing → structured profile
- ✅ "No CV" path → deep WhatsApp interview → chat-to-profile extraction (so profile ends up equivalent)
- ✅ WhatsApp interview with 6 signals (CV path) / two-phase (no-CV path)
- ✅ Voice notes in any language (Deepgram auto-detect)
- ✅ Industry detection + 10 rich industry briefs
- ✅ Skill Quadrant (Hands/Heart/Head/Spark) extracted on parse, displayed on profile
- ✅ Continuous Learning section (certifications/events/talks/OSS/courses)
- ✅ Multi-language CV picker (one button per language candidate speaks)
- ✅ CV Kit / Pro Stripe checkout + post-payment polling page
- ✅ Stripe test-mode toggle (STRIPE_MODE env)
- ✅ Pre-generated cached English CV (instant on first load)
- ✅ Translation fast-path for non-English (avoids 60s timeout)
- ✅ Send CV to WhatsApp + email (direct print-page links per language)
- ✅ References flow (request → submit → cascade → webhook Q&A)
- ✅ Reference WhatsApp Q&A (Claude conducts conversational interview)
- ✅ Reference responses stored in BOTH source language + English translation
- ✅ Smart-picker (Claude chooses best 2 reference roles based on target industries)
- ✅ Peer reference for current role (discretion-protected)
- ✅ AI cross-check (Verification Report generated after refs)
- ✅ Verification tier badges (Basic / Strong / Premium)
- ✅ Career Roadmap (AI resilience + skills gaps + pivot paths + events) — Pro
- ✅ Test mode for references (all outreach routes to candidate)
- ✅ Profile + dashboard tier-aware UI
- ✅ CEFR / IELTS hover tooltips
- ✅ WhatsApp intent handling (skip / repeat / start over / done / "I don't know")
- ✅ Dashboard tips card (WhatsApp commands surfaced)

## 13. Build status — TODO (open tasks)

1. **Stripe SKU split** — 5 distinct products: Kit / Pro / Roles Board / Active / Concierge / Bundle (currently Pro covers it monolithically). Add `subscription_product` column for tier-aware gating.
2. **AI Auto-Outreach Concierge tier** — daily scan + draft + approval queue + auto-send opt-in
3. **Employer prestige overlay** — Gartner MQ / Forrester Wave / G2 manually-curated dataset on role cards
4. **JD-via-WhatsApp** — same conversational extraction for hiring companies posting roles
5. **Voice samples per language** — capture + store voice notes, gated playback per company tier

---

## 14. Key environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
ANTHROPIC_API_KEY
DEEPGRAM_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
NEXT_PUBLIC_SITE_URL=https://shapi.io

# Stripe (toggle test/live via STRIPE_MODE)
STRIPE_MODE=test         # or 'live' / unset for live
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_SECRET_KEY_TEST
STRIPE_WEBHOOK_SECRET_TEST
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

---

## 15. SQL migrations applied (in order)

1. `profiles.sql` — base profiles table
2. `profiles_v2.sql` — WhatsApp + CV upload columns
3. `profiles_v3.sql` — subscription fields
4. `profiles_extend.sql` — consolidates ad-hoc additions (languages, CV state, industry chats, native lang)
5. `references.sql` — base references table
6. `references_extend.sql` — full reference chain spec (ref_type, job_slot, nominees, status widening)
7. `references_v2.sql` — peer ref_type + verification tier + AI cross-check report
8. `skill_quadrant.sql` — skill_quadrant + continuous_learning on profiles + roles
9. `career_roadmap.sql` — ai_resilience_score + career_recommendations
10. `evidence.sql` — work evidence uploads
11. `jobs.sql`, `matches.sql`, `waitlist.sql` — supporting tables

All idempotent (`ADD COLUMN IF NOT EXISTS`).

---

## 16. Contact

- Email: ana.vbarber@gmail.com
- WhatsApp KSA: +966 502506355
- Repo: https://github.com/CRYSTALAX25/Shapi
- Live: https://www.shapi.io
