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
- **Work-style self-assessment** — optional questionnaire → Work Style profile card (◆ Shapi-assessed). [building now]
- **Profile image + right-to-work** — [building now]
- Voice samples capture, WhatsApp CV editor, no-CV path — built, need live testing once Twilio is upgraded.

## Pricing / packaging (revenue)
- Verified-RTW and verified-aptitude as premium add-ons employers pay for.
- Upskilling affiliate/revenue share.
