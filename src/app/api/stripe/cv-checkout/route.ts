// Stripe checkout for Shapi candidate products.
//
// v5.1 PRICING (2026-06-11, STRATEGY §2). Candidate ladder:
//   - 'kit'                 → CV Kit, $25 one-time ($9 blue-collar self-selected)
//   - 'pro'                 → CV Pro, $59 one-time (includes Kit access)
//   - 'active_monthly'      → Shapi Active, $29/month (now INCLUDES all open roles)
//   - 'active_yearly'       → Shapi Active, $249/year
//   - 'concierge_monthly'   → Active Concierge, $89/month  (was buggy $79 — fixed)
//
// KILLED in v5: the standalone Roles Board ($19) is merged into Active, and the
// Career Bundle ($39) is removed entirely. Their checkout paths no longer exist
// here, so no new subscription of those types can be created.
//
// v5.1 UNBUNDLE: subscriptions (Active / Concierge) no longer require CV Pro.
// CV Pro is a standalone one-time product, not a prerequisite — anyone with a
// parsed CV can subscribe directly.
//
// v5.1 BLUE-COLLAR KIT: body { tier:'kit', blue_collar:true } charges $9
// instead of $25 (honest self-selection, no policing). metadata.product stays
// 'cv_kit' so the webhook's fulfillment path is unchanged. Kit only — not Pro.
//
// The Stripe webhook reads session.metadata.product to know which subscription
// to flip on (or which one-time purchase to credit).

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStripe, stripeMode } from '@/lib/stripe'

type ProductKey =
  | 'kit' | 'pro'
  | 'active_monthly' | 'active_yearly'
  | 'concierge_monthly'

type ProductConfig = {
  amount: number              // in cents
  name: string
  description: string
  product: string             // identifier sent in session.metadata.product
  mode: 'payment' | 'subscription'
  interval?: 'month' | 'year' // only for subscriptions
  requires?: 'cv_parsed'      // gate before allowing purchase
}

// Blue-collar Kit price — v5.1 (2026-06-11): $9 self-selected on /pay for
// hourly / trade / service workers. Same product, same fulfillment.
const KIT_BLUE_COLLAR_AMOUNT = 900

const PRODUCTS: Record<ProductKey, ProductConfig> = {
  kit: {
    amount: 2500, name: 'Shapi CV Kit',
    description: 'Multi-language CVs + industry-targeted versions · Downloadable PDF · Yours to keep.',
    product: 'cv_kit', mode: 'payment', requires: 'cv_parsed',
  },
  pro: {
    amount: 5900, name: 'Shapi CV Pro',
    description: 'CV Kit + WhatsApp deep-dive interviews + verification chain + AI cross-check + Career Roadmap.',
    product: 'cv_pro', mode: 'payment', requires: 'cv_parsed',
  },
  // v5: Active now INCLUDES the old Open Roles Board — candidates see every
  // open role plus the job tools. v5.1: NO CV Pro prerequisite — subscriptions
  // are unbundled from the one-time CV products.
  active_monthly: {
    amount: 2900, name: 'Shapi Active (monthly)',
    description: 'See every open role · Job scanner · AI cover letters · Applications tracker · Interview prep briefs.',
    product: 'active_monthly', mode: 'subscription', interval: 'month',
  },
  active_yearly: {
    amount: 24900, name: 'Shapi Active (yearly)',
    description: 'See every open role · Job scanner · AI cover letters · Applications tracker · Interview prep briefs. Best price.',
    product: 'active_yearly', mode: 'subscription', interval: 'year',
  },
  // Concierge — LOCKED at $89/mo. (Live bug fix: previously charged $79/7900.)
  concierge_monthly: {
    amount: 8900, name: 'Active Concierge (monthly)',
    description: 'Daily AI-shortlisted matches · One-tap personalised outreach · Auto-send opt-in.',
    product: 'concierge_monthly', mode: 'subscription', interval: 'month',
  },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()
  console.log('[stripe/cv-checkout] mode:', stripeMode)

  const body = await request.json().catch(() => ({}))
  const requestedKey = body.tier || body.product || 'kit'
  if (!(requestedKey in PRODUCTS)) {
    return NextResponse.json({ error: `Unknown product: ${requestedKey}` }, { status: 400 })
  }
  const productKey = requestedKey as ProductKey
  const product = PRODUCTS[productKey]

  // v5.1 blue-collar self-selection — Kit only, honest self-select, no policing.
  const blueCollar = productKey === 'kit' && body.blue_collar === true
  const chargeAmount = blueCollar ? KIT_BLUE_COLLAR_AMOUNT : product.amount

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, stripe_customer_id, cv_parsed, cv_tier, subscription_product')
    .eq('id', user.id)
    .single()

  // Pre-flight gates. (v5.1: the old `requires: 'pro'` gate on subscriptions
  // is GONE — Active/Concierge no longer require a prior CV Pro purchase.)
  if (product.requires === 'cv_parsed' && !profile?.cv_parsed) {
    return NextResponse.json({ error: 'Upload your CV first' }, { status: 400 })
  }
  if (productKey === 'kit' && profile?.cv_tier === 'pro') {
    return NextResponse.json({ error: 'You already have Pro tier (includes Kit access).' }, { status: 400 })
  }
  // Don't allow double-subscribing to the same product
  const existingSubs: string[] = Array.isArray(profile?.subscription_product) ? profile.subscription_product : []
  if (product.mode === 'subscription' && existingSubs.includes(product.product)) {
    return NextResponse.json({ error: `You're already subscribed to ${product.name}.` }, { status: 400 })
  }

  // Get or create Stripe customer
  let customerId = profile?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.full_name || undefined,
      metadata: { supabase_id: user.id },
    })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: product.mode,
    line_items: [
      product.mode === 'subscription'
        ? {
            price_data: {
              currency: 'usd',
              unit_amount: chargeAmount,
              recurring: { interval: product.interval! },
              product_data: { name: product.name, description: product.description },
            },
            quantity: 1,
          }
        : {
            price_data: {
              currency: 'usd',
              unit_amount: chargeAmount,
              product_data: { name: product.name, description: product.description },
            },
            quantity: 1,
          },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pay-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`,
    metadata: {
      user_id: user.id,
      // Stays 'cv_kit' even for the $9 blue-collar price — the webhook's
      // fulfillment switch (product === 'cv_kit') must keep matching.
      product: product.product,
      cv_tier: productKey === 'kit' ? 'kit' : productKey === 'pro' ? 'pro' : '',
      // Observability only — fulfillment is identical either way.
      ...(blueCollar ? { blue_collar: 'true' } : {}),
    },
  })

  return NextResponse.json({ url: session.url, product_key: productKey })
}
