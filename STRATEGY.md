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
- **[RECOMMENDED] Launch pricing (companies):**
  - 30-day **free trial**, then **Starter $299/mo · Growth $799/mo · Enterprise Custom**.
  - **Founding Partner offer:** first ~25 companies get **50% off for 12 months, locked**
    ($149 / $399), with the standard price struck through (anchoring).
  - **No placement fee at launch** (it's the thing companies most want to dodge, and we can't
    police it yet).
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

## 5. Tech moat
- The **data** is the moat, not the features. Every independent reference, cross-check, company
  rating, and **hire outcome** (did they stay? how rated?) is proprietary → trains a real
  fit/quality model nobody else has. Close the loop.
- WhatsApp-first infra for emerging markets; right-to-work intelligence per country; voice +
  native-language capture.

---

## 6. Enterprise / API
- **[LOCKED] API is private, Enterprise-only** — NOT a public/open API. Enterprise = private API
  access + ATS integration + bulk verification + white-label + custom SLAs.

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
