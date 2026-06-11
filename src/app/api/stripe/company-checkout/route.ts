import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import Stripe from 'stripe'

// v5 PRICING LOCKED 2026-06-10 (STRATEGY §2). Self-serve company tiers:
//   - 'pro'    → $499/mo, 14-day card-required trial
//   - 'growth' → $1,500/mo, 14-day card-required trial (NEW v5 tier)
// Enterprise is SALES-LED — no self-serve trial. It routes to
// /book-call?intent=enterprise from the pricing page, never here.
// Free tier requires NO checkout — just a signed-in profile.

const PLANS: Record<string, { name: string; description: string; amountCents: number }> = {
  pro: {
    name: 'Shapi Pro',
    description: 'Multi-location org chart · Talent Match Pipeline · Active Hiring (AI shortlists + drafted outreach) · Salary Benchmark · Hiring Roadmap · Strategic Workforce Plan',
    amountCents: 49900, // $499/mo
  },
  growth: {
    name: 'Shapi Growth',
    description: 'Everything in Pro · Full diagnostic suite · Verified candidate-pool access · Strategic workforce planning · Priority support',
    amountCents: 150000, // $1,500/mo
  },
}

const TRIAL_DAYS = 14

// ── Founding Partner offer (STRATEGY §2, LOCKED v5) ───────────────────────────
// First 15 companies get 50% off their first paid tier (Pro or Growth) for 6
// months, then it auto-reverts to standard price. After 15 redemptions the
// coupon stops being applied — checkout proceeds at standard price.
//
// The cohort cap is a REAL count, not marketing framing: we count how many
// profiles already carry founding_partner=true (stamped by the webhook on a
// completed founding checkout) and only attach the coupon while that count < 15.
const FOUNDING_CAP = 15
const FOUNDING_PERCENT_OFF = 50
const FOUNDING_DURATION_MONTHS = 6
const FOUNDING_COUPON_ID = 'founding_partner_50off_6mo'

// Find (or lazily create) the stable founding coupon. Reusing a fixed coupon id
// means we don't mint a new coupon per checkout. duration='repeating' for 6
// months → Stripe auto-reverts to full price on month 7.
async function getFoundingCoupon(stripe: Stripe): Promise<string | null> {
  try {
    const existing = await stripe.coupons.retrieve(FOUNDING_COUPON_ID)
    if (existing && !existing.deleted) return existing.id
  } catch {
    // Not found — create it below.
  }
  try {
    const coupon = await stripe.coupons.create({
      id: FOUNDING_COUPON_ID,
      percent_off: FOUNDING_PERCENT_OFF,
      duration: 'repeating',
      duration_in_months: FOUNDING_DURATION_MONTHS,
      name: 'Founding Partner — 50% off for 6 months',
    })
    return coupon.id
  } catch (e) {
    console.error('[company-checkout] founding coupon create failed:', e)
    return null
  }
}

// Count companies that have already redeemed the founding offer. Gated on the
// profiles.founding_partner boolean (supabase/founding_partner.sql). If the
// column doesn't exist yet, we fail CLOSED (return cap) so we never over-issue
// the discount — better to skip the coupon than to give everyone 50% off.
async function foundingRedeemedCount(): Promise<number> {
  try {
    const admin = createAdminClient()
    const { count, error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('founding_partner', true)
    if (error) {
      console.warn('[company-checkout] founding count query failed (column missing?):', error.message)
      return FOUNDING_CAP // fail closed
    }
    return count ?? FOUNDING_CAP
  } catch (e) {
    console.warn('[company-checkout] founding count threw:', e)
    return FOUNDING_CAP // fail closed
  }
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tier } = await request.json()
  const plan = PLANS[tier]
  if (!plan) {
    return NextResponse.json({ error: `Invalid plan: ${tier}. Self-serve tiers are 'pro' and 'growth'. Enterprise is sales-led — see /book-call?intent=enterprise.` }, { status: 400 })
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

  // ── Decide whether this checkout qualifies for the Founding Partner offer ──
  // Only the first 15 redemptions get it. We re-check the live count on every
  // checkout so the window closes the moment the 15th company converts.
  let foundingApplied = false
  let discounts: { coupon: string }[] | undefined
  const redeemed = await foundingRedeemedCount()
  if (redeemed < FOUNDING_CAP) {
    const couponId = await getFoundingCoupon(stripe)
    if (couponId) {
      discounts = [{ coupon: couponId }]
      foundingApplied = true
    }
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: user.email,
    // CARD REQUIRED on the trial — Ana's explicit decision 2026-06-03.
    // Industry data: card-required trials convert 30-50%, no-card 5-10%.
    payment_method_collection: 'always',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: plan.name,
            description: plan.description,
          },
          unit_amount: plan.amountCents,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
    },
    // Founding coupon (if still within the cohort cap). Stripe applies it to the
    // first charge after the trial and auto-reverts after 6 months.
    ...(discounts ? { discounts } : {}),
    success_url: `${site}/company/welcome?tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/company/pricing`,
    metadata: {
      user_id: user.id,
      tier,
      // The webhook reads this to stamp profiles.founding_partner=true, which
      // both grandfathers the company and increments the cohort count toward 15.
      founding: foundingApplied ? 'true' : 'false',
    },
  })

  return NextResponse.json({ url: session.url, founding: foundingApplied })
}
