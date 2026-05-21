import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

export async function POST(request: Request) {
  const stripe = getStripe()
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

  // Founding Partner promo: 50% off for the first 3 months, on top of a 30-day
  // free trial. Charged on the STANDARD price so it auto-reverts to full price
  // after 3 months. Idempotent coupon — created once, reused after.
  let foundingCouponId: string | undefined
  try {
    const c = await stripe.coupons.retrieve('founding50_3mo')
    foundingCouponId = c.id
  } catch {
    try {
      const c = await stripe.coupons.create({
        id: 'founding50_3mo',
        percent_off: 50,
        duration: 'repeating',
        duration_in_months: 3,
        name: 'Founding Partner — 50% off (3 mo)',
      })
      foundingCouponId = c.id
    } catch {
      foundingCouponId = undefined // fall back to standard pricing if coupon fails
    }
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
    subscription_data: { trial_period_days: 30 },
    ...(foundingCouponId ? { discounts: [{ coupon: foundingCouponId }] } : {}),
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/candidates?subscribed=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/company/pricing`,
    metadata: {
      user_id: user.id,
      tier,
    },
  })

  return NextResponse.json({ url: session.url })
}
