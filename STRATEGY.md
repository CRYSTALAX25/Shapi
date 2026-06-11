# Shapi — Strategy, Ideas & Decisions

> Living doc — capture everything here so we don't lose ideas. Last updated **26 May 2026**.
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
- **[LOCKED — v5, 2026-06-10] Company pricing (4 tiers + Bespoke).** Supersedes the
  Starter/Growth $299/$799 and the v4 3-tier scheme. Decided with the Commercial Director
  after the $499→$2,500 cliff analysis:
  - **Free** — generous *through launch* (the free Workforce Readiness Score is the top-of-funnel
    magnet, never gated), then **metered ~60–90 days post-launch** to 1 Snapshot + score with
    everything downstream teased. Protects the "intelligence has value" narrative.
  - **Pro $499/mo** — self-serve, 14-day card-required trial.
  - **Growth $1,500/mo** 🆕 — bridges the 5× cliff. Full diagnostic suite + Active Hiring +
    candidate pool. Captures the 200–600-person UAE family-business / PIF-survivor reorg buyer
    who is too big for $499 but not ready for sales-led Enterprise. (Competitor stacks already
    cost them $3–6k/mo.)
  - **Enterprise $2,500–5,000/mo** — sales-led, banded by workforce envelope (NOT per-seat;
    per-seat revenue mechanically shrinks in a restructuring market). Unlocks the moat: HR-OS,
    Company Brain, Skill Density, immutable audit trail.
  - **Bespoke Transformation $15–25k** one-off — door-opener that converts into a recurring
    Enterprise subscription.
  - **Enterprise POC $3–5k, fully creditable to year 1** — paid diagnostic Snapshot wedge;
    qualifies the buyer, funds delivery, anchors the annual figure.
- **[LOCKED — v5] Value metric = workforce decisions defended, not seats managed.** Charge
  against coarse workforce bands at Enterprise; flat tiers below. Revenue rises when a customer
  restructures — exactly when legacy per-seat HR tools' revenue falls.
- **[LOCKED — v5] Founding Partner offer.** First **15 companies**, **50% off their first paid
  tier (Pro or Growth) for 6 months**, then auto-reverts; early believers grandfathered against
  future price rises. Status-led (Founding Partner badge + founder access + roadmap input).
  ⚠️ MUST make the cohort cap a **real count check** before 2 June launch — today's "first 25"
  is marketing framing only (coupon applies to all checkouts and never stops).
- **[LOCKED — v5] Candidates** — free to start; verification ALWAYS free (it's the scarce-side
  asset). Collapse the 8-SKU sprawl to: **Free → CV Kit $25 → CV Pro $59 → Active $29/mo →
  Concierge $89/mo + Profile Boost $29**. Bundle ($39) killed; Roles Board ($19) merged into
  Active. Fix the live bug where Concierge charges $79 instead of $89. **Comp the CV Pro fee for
  the founding / friends-&-family cohort** to seed verified supply.
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

---

## 10. AI / infra cost model — for the P&L (captured 2026-05-25)

> **Estimates only**, based on approx public Anthropic rates. Watch live spend in **Anthropic Console → Usage**. Re-check rates before finalising the P&L.

**Per-token rates used (per 1M tokens):** Sonnet 4.x ≈ **$3 in / $15 out** · Haiku 4.5 ≈ **$1 in / $5 out** · Web search ≈ **$10 per 1,000 searches (~$0.01 each)**.

**Models per feature:** Sonnet = CV parse, WhatsApp interview, Career Roadmap, Career Translator, reference cross-check/Q&A, JD generation, salary benchmark, Concierge drafting, **Business blueprint (+ web search)**. Haiku = **Ask Shapi**, **AI-Proof check**.

**Approx cost per action:**
| Action | Model | ~cost |
|---|---|---|
| AI-Proof check · Ask Shapi (per msg) | Haiku | ~$0.005 |
| Career Translator · salary benchmark · JD generation | Sonnet | ~$0.02–0.03 |
| Career Roadmap · CV parse | Sonnet | ~$0.04–0.05 |
| Business blueprint (+3 web searches) | Sonnet | ~$0.08–0.12 |
| Full WhatsApp interview (many turns) | Sonnet | ~$0.20–0.40 |
| Concierge daily scan + drafts (per subscriber/day) | Sonnet | ~$0.03–0.06 |

**Monthly scenarios (Claude only):**
- Friends & family (~30 active): **~$5–25/mo** (negligible).
- ~300 active candidates + some Concierge subscribers: **~$100–300/mo**.
- Per-candidate lifecycle AI cost is **well under $1–2** → a single **Pro ($59)** or **Concierge month ($79)** covers many users. Margins healthy.

**Biggest cost drivers (already mitigated):** WhatsApp interviews (many Sonnet turns) · daily Concierge scans (Sonnet per subscriber/day) · Business web-search. Levers: Haiku for cheap tasks (done) · web-search capped at 3 (done) · cap Concierge frequency · shorten interview turns.

**Other recurring infra for the P&L:**
- **Vercel** — currently Hobby. **Pro ≈ $20/mo** is effectively required pre-launch (longer function timeouts for the AI tools + reliable crons).
- **Twilio** (WhatsApp) — trial now; paid sender + per-message fees at launch (per-country WhatsApp conversation pricing).
- **Resend** (email) — free tier covers low volume; paid as sends grow.
- **Supabase** — free tier now; Pro (~$25/mo) when storage/auth/DB grows.
- **OpenAI Whisper** (voice transcription) — per-minute audio cost when voice notes are used.

