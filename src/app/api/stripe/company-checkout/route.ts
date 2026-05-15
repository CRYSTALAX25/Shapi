import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tier } = await request.json()

  const plans: Record<string, { name: string; amount: number; description: string }> = {
    starter: {
      name: 'Shapi Starter',
      amount: 29900,
      description: 'Up to 5 active roles · Unlimited candidate views · Email support',
    },
    growth: {
      name: 'Shapi Growth',
      amount: 79900,
      description: 'Unlimited roles · Priority matching · Dedicated account manager',
    },
  }

  const plan = plans[tier]
  if (!plan) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: plan.name,
            description: plan.description,
          },
          unit_amount: plan.amount,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/candidates?subscribed=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/company/pricing`,
    metadata: {
      user_id: user.id,
      tier,
    },
  })

  return NextResponse.json({ url: session.url })
}
