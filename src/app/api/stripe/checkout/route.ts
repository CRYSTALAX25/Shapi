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

  const { type } = await request.json()

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shapi — Verified Candidate Profile',
            description: 'One-time fee. Profile live until hired. Includes AI skills verification + independent reference.',
          },
          unit_amount: 4900,
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/upload-cv?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pay`,
    metadata: {
      user_id: user.id,
      type,
    },
  })

  return NextResponse.json({ url: session.url })
}