---

## 11. Social impact — the Shapi Upskilling Fund (decided 2026-05-25)

> **The "why now":** AI is automating task-by-task, role-by-role. The *first rung* of the
> white-collar ladder disappears first — AI does the grunt work juniors used to learn from, so
> young people can't get the experience that made them hireable. Shapi's whole moat (verified
> *evidence* of capability replacing "years of experience" gatekeeping) is the answer to that
> gap. The Fund is us putting our money where our mouth is — and it doubles as PR + the
> fundraising/impact narrative.

### Displacement roadmap (the narrative spine behind Translator / AI-Proof / Pivot / Train-to-Hire)
- **Now–2027:** routine cognitive/admin work compresses — data entry, basic support, bookkeeping, junior content, first-draft code, paralegal research. Entry-level white-collar thins out.
- **2027–2030:** mid-skill knowledge work becomes "AI + human" (analysts, marketers, recruiters, designers). Fewer people do more. Trades stay relatively insulated.
- **2030+:** new categories grow — AI oversight, human-judgment roles, the care/relationship economy, skilled trades.
- **Key insight:** the disappearing *first job* is the gap Shapi is uniquely built to close for young people.

### Decisions
- **[LOCKED] In-house, not an external charity.** Shapi runs its own **Upskilling Fund** —
  a company program, **not** a registered charity.
- **[LOCKED] Funding source = $1 of every subscription**, baked-in (not opt-in), with a public
  counter ("Shapi has funded X courses"). Budget is therefore **bounded by revenue** — it can
  never overspend.
- **[LOCKED] Legal framing — call it a *Shapi-funded commitment*, NOT a "donation/charity."**
  In the UAE & KSA, soliciting donations is a *licensed* activity. Framing it as "for every
  subscription, Shapi funds $1 of free upskilling" makes it a **business revenue commitment**,
  not solicited charity → avoids fundraising-permit/registered-entity requirements. **Never use
  the words "donate / donation / charity" in product copy.**
- **[LOCKED] Pay the course provider directly (or reimburse the certificate fee on
  completion) — never give cash to candidates.** Guarantees the money does what it says +
  removes fraud/welfare-scrutiny risk.
- **[LOCKED] "Course of their choice" — but inside a job-relevant frame.** They pick freely
  **from the skills Career Translator says lead to a real role for them.** Keeps it generous but
  strategic (career ladder, not handout). _(Confirmed by Ana 2026-05-25.)_
- **[LOCKED] Fund only courses that produce a *verifiable* credential** (fountain-of-truth
  DNA) → every funded course ends in provable proof on their profile → feeds the placement
  engine. Double impact: upskills someone *and* strengthens Shapi's supply side.

### Selection rubric (the pool → shortlist → pick)
| Parameter | Signal | Why |
|---|---|---|
| **Financial need** | Short self-declared statement (unemployed / no employer sponsorship / income below a line) | Dignity-preserving, light-touch — don't demand bank statements |
| **Story / motivation** | Written or **voice note** (reuses the blue-collar voice feature) | The human heart of it; great for the impact story |
| **Commitment** | Must already have a built Shapi profile + an identified skill gap | Filters freebie-hunters; rewards genuine intent |
| **Employability** | Course maps to a real skill gap / real open role | Makes the spend strategic, not just kind |

- **Anti-abuse:** one funded course per candidate per period; **pay 50% on enrolment / 50% on a
  completed, verified credential** (skin in the game); don't-complete → not eligible again.
- **Cadence:** monthly cohort ("this month the Fund covers N courses"). Early on, **Ana
  hand-picks from an AI-scored shortlist** (AI scores need + employability from profile data;
  human makes the final call) — on-brand (AI assists, human judges) *and* the best founder PR.

### Phasing around the June 2 launch
- **At launch (≤ 2 Jun 2026):** ship **only the commitment + public counter** ("$1 of every
  subscription funds free upskilling — Shapi has funded X courses"). **No application UI** — you
  can't fund anyone before subscription revenue exists, so it phases naturally. **Do NOT take on
  any charity-registration / donation-collection compliance pre-launch.**
- **Phase 2 (3–6 mo post-launch):** open the application flow + first monthly cohort; first
  cohort can be hand-picked by Ana with zero UI. Route funded training into **Train-to-Hire**
  where possible (closed loop: fund → verified credential → placement).
- **Phase 3 (at scale):** consider a registered "Shapi Foundation" only once volume + legal
  capacity justify the governance overhead.

---

## 12. WhatsApp as the AI assistant interface [LOCKED, decided 2026-05-26]

> **One-liner:** WhatsApp isn't just our interview channel — it's the candidate's command line to Shapi.

- **Pre-launch reality:** today the webhook handles interview turns + a few inline intents
  (voice / references). The vision is that the **same WhatsApp chat becomes a true assistant**
  that does work on the candidate's behalf.
- **Three concrete commands to ship post-launch** (in this priority order):
  1. **"approve all drafts" / "send everything I've read"** — Concierge auto-sends approved
     outreach via Resend.
  2. **"prep me for [company]"** — generates an interview prep brief (we already have the prep
     engine on the company side; reuse).
  3. **"research [company X], add it to Shapi"** — see §13. THIS is the high-impact one.
- **Daily digest** (opt-in, once/day cap): *"2 interviews this week, 3 drafts to approve, 1
  reference pending."* WhatsApp wins over email here — open rates and reply latency are
  dramatically better.
- **Why this matters:** it turns a passive job-search tool into an **active concierge** the
  candidate can delegate to from anywhere — and it's lock-in only Shapi can do because we own
  the verified profile + the WhatsApp interview history + the Concierge pipeline.

---

## 13. Candidate-research → Shapi lead-gen flywheel [LOCKED, decided 2026-05-26]

> **The insight:** every time a candidate asks Shapi to research a company that ISN'T on Shapi
> yet (e.g. they saw a role on LinkedIn), we get a **free, demand-validated lead** for our
> supply side.

- **The mechanic, in 3 steps:**
  1. Candidate (in WhatsApp or app) says *"research [Company X] — I saw a role there"*. AI does
     the research (web search → company info, hiring signals, headcount, location,
     glassdoor/trust signals).
  2. We create an **UNCLAIMED company profile** in Shapi with that info + a *"candidate-requested"*
     flag and a count of how many candidates have asked about them.
  3. Once **N candidates** request the same company (start with **N=1** to maximise outreach),
     we send the company an outreach email: *"You were searched by [N] verified candidates on
     Shapi this week — claim your free profile to see them."* (Co-brand with founder note for
     warmth.)
