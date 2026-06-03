// Backward-compatible redirect — the workspace moved from /company/tier-b
// to /company/strategic-plan on 2026-06-03 (internal pricing-tier jargon
// out of user-facing URLs). Old bookmarks + WhatsApp magic links land
// here and get sent on.

import { redirect } from 'next/navigation'

export default function TierBRedirect() {
  redirect('/company/strategic-plan')
}
