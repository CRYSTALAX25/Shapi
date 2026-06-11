// Candidate subscription checkout — Open Roles Board, Shapi Active, Concierge,
// Bundle. Creates a recurring Stripe Checkout session in subscription mode.
// The webhook (checkout.session.completed) reads metadata.product and appends it
// to profiles.subscription_product[], which gates the features.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { PRODUCT_PRICES, PRODUCT_LABELS, type SubscriptionProduct } from '@/lib/subscriptions'

const DESCRIPTIONS: Record<SubscriptionProduct, string> = {
  // v5: Active now includes seeing every open role (the old standalone Roles
  // Board is merged in). Bundle is killed.
  active_monthly: 'See every open role, scan jobs, draft outreach, track applications and prep for interviews.',
  active_yearly: 'See every open role, scan jobs, draft outreach, track applications and prep for interviews.',
  concierge_monthly: 'AI drafts personalised intros daily — you just approve and send.',
  active_hiring_monthly: 'Daily AI-shortlisted verified candidates per open role, with drafted outreach awaiting your one-tap approval.',
  active_hiring_yearly: 'Daily AI-shortlisted verified candidates per open role, with drafted outreach awaiting your one-tap approval. Annual save.',
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product, trial } = await request.json().catch(() => ({}))
  const price = PRODUCT_PRICES[product as SubscriptionProduct]
  if (!price) return NextResponse.json({ error: 'Invalid product' }, { status: 400 })

  // Trial is opt-in via the request body. Only Active Hiring offers a trial
  // today (peak-intent moment is right after a company posts a role). Other
  // products fall through to immediate billing. Cap at 14 days to keep the
  // semantics narrow.
  const trialDays = product === 'active_hiring_monthly' && typeof trial === 'number' && trial > 0
    ? Math.min(trial, 14)
    : null

  const site = process.env.NEXT_PUBLIC_SITE_URL
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: PRODUCT_LABELS[product as SubscriptionProduct],
            description: DESCRIPTIONS[product as SubscriptionProduct],
          },
          unit_amount: price.amount * 100,
          recurring: { interval: price.interval },
        },
        quantity: 1,
      },
    ],
    // Trial is on the Stripe side — they collect the card now, charge after
    // the trial window. Cancel anytime during trial = no charge.
    ...(trialDays ? { subscription_data: { trial_period_days: trialDays } } : {}),
    success_url: `${site}/dashboard?subscribed=${product}${trialDays ? `&trial=${trialDays}` : ''}`,
    cancel_url: `${site}/dashboard`,
    metadata: { user_id: user.id, product, ...(trialDays ? { trial_days: String(trialDays) } : {}) },
  })

  return NextResponse.json({ url: session.url })
}