- **Why this is a moat:** most marketplaces have to do paid outreach to fill the supply side.
  We get **supply growth driven by candidate intent** — meaning every new company we add
  already has at least one interested verified candidate. That's a vastly stronger first
  contact than cold sales.
- **Connects to Concierge** (see §2 pricing): the more companies in Shapi, the more value
  Concierge subscribers get; the more candidates use Concierge, the more companies they pull
  in. **Self-reinforcing.**
- **Risks to manage:**
  - **(a) ToS on web search results** — mitigate by using only public signals + the candidate's
    intent as the source.
  - **(b) Spam fear** — cap outreach to **one email per company per quarter**; one-click
    unsubscribe.
  - **(c) Quality** — surface only **candidate-confirmed** roles, not auto-scraped speculation.

---

## 14. Client-side mirrors of candidate products [LOCKED Phase-2 roadmap, decided 2026-05-26]

> **One-liner:** Every candidate-side tool we've built has a client-side mirror that drives recurring revenue, engagement, or moat. Locking the list so Phase 2 build order is clear.

Each candidate-side product has a symmetric company-side equivalent that reuses the same infra (webhook, digest builder, Concierge cron, AI cross-check, trust score). Grouping by tier so we don't rebuild from scratch — and so the pre-launch crunch only pulls in the mirrors that already share plumbing with shipped candidate features.

### Tier 1 — direct revenue / engagement mirrors (build first post-launch)
1. **Active Hiring subscription tier** — daily AI-shortlisted verified candidates per open role + drafted outreach awaiting approval. Mirrors **Shapi Active** ($29/mo). New SKU; needs Stripe wiring + cron.
   **Why:** new recurring revenue line; reuses the same infra as candidate Active / Concierge.
2. **Company daily WhatsApp digest** (opt-in, once/day cap). Reuses `buildDigestMessage`.
   **Why:** retention; WhatsApp open rates beat email (see §12).
3. **Company "Today" action card** — applicants to respond to, interviews to schedule, drafts to approve, candidates shortlisted by competitors. Mirrors the candidate Today card.
   **Why:** reduces "where do I start?" friction; surfaces the day's highest-leverage actions.
4. **Hiring-manager WhatsApp commands** — *"shortlist for X"*, *"post a role"*, *"research [candidate]"*, *"draft offer for X"*. Mirrors candidate commands; same webhook.
   **Why:** hiring managers live in WhatsApp; the assistant pattern from §12 generalises to the demand side.
5. **Company salary benchmark** — what's competitive for this role in this country. Mirrors candidate **"What you're worth"** (§4a); fights ghost-salary roles.
   **Why:** lead-magnet + anti-bad-actor signal; pairs with "salary as advertised" verification.

### Tier 2 — strategic / advisory (build next)
6. **Hiring Roadmap** — given team + open roles + market, what skills to hire next, what to reskill internally, what's AI-at-risk. Mirrors the candidate Career Roadmap.
   **Why:** positions Shapi as a strategic advisor, not just sourcing.
7. **"Is this role AI-proof?"** — score a JD; warn if hiring for something likely to compress. Mirrors candidate AI-Proof check.
   **Why:** counter-intuitive but high-value; differentiator that ties into the §11 displacement narrative.
8. **Company profile completion %** with green-at-100 + a **verified-employer badge** tied to it (mission, perks, salary transparency, paid-on-time, glassdoor link).
   **Why:** turns trust into a game with a clear finish line; drives the company trust score (§2 leakage / §4c responsiveness).
9. **Plan your hiring strategy** — given industry / stage / budget, perm vs temp vs fractional split, approx total comp burden. Mirrors candidate **"Plan your own business"**.
   **Why:** pre-sales tool; walks non-clients into a Shapi product (top-of-funnel like the candidate version).

### Tier 3 — speculative but moat-y
10. **Employee-side culture references** — past/current employees vouch (anonymously aggregated) for *"paid on time / real hours / manager quality"*; feeds the company trust score. Mirrors candidate independent reference chains.
    **Why:** anti-employer-manipulation; same fountain-of-truth pattern; potentially the deepest moat we have.
