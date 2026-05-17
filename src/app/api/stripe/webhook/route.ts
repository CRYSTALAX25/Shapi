import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendCvKitEmail } from '@/lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id
    const tier = session.metadata?.tier

    if (userId) {
      const product = session.metadata?.product

      if (tier) {
        // Company subscription
        await supabase
          .from('profiles')
          .update({
            paid: true,
            stripe_customer_id: session.customer as string,
            subscription_tier: tier,
            subscription_status: 'active',
            stripe_subscription_id: session.subscription as string,
          })
          .eq('id', userId)

      } else if (product === 'cv_kit') {
        // Candidate CV Kit — $29 one-time
        await supabase
          .from('profiles')
          .update({
            cv_kit_purchased: true,
            stripe_customer_id: session.customer as string,
          })
          .eq('id', userId)
        console.log('[stripe/webhook] CV Kit purchased for user:', userId)

        // Email the candidate their CV is ready
        const customerEmail = session.customer_details?.email || session.customer_email
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single()
        if (customerEmail) {
          sendCvKitEmail(customerEmail, profile?.full_name || '')
            .catch(err => console.error('[stripe/webhook] cv-kit email failed:', err))
        }

      } else {
        // Generic candidate one-time payment
        await supabase
          .from('profiles')
          .update({
            paid: true,
            stripe_customer_id: session.customer as string,
          })
          .eq('id', userId)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    await supabase
      .from('profiles')
      .update({ subscription_status: 'cancelled', paid: false })
      .eq('stripe_subscription_id', subscription.id)
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    await supabase
      .from('profiles')
      .update({ subscription_status: subscription.status as string })
      .eq('stripe_subscription_id', subscription.id)
  }

  return NextResponse.json({ received: true })
}
