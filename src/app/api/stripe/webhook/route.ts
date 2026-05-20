import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendCvKitEmail } from '@/lib/email'
import { getStripe, getWebhookSecret, stripeMode } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Map product metadata → the per-product column we store the subscription id in.
// Lets us cancel just one subscription without touching the others, and lets
// the deletion webhook reverse-lookup which product to remove from the array.
const SUBSCRIPTION_PRODUCT_COLUMN: Record<string, string> = {
  roles_board_monthly: 'roles_board_subscription_id',
  roles_board_yearly: 'roles_board_subscription_id',
  active_monthly: 'active_subscription_id',
  active_yearly: 'active_subscription_id',
  concierge_monthly: 'concierge_subscription_id',
  bundle_monthly: 'bundle_subscription_id',
  bundle_yearly: 'bundle_subscription_id',
}

function isCandidateSubscriptionProduct(p: string | undefined): boolean {
  return !!p && p in SUBSCRIPTION_PRODUCT_COLUMN
}

// Append a product to the array, dedupe, write back. Read-modify-write — fine
// for our scale; Postgres array_append would be marginally safer but Supabase
// doesn't expose it cleanly here.
async function addSubscriptionProduct(userId: string, product: string, subscriptionId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_product')
    .eq('id', userId)
    .single()

  const existing: string[] = Array.isArray(profile?.subscription_product) ? profile.subscription_product : []
  const next = Array.from(new Set([...existing, product]))

  const column = SUBSCRIPTION_PRODUCT_COLUMN[product]
  const updates: Record<string, unknown> = { subscription_product: next }
  if (column) updates[column] = subscriptionId

  await supabase.from('profiles').update(updates).eq('id', userId)
  console.log(`[stripe/webhook] +subscription_product[${product}] for user ${userId} (sub ${subscriptionId})`)
}

// Remove a product from the array when its subscription is cancelled/deleted.
// We look up the user by the per-product column (rather than a single shared
// stripe_subscription_id) so the right product gets removed.
async function removeSubscriptionBySubscriptionId(subscriptionId: string) {
  for (const product of Object.keys(SUBSCRIPTION_PRODUCT_COLUMN)) {
    const column = SUBSCRIPTION_PRODUCT_COLUMN[product]
    const { data: hits } = await supabase
      .from('profiles')
      .select('id, subscription_product')
      .eq(column, subscriptionId)

    if (hits && hits.length > 0) {
      for (const row of hits) {
        const next = Array.isArray(row.subscription_product)
          ? row.subscription_product.filter((p: string) => p !== product)
          : []
        await supabase
          .from('profiles')
          .update({ subscription_product: next, [column]: null })
          .eq('id', row.id)
        console.log(`[stripe/webhook] -subscription_product[${product}] for user ${row.id} (sub ${subscriptionId} cancelled)`)
      }
      return
    }
  }
}

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
    const product = session.metadata?.product

    if (userId) {
      // Candidate recurring subscription (Roles Board, Active, Concierge, Bundle)
      if (isCandidateSubscriptionProduct(product) && session.subscription) {
        await addSubscriptionProduct(userId, product!, session.subscription as string)

      } else if (tier) {
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
          sendCvKitEmail(customerEmail, profile?.full_name || '', cvTier === 'pro' ? 'pro' : 'kit')
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

    // First: existing company-subscription path (stripe_subscription_id column)
    await supabase
      .from('profiles')
      .update({ subscription_status: 'cancelled', paid: false })
      .eq('stripe_subscription_id', subscription.id)

    // Then: candidate per-product subscriptions (subscription_product[] array)
    await removeSubscriptionBySubscriptionId(subscription.id)
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    // Update status on company-subscription rows
    await supabase
      .from('profiles')
      .update({ subscription_status: subscription.status as string })
      .eq('stripe_subscription_id', subscription.id)
    // If the candidate subscription was cancelled/unpaid mid-cycle, remove it
    // from subscription_product[] so gating turns off immediately.
    if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'incomplete_expired') {
      await removeSubscriptionBySubscriptionId(subscription.id)
    }
  }

  return NextResponse.json({ received: true })
}