11. **Research a candidate → invite them to Shapi** — symmetric lead-gen flywheel: company sees candidate on LinkedIn → asks Shapi → we email candidate *"[Company] wants to see your verified profile."* Mirrors §13.
    **Why:** pulls demand-side leads into the platform; closes the loop on the §13 flywheel.

> **Pre-launch (before 2 June 2026):** ship features 2, 3, 4, 5, 7, 8, 9 in tight/MVP form (they reuse candidate-side infra). Features 1, 6, 10, 11 are Phase 2 proper — they need new SKUs / deeper data work and shouldn't be rushed.

---

## 15. Restructuring & outplacement — the enterprise wedge (LOCKED idea; decided 2026-05-26)

> One-liner: Shapi becomes the infrastructure for orderly labour-market change — we help individuals navigate displacement (§11) AND help companies do it humanely. Same fountain-of-truth DNA, both sides, paying enterprise contracts.

As AI compresses roles, more companies will restructure. They currently buy this from McKinsey ($500k-2M), traditional outplacement firms ($5-15k/head), and employment lawyers. Shapi can deliver the same outcomes 5-10× cheaper, with much better unit economics, because we already own the engine — verified profiles, reference chains, AI-Proof scoring, Career Roadmap/Pivot, Train-to-Hire. This is also the natural inversion of §11 (we built the candidate-side displacement playbook; this builds the company-side counterpart). It's the biggest enterprise wedge we have.

### Feature stack (priority order):

1. **[LOCKED] Outplacement-as-a-service** (the lead product). Company pays a per-head fee (~$500-2,000); each laid-off person gets a free 90-day Pro account on Shapi — verified profile + reference chain + Career Translator + AI-Proof + Pivot + Course Wallet + Concierge.
   **Why:** 10× cheaper than incumbents, better outcomes, and *every laid-off person becomes a verified Shapi candidate at scale* — pure supply-side growth driven by the buyer's spend. The rare product where the more our customer uses it, the stronger our marketplace gets.
2. **[LOCKED] Restructure Studio.** A workspace where the HR/CEO lead can upload current org chart/headcount CSV, AI tags each role (AI-resilience score × salary × market fit × tenure), they tag keep/reskill/redeploy/let-go, and we generate a before/after structure with cost delta. All decisions auditable, timestamped, defensible.
   **Why:** layoff decisions are increasingly contested (in court and on LinkedIn) — an auditable, AI-grounded decision trail is a real protection. Also: forces clear thinking instead of gut calls.
3. **[LOCKED] Reskill-vs-cut simulator.** For each at-risk role: cost of reskilling that person into an adjacent rising role vs cost of severance + new hire. Often reskilling wins on pure economics.
   **Why:** turns a binary "fire / don't fire" call into a third option that's better for everyone, and often cheaper.
4. **[LOCKED] Comms drafter.** Drafts the four messages every restructure needs: manager scripts for the 1:1s, individual letters, the all-hands message, and the LinkedIn/external post. Country/cultural tone variants, "warm but honest" vs "legal-minimum" presets.
   **Why:** the difference between a restructure that destroys your employer brand and one that strengthens it is almost entirely in the comms. Most companies do this badly because they outsource to lawyers who write legalese.
5. **[LOCKED] Country-aware compliance checker.** Per-country statutory notice + minimum severance + collective-consultation thresholds (UAE, KSA, UK, EU, US-WARN). Strictly **guidance, not legal advice** — explicit disclaimer + "have your lawyer review" everywhere.
   **Why:** companies routinely get this wrong cross-border. Even a checklist with the right pointers saves them from $$$ mistakes.
6. **[LOCKED] Survivor retention layer.** After a restructure, identify the high performers most likely to bolt (signals: market salary delta, time since promotion, tenure mismatch) and prompt managers to have a stay-conversation.
   **Why:** post-layoff regret loss is one of the most expensive parts of a restructure — the people most likely to leave are usually the ones you most wanted to keep.
7. **[LOCKED] "Verified restructure" badge** on the company trust score for orgs that complete a Shapi-tracked restructure with strong outcomes (placement rate, comms quality, comp fairness).
   **Why:** brand protection becomes a positive moat — competitors that restructured badly look comparatively worse.
8. **[IDEA] Sensitive-comms WhatsApp coach.** Manager texts "how do I tell [name]" privately on WhatsApp; Shapi coaches them through the conversation.
   **Why:** the actual 1:1 is where most managers fail. Real-time coaching at the point of action.

### Business model

- **Pricing benchmarks (what we displace):** McKinsey strategy work $500k-2M per project; traditional outplacement firms (RightManagement, LHH) $5-15k per head and ~30% placement rate.
- **Shapi pricing:** $500-2,000 per head for outplacement, $25-100k flat for a Restructure Studio engagement (Stripe one-off + per-seat). Lower price, better outcomes, and we cross-subsidise from the supply-side growth (every restructured leaver becomes a verified candidate).
- **Why this is enterprise-grade revenue:** subscription companies pay monthly; restructure clients pay six-figure project fees. Mix of both = healthier P&L.

### Risks to manage

- **Brand sensitivity** — "Shapi profits from layoffs" reads cynical if framed wrong. Lead with: *we help people land softly + we help companies do this right*. Marketing copy is load-bearing.
- **Legal exposure** — redundancy law varies massively by jurisdiction. Guidance, never advice. Lawyer-review disclaimer in every drafted document.
- **Data sensitivity** — handling internal HR + performance data may push us into SOC 2 for enterprise contracts. Budget for compliance work in Phase 2.
- **Sales-cycle reality** — enterprise restructure deals close on weeks-to-months. F&F launch should *seed the narrative* (case studies, pitch deck) rather than depend on this revenue.

