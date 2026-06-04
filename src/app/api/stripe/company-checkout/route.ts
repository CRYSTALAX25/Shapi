import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

// v4 PRICING LOCKED 2026-06-03. Single self-serve tier: Pro $499/mo with
// a 14-day card-required trial. Enterprise is sales-led (see
// /book-call?intent=enterprise). Free tier requires NO checkout — just a
// signed-in profile. So this endpoint only handles 'pro'.

const PLANS: Record<string, { name: string; description: string; amountCents: number }> = {
  pro: {
    name: 'Shapi Pro',
    description: 'Multi-location org chart · Talent Match Pipeline · Active Hiring (AI shortlists + drafted outreach) · Salary Benchmark · Hiring Roadmap · Strategic Workforce Plan',
    amountCents: 49900, // $499/mo
  },
}

const TRIAL_DAYS = 14

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
    return NextResponse.json({ error: `Invalid plan: ${tier}. Only 'pro' is self-serve. Enterprise is sales-led — see /book-call?intent=enterprise.` }, { status: 400 })
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

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
    success_url: `${site}/company/welcome?tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/company/pricing`,
    metadata: {
      user_id: user.id,
      tier,
    },
  })

  return NextResponse.json({ url: session.url })
}
