# Shapi — Post-Launch Backlog

Everything discussed but deliberately deferred until after the **2 June 2026** friends & family launch. Candidate side is being finished first, then company side.

## Verification / trust (the moat)
- **ID + Right-to-Work KYC** — upgrade the self-declared right-to-work to **✓ verified** via a document-checking provider (Onfido / Persona / Sumsub). Sensitive-document handling = data-protection obligations. Potential paid/premium trust layer + revenue line (employers pay for verified-RTW candidates).
- **Cognitive / aptitude tests (verified)** — integrate a proctored provider (TestGorilla / Criteria / SHL) so aptitude scores are real credentials, not gameable self-tests. Until then, only offer aptitude as *practice* (clearly not employer-facing).
- **Course/cert auto-verification** — actually fetch & validate credential URLs (Coursera/Udemy/Credly) rather than trusting a pasted link. Currently: link present = verified-tier.
- **Verification tier auto-recompute** — daily job to refresh stale candidates (currently only recomputes on reference completion).

## Upskilling flywheel
- **Shapi-facilitated courses** — partner/affiliate with platforms so courses taken *through Shapi* auto-verify on completion (the real ✓ Verified loop + revenue share).
- **Company-sponsored courses** — when a candidate is hired through Shapi and the employer funds upskilling, show "🏢 Sponsored by <Company>" (data model + badge already built; needs the placement + company-billing flow).

## Company side (the whole other half — post candidate-side)
- **JD-via-WhatsApp review UI** — `/company/roles/[id]/edit` polish + publish, and the WhatsApp ↔ dashboard "edit this draft" round-trip (extraction skeleton already shipped).
- **AI Concierge outbound** — delivery worker to send approved drafts (Resend/Twilio) + daily Vercel cron (`/api/concierge/scan?all=1`). Queue + scanner + approval + dashboard card already shipped.
- Company dashboard, matching engine polish, trust score, ghost-job detection.

## WhatsApp / infra (pre-launch must-do, tracked here so it's not lost)
- **Upgrade Twilio from trial → paid** (removes 50/day cap) AND move from sandbox to a registered WhatsApp Business sender. See memory: twilio-config-followups.
- Keep inbound webhook on `https://www.shapi.io/...` (apex 307-redirects and drops messages).

## Candidate-side fast-follows
- **Work-style self-assessment** — optional questionnaire → Work Style profile card (◆ Shapi-assessed). [shipped]
- **Profile image + right-to-work** — [shipped]
- Voice samples capture, WhatsApp CV editor, no-CV path — built, need live testing once Twilio is upgraded.
- **Career Roadmap first-steps — tick-as-done + progress tracking.** Right now first-steps have contextual links (course step → /upskill, role step → /roles) but no per-step completion state. Add checkable steps with persistence so candidates can mark progress on their action plan (and we can nudge/celebrate completion).
- **URL-link evidence** — let candidates attach live links (portfolio, published work, their own sites like Shapi/Crystalax) alongside file uploads in the evidence section.

## Pricing / packaging (revenue)
- Verified-RTW and verified-aptitude as premium add-ons employers pay for.
- Upskilling affiliate/revenue share.

## Employee-facing access (Org Spine / HR portal) — decision 2026-06-12
Decision (Ana, 2026-06-12): **no full employee login portal for launch.** Today employees are `persons` rows (not auth users) and touch Shapi only via (a) seat-confirm magic links and (b) WhatsApp leave logging. The `/company/people/[personId]` "HR portal" is a manager/HRBP view, not employee self-service.
- 🆕 **Light employee "my page" (magic-link, read-only)** — extend the existing magic-link pattern so an employee can tap a no-password link and see their own profile, leave balance, OKRs and verification status. Phone-first, PDPL-friendly, low build. **Build next, post-launch.**
- ⏸️ **Full employee self-service portal w/ login** (leave requests, OKR check-ins, profile edits) — deferred. Larger build; revisit once the light page proves demand.

## PIP / Separation comms — decision 2026-06-12
Decision (Ana, 2026-06-12): manager's life made easy via **pre-filled, EDITABLE template + one-tap actions** on the lifecycle program card: **Copy**, **Send via Shapi** (Resend, logged to the audit trail), **Add to calendar** (.ics / Google Calendar link — no OAuth). Legal wording stays static/vetted (never AI-drafted).
- ⏸️ **Deep calendar integration** (Google/Outlook OAuth two-way scheduling) — deferred; the .ics/Calendar link covers launch.

---

# Career-pivot ecosystem — build roadmap (from the 25 May 2026 brand/feature brainstorm)

Decision (Ana, 2026-05-25): **build these, not defer** — sequenced around the 2 June test. Bug audit done first; candidate flow confirmed safe. Legend: ✅ have · 🟡 partial · 🆕 new.

