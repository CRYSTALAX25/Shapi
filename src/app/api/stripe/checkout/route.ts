import { NextResponse } from 'next/server'

// RETIRED (2026-06-17). This route used to charge a one-time $49 "Verified
// Candidate Profile" — a pre-v5 price that no longer exists in the ladder
// (Free → CV Kit $25 → Shapi Pro $59/mo → Concierge $99/mo). No UI calls it,
// but it was still live and chargeable, so it now hard-refuses rather than
// create a session at a stale price.
//
// Current candidate checkout paths:
//   - one-time CV Kit ($25 / $9 blue-collar) → POST /api/stripe/cv-checkout
//   - Shapi Pro / Concierge subscriptions     → POST /api/stripe/subscribe
export async function POST() {
  return NextResponse.json(
    {
      error: 'This checkout has been retired. Use /api/stripe/cv-checkout (CV Kit) or /api/stripe/subscribe (Shapi Pro / Concierge).',
    },
    { status: 410 },
  )
}
