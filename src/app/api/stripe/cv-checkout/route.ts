import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, stripe_customer_id, cv_parsed')
    .eq('id', user.id)
    .single()

  if (!profile?.cv_parsed) {
    return NextResponse.json({ error: 'Upload your CV first' }, { status: 400 })
  }

  // Get or create Stripe customer
  let customerId = profile.stripe_customer_id
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
          unit_amount: 2900, // $29
          product_data: {
            name: 'Shapi CV Kit',
            description: 'Your AI-built professional CV — English + native language versions, downloadable PDF, shareable profile link.',
            images: [],
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/cv-ready?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`,
    metadata: { user_id: user.id, product: 'cv_kit' },
  })

  return NextResponse.json({ url: session.url })
}
