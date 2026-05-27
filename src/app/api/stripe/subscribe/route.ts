// Candidate subscription checkout — Open Roles Board, Shapi Active, Concierge,
// Bundle. Creates a recurring Stripe Checkout session in subscription mode.
// The webhook (checkout.session.completed) reads metadata.product and appends it
// to profiles.subscription_product[], which gates the features.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { PRODUCT_PRICES, PRODUCT_LABELS, type SubscriptionProduct } from '@/lib/subscriptions'

const DESCRIPTIONS: Record<SubscriptionProduct, string> = {
  roles_board_monthly: 'Browse verified roles ranked by match + get shortlisted by companies.',
  roles_board_yearly: 'Browse verified roles ranked by match + get shortlisted by companies.',
  active_monthly: 'Scan jobs, draft outreach, track applications and prep for interviews.',
  active_yearly: 'Scan jobs, draft outreach, track applications and prep for interviews.',
  concierge_monthly: 'AI drafts personalised intros daily — you just approve and send.',
  bundle_monthly: 'Open Roles Board + Shapi Active together.',
  bundle_yearly: 'Open Roles Board + Shapi Active together.',
  active_hiring_monthly: 'Daily AI-shortlisted verified candidates per open role, with drafted outreach awaiting your one-tap approval.',
  active_hiring_yearly: 'Daily AI-shortlisted verified candidates per open role, with drafted outreach awaiting your one-tap approval. Annual save.',
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product } = await request.json().catch(() => ({}))
  const price = PRODUCT_PRICES[product as SubscriptionProduct]
  if (!price) return NextResponse.json({ error: 'Invalid product' }, { status: 400 })

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
    success_url: `${site}/dashboard?subscribed=${product}`,
    cancel_url: `${site}/dashboard`,
    metadata: { user_id: user.id, product },
  })

  return NextResponse.json({ url: session.url })
}