### Connection to other sections

- Builds directly on **§11** (candidate-side displacement playbook).
- Sits next to **§14 Tier 2** features (Hiring Roadmap, AI-Proof for roles, Hiring Plan — these are the engine).
- Feeds **§13** (every restructured leaver → verified Shapi candidate; demand-side flywheel inverted).

> **Status:** locked as the post-launch enterprise wedge. Pre-launch the strategic narrative + a one-page sales sheet + (recommended) one quick "AI Talent Audit" prototype — see §16. The full feature stack is Phase 2/3.

---

## 16. Shapi Workforce Intelligence (consolidated framework — LOCKED, decided 2026-05-26)

> One-liner: We're not a job marketplace — we're a Workforce Intelligence platform. We score an org's readiness for the future workforce (Verified), plan their transformation (Workforce + AI), and supply the talent to execute (Outplacement, Hiring, Reskilling). The plan you'd get from McKinsey, the talent you'd get from LinkedIn, the verification nobody else has, in one platform.

The strongest positioning is NOT "recruitment software" — it's Strategic Workforce Intelligence + Organisational Fit. Companies face two intertwined problems: (1) AI will reshape their workforce (who to keep/reskill/cut/protect), and (2) integrating AI itself is expensive, talent-scarce, and full of pitfalls (Google's inference-cost squeeze, Uber-style ROI mirages). These two problems are ONE conversation — you can't plan headcount without an AI rollout plan, and you can't plan AI rollout without a talent plan. We sell both as one product, plus we own the verified talent supply to execute, plus we own the verification layer competitors lack.

### Competitive positioning (LOCKED)
- Not vs Indeed / LinkedIn (table stakes).
- Real comparison set: **Workday / SAP** (HRIS giants — slow, expensive, no AI displacement intelligence), **Eightfold / Gloat** (AI-talent platforms — self-reported data, no verification, no execution), **Mercer / McKinsey / BCG** (consulting — $500k-2M, walk away after the report, no talent supply).
- Our differentiator: **Verified data + AI workforce intelligence + talent supply to execute** — vertical integration nobody else has.

### Tier ladder (LOCKED — supersedes earlier framing)
- **Tier A — Workforce Snapshot** (launch wedge, 7 days). One-shot. Headline output: **Workforce Future Readiness Score (0-100)**. Plus heatmap, top at-risk roles with 5-way recommendation, AI integration cost estimate, talent gap summary. Free / $1-5k. Top-of-funnel.
- **Tier B — 5-Year Workforce Plan** (Phase 2). Full engagement. Operating model diagnostic → Org DNA mapping → workforce + AI integration plan (3y / 5y / 10y horizons) → execution playbook. **$25-100k per engagement**, annual refresh (recurring).
- **Tier C — Workforce OS** (Phase 3, subscription). Continuous monitoring + Team Compatibility Matrix + Succession Intelligence + Leadership Risk Detection. Integrated with marketplace: redeployment → Shapi pool, leavers → outplacement, AI integration talent → sourced from pool. **$5-25k/month enterprise**.

### Six target operating models (diagnostic at start of Tier B)
Companies select one or hybrid. Each implies different planning logic:
- **Centralised** (govt, regulated, mega projects) — HR owns planning centrally, governance-heavy.
- **Decentralised** (holdings, conglomerates, fast-scaling) — BUs own hiring autonomy.
- **Agile Pod** (tech, startups, innovation teams) — skills-based squads, fluid roles.
- **Skills Marketplace** (large enterprises in AI transition) — internal gig economy, skill inventory replaces titles.
- **Hybrid Human + AI** (forward-thinking) — AI agents in teams, workforce measured in human + digital capacity.
- **Outcome-Based** (consulting, creative, transformation firms) — measured by outcomes not hours.

**Why:** most CEOs can't articulate which model they're running. Diagnosing it + recommending one is the *first* high-value advisory move in the engagement.

#### Selecting / combining models — four valid input modes (LOCKED)
Real companies almost never fit one model cleanly. The product must support all four input shapes:
1. **Single primary** — small/early-stage orgs that genuinely run one model end-to-end.
2. **Hybrid (one company, weighted blend)** — e.g. *"60% Centralised, 30% Agile Pod, 10% Skills Marketplace"*. Tier A's fast input mode.
3. **Per-BU / per-function** — different model per business unit. The Tier B default. A UAE family holding might be: HR Centralised + Tech Agile Pod + Consulting Outcome-Based + Operations moving to Hybrid Human+AI.
4. **Transitioning over time** — current model → target model per BU on a 3-year horizon, with cost + risk per transition step. The Tier B deliverable that most consultancies don't produce.

UX per tier:
- **Tier A** — single radio + optional second pick. ~10 seconds.
- **Tier B** — visual org map; drag-tag each BU with one of the 6 models; AI suggests a starting tag from their description; transition path modelled per BU.
- **Tier C** — per-BU model-fit health score + drift alerts when org evolution (growth / new product / M&A) signals a BU's model should change.

Power-user input (extends his slash-command idea):
```
/operating-model centralized:hr
/operating-model agile-pod:engineering
/operating-model outcome-based:consulting
/operating-model hybrid-ai:operations
```

