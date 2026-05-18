import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendCvKitEmail } from '@/lib/email'
import { getStripe, getWebhookSecret, stripeMode } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const stripe = getStripe()
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  // Try the current-mode secret first. If it fails AND the other mode's secret
  // is configured, try that too — this lets Stripe's LIVE webhook still verify
  // even when STRIPE_MODE=test (in case the dashboard sent us a stray event), and
  // avoids 400ing legitimate webhooks during mode transitions.
  try {
    event = stripe.webhooks.constructEvent(body, sig, getWebhookSecret())
  } catch {
    // Fallback: try the other mode's secret if available
    const altSecret = stripeMode === 'test' ? process.env.STRIPE_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET_TEST
    if (!altSecret) {
      console.error('[stripe/webhook] signature verification failed; no alternate secret to try')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
    try {
      event = stripe.webhooks.constructEvent(body, sig, altSecret)
      console.log('[stripe/webhook] verified against ALT mode webhook secret')
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  console.log('[stripe/webhook] mode:', stripeMode, '| event:', event.type)

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

      } else if (product === 'cv_kit' || product === 'cv_pro') {
        const cvTier = session.metadata?.cv_tier || 'kit'
        await supabase
          .from('profiles')
          .update({
            cv_kit_purchased: true,
            cv_tier: cvTier,
            stripe_customer_id: session.customer as string,
          })
          .eq('id', userId)
        console.log(`[stripe/webhook] CV ${cvTier} purchased for user:`, userId)

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
