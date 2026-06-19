import { NextResponse } from 'next/server'

// RETIRED (2026-06-18). This route used to let the COMPANY type in its own
// employees' emails and send them the culture survey — which is company-curated
// and breaks the independence that makes the trust score a moat (the company
// could pick friendly voices, or skip awkward ones).
//
// Culture sourcing is now SHAPI-driven, exactly like independent candidate
// references: past employees are sourced from our own candidate pool
// (src/lib/culture-sourcing.ts, run from the daily cron), and current employees
// come via the seat-confirmation piggyback. The company never chooses who is
// asked. So this endpoint hard-refuses rather than accept a curated list.
export async function POST() {
  return NextResponse.json(
    {
      error: 'Culture references are now sourced independently by Shapi — companies can no longer submit their own list. This protects the trust score from being curated.',
    },
    { status: 410 },
  )
}