**Misalignment diagnosis is its own deliverable** — pointing out *"your tech BU is running Centralised which is why dev velocity is choking; it should be Agile Pod"* is often more valuable (and more sell-defining) than the target-state recommendation itself. Surface misalignment as a distinct output, not just a step in the path.

### Candidate fit framework: Head / Heart / Hand / Spark (LOCKED)
Replaces the generic match score on every candidate-role match. Four dimensions:
- **Head** — intelligence, strategic thinking, problem solving, learning agility.
- **Heart** — EQ, empathy, team compatibility, leadership maturity.
- **Hand** — practical execution, delivery, functional expertise. *Our verification engine is the strongest in market on this dimension.*
- **Spark** — innovation, ambition, creativity, energy, change leadership.

Plus three separate fit scores:
- **Role fit** — vs the JD.
- **Team fit** — vs the existing team's behavioural composition.
- **Organisation fit** — vs the org's DNA / culture.

**Why:** explains why "perfect on paper" hires fail. Cleaner commercial story than competency rubrics. We deeply own **Hand** via verification — H/H/S extends us into the softer dimensions explicitly.

### Five-way per-role recommendation (LOCKED — replaces our 4-way)
For every role in a restructure / planning exercise: **Replace / Augment / Reskill / Redeploy / Protect strategically.**
- **Protect strategically** — flag high-performers / hard-to-replace people we should fight to keep. New explicit category vs prior 4-way.
- **Why:** sharper, more honest, prevents accidentally losing key talent during restructuring.

### AI Exposure Index (sharpened scoring dimensions for /role/ai-proof)
Replace generic scoring with these 6 explicit dimensions:
1. Repetitiveness
2. Rules-based work
3. Administrative intensity
4. Data processing dependency
5. Creativity requirement (inverted — high creativity → low AI risk)
6. Human interaction dependency (inverted)

### Workforce Future Readiness Score (LOCKED — the headline metric)
Single 0-100 score per organisation. Composite of:
- AI exposure (% of org high-risk)
- Skills maturity (% of needed future skills present)
- Leadership adaptability
- Innovation density
- Workforce resilience
- Organisational adaptability

**Why:** CEO conversation-opener. "Your company is 47/100 ready for the future workforce — here's what to raise it to 75." A single number is the dopamine moment. Drives both the audit (what's your score) and the plan (here's how we raise it).

### Team Compatibility Matrix (Phase 2/3)
Concrete deliverable: a **2×2 visual** plotting team members across four behavioural archetypes — *dominant thinkers, dominant executors, dominant collaborators, dominant innovators*. Weighted by H/H/H/S scores. Prevents the four classic team-design failure modes:
- Too many strategists / no executors → slow delivery.
- Too many executors / no innovators → stagnation.
- Too many innovators / no collaborators → chaos.
- Too many collaborators / no thinkers → groupthink.

**Why:** one of the most concrete, demoable artifacts in the product. Sells itself in a screenshot.

