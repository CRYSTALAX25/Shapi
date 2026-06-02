// Stripe checkout for Shapi candidate products.
//
// Supports:
//   - 'kit'                 → CV Kit, $25 one-time
//   - 'pro'                 → CV Pro, $59 one-time (includes Kit access)
//   - 'roles_board_monthly' → Open Roles Board, $19/month (subscription)
//   - 'roles_board_yearly'  → Open Roles Board, $149/year (subscription)
//   - 'active_monthly'      → Shapi Active, $29/month (subscription)
//   - 'active_yearly'       → Shapi Active, $249/year (subscription)
//   - 'concierge_monthly'   → Active Concierge, $89/month (subscription)
//   - 'bundle_monthly'      → Roles Board + Active bundle, $39/month
//   - 'bundle_yearly'       → Roles Board + Active bundle, $349/year
//
// The Stripe webhook reads session.metadata.product to know which subscription
// to flip on (or which one-time purchase to credit).

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStripe, stripeMode } from '@/lib/stripe'

type ProductKey =
  | 'kit' | 'pro'
  | 'roles_board_monthly' | 'roles_board_yearly'
  | 'active_monthly' | 'active_yearly'
  | 'concierge_monthly'
  | 'bundle_monthly' | 'bundle_yearly'

type ProductConfig = {
  amount: number              // in cents
  name: string
  description: string
  product: string             // identifier sent in session.metadata.product
  mode: 'payment' | 'subscription'
  interval?: 'month' | 'year' // only for subscriptions
  requires?: 'pro' | 'cv_parsed'  // gate before allowing purchase
}

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
  roles_board_monthly: {
    amount: 1900, name: 'Open Roles Board (monthly)',
    description: 'Visible to hiring companies · Get shortlisted · Inbound match notifications.',
    product: 'roles_board_monthly', mode: 'subscription', interval: 'month', requires: 'pro',
  },
  roles_board_yearly: {
    amount: 14900, name: 'Open Roles Board (yearly)',
    description: 'Visible to hiring companies · Get shortlisted · Inbound match notifications. Best price.',
    product: 'roles_board_yearly', mode: 'subscription', interval: 'year', requires: 'pro',
  },
  active_monthly: {
    amount: 2900, name: 'Shapi Active (monthly)',
    description: 'Job scanner · AI cover letters · Applications tracker · Interview prep briefs.',
    product: 'active_monthly', mode: 'subscription', interval: 'month', requires: 'pro',
  },
  active_yearly: {
    amount: 24900, name: 'Shapi Active (yearly)',
    description: 'Job scanner · AI cover letters · Applications tracker · Interview prep briefs. Best price.',
    product: 'active_yearly', mode: 'subscription', interval: 'year', requires: 'pro',
  },
  concierge_monthly: {
    amount: 7900, name: 'Active Concierge (monthly)',
    description: 'Daily AI-shortlisted matches · One-tap personalised outreach · Auto-send opt-in.',
    product: 'concierge_monthly', mode: 'subscription', interval: 'month', requires: 'pro',
  },
  bundle_monthly: {
    amount: 3900, name: 'Career bundle (monthly)',
    description: 'Open Roles Board + Shapi Active. Save vs buying separately.',
    product: 'bundle_monthly', mode: 'subscription', interval: 'month', requires: 'pro',
  },
  bundle_yearly: {
    amount: 34900, name: 'Career bundle (yearly)',
    description: 'Open Roles Board + Shapi Active. Save vs buying separately. Best price.',
    product: 'bundle_yearly', mode: 'subscription', interval: 'year', requires: 'pro',
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, stripe_customer_id, cv_parsed, cv_tier, subscription_product')
    .eq('id', user.id)
    .single()

  // Pre-flight gates
  if (product.requires === 'cv_parsed' && !profile?.cv_parsed) {
    return NextResponse.json({ error: 'Upload your CV first' }, { status: 400 })
  }
  if (product.requires === 'pro' && profile?.cv_tier !== 'pro') {
    return NextResponse.json({ error: 'CV Pro is required for this subscription. Purchase Pro first.' }, { status: 400 })
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
              unit_amount: product.amount,
              recurring: { interval: product.interval! },
              product_data: { name: product.name, description: product.description },
            },
            quantity: 1,
          }
        : {
            price_data: {
              currency: 'usd',
              unit_amount: product.amount,
              product_data: { name: product.name, description: product.description },
            },
            quantity: 1,
          },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pay-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`,
    metadata: {
      user_id: user.id,
      product: product.product,
      cv_tier: productKey === 'kit' ? 'kit' : productKey === 'pro' ? 'pro' : '',
    },
  })

  return NextResponse.json({ url: session.url, product_key: productKey })
}
