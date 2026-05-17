import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const TIERS = {
  kit: {
    amount: 2500, // $25
    name: 'Shapi CV Kit',
    description: 'English + native language CVs · All matched industry versions · Downloadable PDF · Shareable profile link.',
    product: 'cv_kit',
  },
  pro: {
    amount: 5900, // $59
    name: 'Shapi CV Pro',
    description: 'Everything in CV Kit · WhatsApp deep-dive for up to 3 target industries · Stories that basic reframing can\'t find · The CV that wins the specific role you want.',
    product: 'cv_pro',
  },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const tierKey = (body.tier === 'pro' ? 'pro' : 'kit') as 'kit' | 'pro'
  const tier = TIERS[tierKey]

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, stripe_customer_id, cv_parsed, cv_tier')
    .eq('id', user.id)
    .single()

  if (!profile?.cv_parsed) {
    return NextResponse.json({ error: 'Upload your CV first' }, { status: 400 })
  }

  // Already on pro — no need to buy kit
  if (profile.cv_tier === 'pro' && tierKey === 'kit') {
    return NextResponse.json({ error: 'Already on Pro tier' }, { status: 400 })
  }

  // Get or create Stripe customer
  let customerId = profile.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile.full_name || undefined,
      metadata: { supabase_id: user.id },
    })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: tier.amount,
          product_data: {
            name: tier.name,
            description: tier.description,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/cv-ready?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`,
    metadata: { user_id: user.id, product: tier.product, cv_tier: tierKey },
  })

  return NextResponse.json({ url: session.url })
}