### Six Core Engines — product architecture (LOCKED)
The product is built on six discrete AI engines (think Slack/Linear's "primitives" model). Each is a named AI agent customers can interact with directly via the slash-command grammar:
1. **Workforce Intelligence Engine** — forecasting, attrition prediction, hiring demand.
2. **Behavioural Intelligence Engine** — Head/Heart/Hand/Spark scoring + Role/Team/Org fit.
3. **AI Exposure Engine** — role-by-role automation risk scoring (already shipped at `/role/ai-proof`).
4. **Team Dynamics Engine** — compatibility, balance, succession, leadership-risk detection.
5. **Skills Graph Engine** — enterprise capability mapping + skills-marketplace allocation.
6. **Organisational Simulation Engine** — scenario planning ("what if 30% of ops is automated?"), org-design generation, autonomous staffing recommendations.

**Why:** clean engineering breakdown + cleaner sales narrative. *"Your team of six AI agents"* is a stronger story than *"our AI platform."*

### Command grammar — power-user UX (LOCKED)
The product exposes a slash-command vocabulary across in-app + WhatsApp (extending the existing webhook commands). Lock the namespace:

```
/operating-model centralized:hr        /evaluate head|heart|hand|spark
/operating-model agile-pod:engineering /calculate role-fit|team-fit|organization-fit
/forecast workforce-3y                 /calculate ai-risk
/generate talent-gap-analysis          /recommend reskilling|redeployment
/predict attrition                     /generate ai-transition-plan
/optimize workforce|workforce-cost     /analyze organizational-dna
/recommend team-structure              /simulate workforce-scenario
/map enterprise-skills                 /generate succession-map
/calculate future-readiness            /detect leadership-risk
```

**Why:** sophisticated buyers (Workday/Eightfold-grade) reward command-first UX. It's also the natural extension of our WhatsApp commands (§14 Tier 1) — same grammar across both channels.

### Positioning tagline (LOCKED)
> *"Verified human compatibility + AI workforce intelligence — the plan you'd get from McKinsey, the talent you'd get from LinkedIn, the verification nobody else has."*

Single line use anywhere — sales deck, homepage, pitch. Combines our verification moat (Hand), behavioural depth (H/H/S), and execution edge (talent supply) in one sentence.

### Phase 2 / Phase 3 extensions worth banking now
- **AI-generated organisational design** (Phase 2) — given strategy + AI integration plan, generate the *target-state* org chart. Heavy-lift, premium sell.
- **Autonomous staffing recommendations** (Phase 3, Tier C) — system proactively suggests staffing changes without being asked. Subscription stickiness.
- **Cognitive load management** (10y vision) — measure if managers / individuals are overloaded; proactively redistribute work. Unique to anyone with continuous data; one for the OS tier roadmap.

### Trust-tier data model (LOCKED — applies across all tiers)
- **L1 (Snapshot)** — categorical inputs only: industry, size, AI maturity, optional role roster with no names. Standard DPA.
- **L2 (Plan)** — full anonymised: role IDs, salary bands, tenure, performance band. Per-engagement isolated schema + NDA + DPA + deletable on request.
- **L3 (OS)** — identifiable data, continuous HRIS integration. **SOC 2 required** + enterprise contract + audit logs visible to customer.
- Cross-cutting commitments: anonymise at ingest where possible; no-training contractual clause; per-customer schema isolation; encryption at rest + in transit; DPA template Day 1; SOC 2 path on roadmap for L3.

**Why:** enterprise sales gates on data trust. A UAE family business can start at L1 with zero risk and escalate as trust builds — mirrors our verification DNA.

### Cost reliability (LOCKED commitments)
- Every projection grounded in a real input (their data + our benchmarks — salary, Anthropic/OpenAI public API pricing, cloud rates). Never AI-invented.
- Confidence bands on everything ("$200-450k Y1" not "$285k Y1").
- Show our sources at the bottom of every figure.
- Sandbag honestly: industry data shows ~50-70% of enterprise AI pilots fail to scale. Bake into the model.

### Connection to other sections
- Builds on **§11** (candidate-side displacement playbook → company-side counterpart).
- Subsumes the earlier "AI Talent Audit" proposal — that's Tier A here.
- Sits alongside **§14** (the company-side feature mirrors are the *components* of this product).
- Feeds **§15** (Outplacement is the natural Tier C execution layer).
- Feeds **§13** (each engagement reveals companies we want to bring onto Shapi).

### Pre-launch vs Phase 2/3
- **Pre-launch (before 2 June 2026):** ship **Tier A only** (the Workforce Snapshot wedge) + one-page sales sheet. Tier B + C are full engagements that need real care.
- **Phase 2 (0-6 months post-launch):** Tier B engagement playbook + first 2-3 design partner engagements.
- **Phase 3 (6-12 months):** Tier C subscription product + SOC 2 + first enterprise contracts.

> **Status:** locked as the company-side product spine. All earlier company-side feature work (§14) is now framed as components OF this product, not standalone tools. Tier A is the launch wedge.

---

## 16.5. Brand voice & sources policy — how we talk about confidence (LOCKED, decided 2026-05-27)

> One-liner: We're a verification brand. Hedge-words ("indicative", "approximate") undermine that. Three confidence tiers, three voice registers, sourced citations on every output — *that* is our source-of-truth claim.

Verification is meaningless if every number we produce is caveated to death. Our outputs span three confidence levels — each gets its own voice, NOT generic hedging. The rule: **never say "indicative" or "approximate" as a hedge.** Either we know it (state as fact, cite the source), we synthesised it (state with confidence + cite the inputs), or we projected it (state with a confidence band + name the variance drivers). Read like McKinsey, not like an AI assistant.

### The three voice tiers (LOCKED)
1. **Verified** — data we own (references, credentials, work history, performance signals captured in Shapi). State as fact. No hedging.
   - Example: *"Verified at Emirates Group 2018–2022 by manager + 2 colleagues."*
2. **Sourced** — aggregated benchmarks from real public/market data + our analysis. State with confidence; cite sources.
   - Example: *"Regional band $50–75k; global median $80–120k for the same role. MENA pays ~30% less than US for equivalent roles. Sources: Mercer MENA 2024, Glassdoor public ratings, Numbeo cost-of-living."*
3. **Projected** — forward-looking estimates (future costs, AI displacement timelines, scenario outcomes). Confidence bands + named variance drivers.
   - Example: *"Year 1 cost: $200–450k (70% confidence). Variance driven by build vs buy, in-house vs partner, pilot success rate."*

### Banned hedge phrases (LOCKED — strike from all product copy)
- "indicative" → use a confidence band + cite the source
- "approximate" (as hedge) → cite source instead; numeric prefix "~$15" is fine
- "rough estimate" → confidence band + driver
- "confirm on the platform" → cite + explicit confidence
- "AI-generated" (as hedge alone) → "synthesised from [sources]"

**Why:** hedge words tell the reader to discount our answer. We're the source of truth — own it.

### Sources whitelist (LOCKED — we ONLY cite from this list)
Real, citable, public data (no scraping / no ToS-violating sources):
- **Salary & comp:** Mercer (free reports), PayScale public benchmarks, Robert Half published rates, Numbeo cost-of-living, government labour statistics (UAE PRA, KSA GOSI, UK ONS, EU Eurostat).
- **Company info:** Glassdoor public ratings, Crunchbase public profiles, LinkedIn public company pages (public only, never scraped at scale).
- **Tech / AI costs:** Anthropic published API pricing, OpenAI published API pricing, AWS / GCP / Azure published service pricing.
- **Analyst reports (free pages only):** Gartner free articles, McKinsey/BCG free Insights, WEF Future of Jobs, OECD labour market data.
- **Shapi's own data:** verified placements, reference signal patterns, regional salary deltas we observe. *This is the moat — grows over time.*

**Forbidden:** fabricated stats, citations we didn't actually pull, scraped data that violates ToS.

### Citation pattern (LOCKED — every report has a Sources footer)
Format:
```
Sources: Mercer MENA Compensation 2024 · Numbeo cost-of-living (UAE) · Anthropic API published pricing · Shapi placement data (n = N where applicable).
```
- AI synthesis: "Synthesised from [sources]" — never "AI-generated" alone.
- Shapi data: include the N when it's a real signal: "Shapi placement data (n = 47 verified placements Q1 2026)".
- Forward projections: "Projected by Shapi model based on [inputs]."

### The regional vs global differentiator (LOCKED)
**Every salary, cost, and benchmark output explicitly shows BOTH the regional figure AND the global figure, with the gap named.**
- Example: *"Junior data analyst (UAE): $35–48k. Same role (global median): $58–72k. MENA discount: ~35%. This reflects local talent supply + cost-of-living parity."*

**Why:** nobody does this credibly for MENA. McKinsey gives Western figures; LinkedIn/Glassdoor give global averages. Showing the regional vs global split *with named reasoning* is what makes us the source of truth here. Lead with this on Salary Benchmark + any cost output.

### Honest about uncertainty — confidence, not hedges (LOCKED)
When genuinely uncertain, we don't bury it in caveats. We:
- Show the confidence band ("70% confidence: $200–450k Y1").
- Name what would tighten it ("Tier B narrows this to ±15% by gathering [inputs]").
- Distinguish what we *know* from what we *projected*.

This is the difference between weak hedging and honest professional analysis. McKinsey produces uncertain forecasts every day; they don't write "indicative" — they write "Y1 cost: $200–450k, 70% confidence, driven by ABC."

### Closing tagline (LOCKED)
> *"We don't give you indicative numbers. We give you sourced answers and honest projections — so you can decide, not guess."*

---

## 17. Launch market reality — Gulf 2026 + defensive positioning (LOCKED, captured 2026-05-27)

> One-liner: The MENA launch thesis stands, but the *narrative* shifts from growth/hiring to **investor-grade workforce intelligence for a contracting market**. Same product, sharper hook.

### What changed on the ground (Ana's on-ground read, 2026-05-27)
Earlier brand assumptions about Dubai/Saudi as "stable hub absorbing dislocated talent" were wrong by 2026:
- **Dubai** has been bombed; tourism revenue down significantly, capital outflow, lost confidence.
- **Saudi** hit less than Dubai but still affected; many people left the region.
- **NEOM and New Murabba** mega-projects have stalled / flopped.
- **Qiddiya + Red Sea Global** (PIF-backed) are the survivors that materialised.
- **Investor confidence shaken** across the board — events being withdrawn, private VC in defence mode.

### What this changes (LOCKED)
- **Don't change the launch market** — Ana's network IS in UAE/Saudi; cold-launching elsewhere wastes that asset and the product genuinely fits a restructuring market.
- **Change the narrative**, not the product. The §15 + §16 product mix is *better suited* to a contracting Gulf than the pre-2024 growth-market thesis was.
- **Target the survivors specifically.** Initial sales list = PIF-backed + government-funded + still-building entities:
  - Red Sea Global, Qiddiya, ADQ / Mubadala / PIF portfolio companies, Aramco subsidiaries, DP World, plus the surviving names from Ana's network.
- **Skip events** — conferences are being cancelled. Direct + founder-led + WhatsApp + network referrals only.

### The narrative pivot (LOCKED)
- **Old hook:** *"Hire faster + verify your candidates"*
- **New hook:** *"Workforce intelligence your board will trust — verified, sourced, scenario-modelled."*
- **Why:** when investor confidence is low, every CFO is being asked *"can you justify your headcount? prove your AI plan? show me the cost trajectory?"* — that's literally Shapi. Audit trails, sourced-confidence bands, 5-way Replace/Augment/Reskill/Redeploy/Protect tagging — all sellable *defensively*: "we help you defend every workforce decision to your board."

### Product mix priority for this market (LOCKED)
Stronger in a contracting Gulf — **lead with these**:
- **[Lead] Workforce Snapshot** (free top-of-funnel; defensible Future Readiness Score)
- **[Lead] Restructure Studio + Comms drafter** (exactly built for downsizing)
- **[Lead] Outplacement-as-a-service** (every laid-off worker → verified Shapi candidate; double-impact)
- **[Lead] AI-Proof per role** (CHROs need to defend cuts with sourced reasoning)
- **[Lead] Tier B 5-year Plan** (investor-grade strategic deliverable for the survivors)
- Career Translator + Pivot + Course Wallet (candidate-side mirror for displaced workers — feeds outplacement flywheel)

Keep but don't lead with — only relevant for the few survivors still hiring:
- Active Hiring subscription
- Hiring Roadmap (growth-oriented)
- Salary Benchmark for new roles

### Sales-cycle expectations (LOCKED)
- UAE family-business + SME first — faster decisions, often founder-led.
- Saudi enterprise as Phase 2 — sovereign / PIF entities move slowly but with budget.
- Direct outreach + warm intros over events. WhatsApp-first sales motion matches our brand.

### What we revisit at launch readiness
- Re-check the on-ground situation closer to launch (if conditions change, the hook adapts).
- Refresh the target list — who's still standing then.
- Re-run the prospect-question test: *"are they asking 'how do we hire?' or 'how do we restructure?'"* — answer determines which framing the homepage leads with.

> **Status:** locked as the Gulf launch positioning. The product (built across §11–§16) doesn't change. The *story we tell* and the *initial target list* do.
