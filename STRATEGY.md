# Shapi — Strategy, Ideas & Decisions

> Living doc — capture everything here so we don't lose ideas. Last updated **21 May 2026**.
> Sister docs: **COMPETITORS.md** (pricing/model comparison), **BACKLOG.md** (deferred features), **BRAND.md** (visual kit).
> Status tags: **[LOCKED]** = decided · **[RECOMMENDED]** = my advice, awaiting Ana's final yes · **[IDEA]** = on the table, not decided.

---

## 1. Positioning — the wedge
**"The verification layer for hiring."** Independent references + AI cross-check + two-sided
trust, in a candidate-owned portable verified profile. MENA-first, blue + white collar,
WhatsApp/voice-native. Do **not** market as "first at AI/voice" — that's table stakes (see
COMPETITORS.md). Sell trust, not chat.

---

## 2. Pricing & business model

### Decisions
- **[LOCKED] Payment model = Facilitator (not middleman) at launch.** Employer pays the worker
  directly. Shapi charges the *company* (subscription + later a small placement) via Stripe.
  No payroll / WPS / fund-holding / licensing. Worker confirms "I was paid" → feeds the
  **company trust score** (keeps the "paid on time" promise without us holding wages).
- **[LOCKED] Subscription-first**, monthly/yearly, billed upfront — so we operate on dependable
  recurring revenue and never "chase" placement money (Ana's Essential Staff scar).
- **[LOCKED] Launch pricing (companies)** — live on site + Stripe (2026-05-21):
  - 30-day **free trial** (`trial_period_days: 30`), then **Starter $299/mo · Growth $799/mo ·
    Enterprise Custom**.
  - **Founding Partner offer:** **50% off for 3 months** ($149 / $399 for 3mo), shown with
    standard price struck through (anchoring). Implemented as a Stripe coupon `founding50_3mo`
    (percent_off 50, repeating 3mo) applied on the standard price, so it auto-reverts. (Was
    12mo; shortened to 3mo on 2026-05-21 — base price is already very low.)
  - **No placement fee at launch** ("no placement fees, no per-hire costs").
  - ⚠️ The "first 25 companies" cap is currently **marketing framing only** — the coupon is
    applied to ALL company checkouts during the founding period. Add a real cap (count check)
    or retire the coupon when we want to stop offering it.
- **[RECOMMENDED] Candidates:** free to start; keep CV Kit $25 / CV Pro $59 one-time, but
  **comp the Pro fee for the founding / friends-&-family cohort** to seed candidate supply
  (subsidize the scarce side of the marketplace).
- **[RECOMMENDED] Placement fee = Phase 2.** Once there are real placements + proof, add a
  **small ($500) placement fee for NEW company cohorts only.** Never raise price on early
  believers — grandfather them. Framing: "we win when you win."

### Go-to-market pricing psychology (why)
1. One simple value exchange at launch — not subscription + placement at once (reads greedy).
2. Free trial removes risk for an unproven brand ("I'll try it" beats "is it worth it?").
3. Subsidize the scarce side (verified candidates); companies pay to reach them.
4. Scarcity + status (Founding Partner) beats generic discounting.
5. Grow by charging *new* cohorts more; never punish early adopters.
6. A high subscription with no proven ROI is the hardest sell for an unknown — fair
   subscription + later small success fee feels aligned with the trust brand.

### The leakage / bypass problem (companies poaching candidates to dodge the fee)
Fix structurally, not by chasing — four layers:
1. Keep any placement fee **small** so dodging isn't worth the effort/relationship risk.
2. **Gate + log first contact through Shapi** (timestamped intro = proof it came from us).
3. **Candidate-confirmed hires** — the candidate reports "I started at X" (motivated: it adds
   a verified job to their profile; can be rewarded). Two-sided confirmation kills most leakage.
4. **No-circumvention clause** in company ToS as the legal backstop.

---

## 3. Temp + Perm
- **[RECOMMENDED] One account, modular.** The verified candidate pool is the shared asset both
  use. Perm-only company → base plan; needs shift workers → add the **Temp / "Shapi Shifts"**
  module/tier; most want both → bundle. Don't split into two products/brands.
- **[LOCKED-ish] No per-hour margin** (Ana's call). Temp = **subscription access to available
  verified workers**, not an hourly markup. Keeps it simple, no payroll.
- **[IDEA] "Available now" toggle** for shift workers → near-instant booking (Uber-like).
- **[IDEA / Phase 2] Become the payment rail for temp** once shift volume justifies it (high-
  frequency small payments are where workers most fear non-payment; controlling money kills
  leakage). Likely via an EOR / payment partner, not built in-house.

---

## 4. Engagement / UX mechanics
- **[IDEA] Drop swipe** (dating-app yes/no) — fatigued and trivializes a professional decision.
- **[IDEA] Verified mutual intro** — company "requests to meet" → candidate sees the company's
  **trust score first** → both opt in → instant WhatsApp intro, no application. (J&J's
  no-application magic, but two-sided + verified.)
- **[IDEA] Profile-strength gamification** (completion %, "viewed by a verified company" nudges).
- **[IDEA] Communication layer**: once matched, in-app + WhatsApp-native messaging with verified
  context attached, interview scheduling, voice notes, trust score visible. Possibly AI-mediated
  intros (Shapi drafts, both confirm).

---

## 4a. Intent, salary & responsiveness — the engagement trust layer [IDEA, added 2026-05-21]
The unifying concept: **apply the "claims, then proof" trust model to engagement, not just
credentials.** Self-reported intent, verified by behaviour. Strong fundraising line:
*"We don't just verify who you are — we verify how you actually show up."*

- **Active / Passive intent (both sides).**
  - Candidates: *Actively looking* / *Open to offers* (passive) / *Not looking*. Passive-but-open
    are the most desirable to companies; the signal also sets outreach tone + response-time
    expectations.
  - Companies: *Hiring now* / *Building pipeline*.
  - ⚠️ Naming: "Shapi Active" is already a paid candidate product — use plain status labels for
    intent, NOT "Active/Passive", to avoid confusion.
- **Salary (currently captured nowhere — gap).**
  - Candidate salary expectation: captured, **private by default** (matching only / shown to
    matched companies or as a band).
  - Role: encourage/require a **salary range**; transparency boosts the company's trust signal,
    hiding it lowers it ("ghost salary" ≈ ghost job). "Salary as advertised" = a verified trust
    signal alongside "paid on time".
  - UAE nuance: capture **total package** (base + housing + transport, tax-free), not just base.
  - Position salary as *transparency* (trust), not the headline — match on salary fit so we never
    show mismatched pairs.
  - **[IDEA] "What you're worth" benchmark** (like Jack & Jill's free Salary Benchmark tool).
    Free top-of-funnel magnet (SEO + lead gen) that shows a fair band by role/level/location and
    **auto-suggests the candidate's salary bands** (fixes awkward self-pricing). Our edge:
    benchmark against **verified** data + our placement outcomes (the moat), and make it
    **pivot-aware** — "proven field worth $X; pivot field at your stage worth $Y" (nobody does
    this). v1 = AI/market estimate, clearly labelled, "gets smarter as our verified data grows";
    proprietary comp dataset builds over time from placements. Status: [LATER] for launch is fine
    — captured per-track expectations already shipped.

## 4b. Company-side flow & two-sided interview prep [IDEA, added 2026-05-21]
Vision (Ana): **match → WhatsApp convo starts → interview booking → interview prep**, with prep
sent to BOTH sides.
- **Two-sided interview prep is differentiated** (most platforms prep only the candidate):
  - Candidate gets: company brief + trust score, likely questions, what to emphasise (from their
    verified profile).
  - Hiring manager gets: a **candidate brief from verified data** — verified strengths, reference
    highlights, suggested probing questions (incl. areas the AI cross-check flagged), and the
    salary band. Higher-signal interviews, saves manager prep time, uses the moat.
  - Privacy: share the cross-check *summary* + suggested questions, never referee verbatims/identities.
- Flow built WhatsApp-native; booking via simple slots/scheduling. Sequence this into the company
  build (after JD-via-WhatsApp + dashboard). See BACKLOG.md.
- **In-platform interview booking + "Join call" buttons** (Google Meet / Zoom / Teams) — keep
  everything in Shapi (controls relationship + data, powers responsiveness tracking, reduces
  leakage). Don't build video infra — generate/attach the client's preferred meeting link
  (calendar API later; manual/generated link now) and show a "Join" button to both at the right
  time. Skip FaceTime (Apple-only) — use a generic "video link". This is the "more software than
  app" direction Ana wants.

## 4c. Pipeline, job health & two-sided feedback [IDEA, added 2026-05-21]
The hiring loop, kept inside Shapi so we always know what's going on:
- **Candidate pipeline stages per role:** Matched → Shortlisted → Interviewing → Offer →
  Hired / Passed. Moving a candidate triggers the right thing (booking at Interviewing, prep
  docs, feedback capture, and at Hired → the candidate-confirmed-hire that closes the
  leakage loop). Needs an `applications`/pipeline table (candidate_id, role_id, stage, history).
- **Two-sided post-interview feedback (required):** after each interview BOTH sides submit a
  quick rating + short notes + "move forward? y/n". This is the data that tells us what's
  happening, and it feeds the **company trust score** (candidate-reported) and **candidate
  reliability** (company-reported). Needs an `interview_feedback` table. [SHIPPED — in-app, both sides]
  - **[IDEA] Collect it over WhatsApp too** (both candidate AND hiring manager), on-brand with
    Shapi's WhatsApp-native flow: after the interview time passes, Shapi messages whoever has a
    WhatsApp number connected — "How did the interview go? Reply 1–5 and would you continue?" —
    and we parse the reply (reuse the reference/webhook parsing). Also enables pre-interview
    reminders. Depends on the Twilio upgrade (trial 50/day cap). In-app forms work now.
- **Job timestamp + health / ghost-job signal:** show "posted X days ago" on the company role
  view (roles already store created_at). If a role sits open too long with low engagement
  (e.g. >21 days, few shortlists/interviews), flag it and **Shapi proactively follows up** —
  "this role's been open 3 weeks with low interest; common fixes: salary below market, JD too
  narrow, must-haves too strict — want help?" On-brand with the ghost-job/health
  differentiator (core diff #7) and a strong retention touch (later an actual outbound message).
- **Responsiveness & follow-through tracking (both sides).**
  - Track time-to-reply, ghost/no-show rate, and behaviour vs stated intent (e.g. "actively
    looking" but ignores all matches → not really active; downgrade/nudge).
  - Feeds a **candidate reliability score** + **company responsiveness score** → badges like
    "Replies in ~1 day" / "Responds to 90% of candidates". Ghosting is the #1 two-sided
    complaint; nobody surfaces this today.
  - Connects to intent: behaviour *validates* the self-reported active/passive status.

## 4d. "Be first" differentiators to build [IDEA, added 2026-05-23]
Features that make Shapi *first*, not just present. Build these to widen the moat:
1. **Verification Passport** — turn the AI cross-check into a *portable, candidate-owned*
   verified identity: a shareable "Verified by Shapi" score/badge the candidate reuses across
   employers (QR/short link, re-verifiable). Closest thing to a true first — nobody owns
   candidate-side portable verification. [HIGH]
2. **"Salary as advertised" verification** — confirm companies actually pay what the role
   advertised (hired candidate confirms) → feeds the company trust score. Nobody does this; it
   pairs with "paid on time". [HIGH]
3. **All-WhatsApp two-sided hiring loop** — JD intake, CV building, interview booking + reminders,
   and post-interview feedback all over WhatsApp, for MENA blue+white collar. A genuine regional
   first. Needs the Twilio upgrade. [HIGH, gated on Twilio]
4. **Engagement trust layer** — responsiveness + follow-through scoring (time-to-reply, ghost
   rate) feeding candidate reliability + company responsiveness. "We verify how you show up."
   See [[strategy-docs]] §4a. [MED]
5. **Pivot-verified career transition** — verified transferable-skills credentialing for
   AI-displaced workers (build on the roadmap + /worth pivot bands). [MED]
6. **Two-sided verified interview prep** — manager brief shipped; extend with the candidate-side
   prep + make it the signature pre-interview artifact. [MED]

## 5. Tech moat
- The **data** is the moat, not the features. Every independent reference, cross-check, company
  rating, and **hire outcome** (did they stay? how rated?) is proprietary → trains a real
  fit/quality model nobody else has. Close the loop.
- WhatsApp-first infra for emerging markets; right-to-work intelligence per country; voice +
  native-language capture.

---

## 6. Enterprise / API / white-label
- **[LOCKED] API is private, Enterprise-only** — NOT a public/open API. Enterprise = private API
  access + ATS integration + bulk verification + white-label + custom SLAs.
- **[DECISION] White-label to recruitment agencies = Phase-2/3 expansion revenue, NOT the launch
  wedge.** Ana raised selling Shapi as white-label software to recruiters. It's lucrative and
  real, but:
  - Lead with the **marketplace** — it's the venture-scale, defensible, fundable story and keeps
    the data moat in ONE network (Shapi). White-labeling fragments the verified-data network
    across tenants and turns us into a tooling vendor.
  - Recruiters are partly who Shapi disrupts; selling them picks-and-shovels is smart *later*,
    once the verification engine is proven.
  - Investor framing: "marketplace now (owns the moat), white-label / private API as expansion
    revenue later." White-label already lives in the Enterprise tier — consistent.
  - Build to a **B2B software quality bar** regardless (reliable, clean) — it makes both the
    marketplace and a future white-label viable. ("More software than app" is the right mindset.)

---

## 7. Fundraising narrative
Investors fund **wedge + data moat + frequency engine**. Shapi's story: *"The verification
layer for hiring — a candidate-owned, portable verified identity,"* wedged in **MENA, blue +
white collar, WhatsApp-native**, expanding from once-a-year perm into high-frequency temp
(retention). The moat is the proprietary outcome data. Two-sided network effects.

---

## 8. Open questions / to decide
- Final greenlight on launch pricing (free trial + Founding Partner + comp candidate fee)?
- Exact Founding Partner discount + cohort size.
- When to introduce the Phase-2 placement fee (trigger: # of placements?).
- Shifts module pricing (separate tier vs add-on vs bundle).
- Engagement mechanic: build the verified-intro flow for launch, or post-launch?

## 9. Next steps (build queue, once decided)
- Apply launch pricing to homepage + `/company/pricing` (free trial, Founding Partner anchors,
  remove placement fee for now, "private API — Enterprise").
- Then: company side (JD-via-WhatsApp, dashboard, matching) per the candidate-first → company
  sequence. See BACKLOG.md.