## Positioning anchor (LOCKED)
- **Cross-collar career navigator for the AI era.** Shapi = "Shaping" + Polaris (North Star). Mission: turn AI anxiety into career agility. The white space competitors miss (FutureFit=B2B/gov, Noxx/Fabric=white-collar tech only, trade boards=static): a **consumer, two-way, blue↔white, all-in-one** map + courses + local jobs + business-starter.
- **Two tracks (LOCKED):** **Pivot** (high-AI-risk roles → guide *out* into growing fields) vs **Shield** (resilient trades e.g. plumber/electrician/HVAC = "AI-Proof Asset" → *level up* within trade + protect earnings, don't push them out). The roadmap engine must branch on this. Plumber ≠ someone to "save".
- **Cross-collar is two-way but asymmetric:** White→Blue (burnout/AI/tangible) is common; Blue→White only into *specialised* roles that need the trade knowledge (estimator, technical sales, safety inspector, trainer) — never generic admin. Win by industry-*adjacent* moves, not total restarts.

## Tier 1 — build before / around launch
- 🆕 **Career Translator** — From [current role] → To [target role] screen: **salary dip + 3-yr forecast**, recommended roadmap with **course durations**, Pivot-vs-Shield branch, "Find an employer" vs "Open my own business" CTAs. Flagship. (We have pivot_paths + /worth + upskill — assemble into one tool.)
- 🆕 **Course durations + study-pace tracks** — show ⏱️hours + 📅weeks at chosen pace; toggle **Sprint / Steady / Bite-size**. Removes "back to school" fear.
- 🆕 **Pivot vs Shield in the roadmap** — branch the career-roadmap prompt/UI so resilient trades get "level-up/protect" not "pivot-out"; award **"AI-Proof Asset" badge** for low-risk trades.
- 🆕 **AI-Proof Status Report (lead magnet)** — public/free: input job title (or CV) → automation-risk + preview of 3 fastest pivots; full timeline/courses gated behind free signup. Growth engine for first 1,000 users.

## Tier 2 — fast-follow
- 🆕 **"Ask Shapi" concierge** — persistent in-app AI chat on every page, drawing on internal data (salary, courses, business steps, country-specific). We have WhatsApp + cv-builder chat; this is on-platform + omnipresent.
- 🆕 **Entrepreneurship blueprint** ("Open my own business") — country-agnostic: licensing check, **pricing calculator** ((labour+materials+overhead)×margin), customer-acquisition steps. Ask-Shapi answers country specifics.
- 🆕 **Adaptability Score** — how fast a candidate learns (course completion speed + engagement); surface on company-facing profile alongside Verified Human Skills.
- 🟡 **Smart Course Wallet** enhancements — **like/save** courses; explicit **cost tiers: Free / Paid / Subsidised (Government-location-driven · Employer-sponsored-job-driven)**; (we already have links + free/paid/financing + cert-link verification + tracked courses + sponsored_by badge).
- 🆕 **Employer ping on course completion** — when a candidate verifies a cert matching an open role, notify the employer ("X just completed Y — review now"). Ties course wallet → matching.
- 🆕 **Train-to-Hire tag + "Pivot Jobs" filter** — employers flag roles accepting transitioning workers w/ on-job training; candidates toggle a pivot-friendly view.

## Tier 3 — polish / retention / brand
- 🆕 **Shapi mascot persona** — name the North Star **"Shapi"** as the guide voice; taglines "Find your true north" / "Shape your next horizon". Mascot direction being picked at `/mascot`. Weave Shapi voice into onboarding, match alerts, celebrations (shooting-star on interview booked).
- 🆕 **Welcome email sequence** (3-part, Shapi-voiced) — Day 0 welcome + Skill Shape-Check; Day 2 pivot map; Day 5 social proof + who's hiring.
- 🆕 **Constellation progress tracker** — gamified milestone path (profile → references → interview) lighting up stars; "Star Fragments" for course completion.
- 🆕 **Cert OCR auto-verification** — OCR uploaded certificate (name/title/date) to auto-award the verified badge (currently manual link-presence). Overlaps existing "course auto-verification" backlog item.
- 🆕 **Native "Cross-Collar Transition Guide"** micro-course (3 modules) — only if we move beyond curating external links to hosting content.

## Go-to-market (not code — for the launch plan)
- **Hyper-local first** for marketplace liquidity: one metro with both corporate + construction density; Month 1 onboard 15–20 trade employers (free 6-mo posts, accept pivot candidates); Month 2 open candidate supply; Month 3 case studies → adjacent cities. (NB current plan is UAE-first / friends & family 2 June.)
- **Viral hooks:** "Desk burnout vs trade security" split-screen reels; "skill translation myth-buster" posts; Employer-paid Upskilling Bounty ("study 5h/wk for a month → guaranteed interview with [Employer]").

## ⏸️ Deferred — discuss AFTER launch (pushback, 2026-05-25)
Ana agreed (2026-05-25) to ship GOLD+GOOD and park these; revisit post-launch. Reasons in brackets.
- **Cert fraud-forensics** — OCR of certs, PDF metadata/hash fingerprinting, "edited in Canva/Photoshop" detection, public-registry scraping. [Rabbit hole; our "paste a public credential URL → verified + manual spot-check" model is enough until there's volume + a real fraud problem.]
- **Native LMS / hosted courses** (incl. the 3-module "Cross-Collar Transition Guide"). [We're the curator+verifier — don't become a course platform. A light Shapi-voiced article is fine, not an LMS.]
- **Employer-pays-course-via-Shapi-API billing** + locked course links. [Complex external billing integration; a "Sponsored by X" label + manual arrangement covers launch.]
- **Global government-grant parsing engine / voucher codes.** [Worldwide grant data = maintenance nightmare; hardcode a couple of UAE/KSA programmes, let Ask-Shapi answer the rest.]
- **Adaptability Score (learning-speed metric).** [Needs months of usage data we won't have at launch — showing it now = fabricated; hurts the trust moat. Revisit once there's real engagement data.]
- **Constellation gamification / Star Fragments / 3D Pixar mascot render.** [Lovely, not launch-critical; SVG mascot is plenty.]
- **Copy guardrail:** avoid absolute claims ("0% AI risk / 100% AI-proof") — say "high resilience / low automation risk." [Overclaiming undercuts the verification brand.]
