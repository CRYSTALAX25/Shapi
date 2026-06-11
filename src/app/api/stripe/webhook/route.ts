import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendCvKitEmail, sendCompanyWelcomeEmail } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'
import { getStripe, getWebhookSecret, stripeMode } from '@/lib/stripe'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

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
  // Company-side products (STRATEGY §14 / §16)
  active_hiring_monthly: 'active_hiring_subscription_id',
  active_hiring_yearly: 'active_hiring_subscription_id',
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
        // Company subscription. v5 self-serve tiers: 'pro' ($499) + 'growth'
        // ($1,500). Enterprise is sales-led (/api/company/enterprise-trial).
        //
        // Subscription_status: new sessions carry metadata.trial_applied
        // ('true'/'false') from company-checkout. Legacy in-flight sessions
        // (pre-deploy) always included a 14-day trial, so default pro/growth
        // to 'trialing' when the breadcrumb is absent.
        const trialApplied = session.metadata?.trial_applied
          ? session.metadata.trial_applied === 'true'
          : (tier === 'pro' || tier === 'growth' || !!session.metadata?.trial_period_days)
        const subStatus = trialApplied ? 'trialing' : 'active'
        // Map the public tier names to the plan_tier value FeatureGate /
        // currentTier() reads. v5: growth MUST map to 'growth' — entitlements
        // resolve it to the active_hiring rung (full diagnostic suite +
        // candidate pool). Mapping it to 'pro' would give every $1,500/mo
        // Growth subscriber $499 Pro entitlements. Legacy 'starter' → 'pro'.
        const planTier = tier === 'enterprise' ? 'enterprise'
          : tier === 'growth' ? 'growth'
          : 'pro'
        const companyUpdates: Record<string, unknown> = {
          paid: true,
          stripe_customer_id: session.customer as string,
          subscription_tier: tier,
          subscription_status: subStatus,
          stripe_subscription_id: session.subscription as string,
          plan_tier: planTier,
        }
        // Stamp trial_ends_at so company-checkout can reliably tell "has this
        // profile ever trialed?" (one trial per company — no trial cycling).
        // 14 days matches TRIAL_DAYS in company-checkout.
        if (trialApplied) {
          companyUpdates.trial_ends_at = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()
        }
        // NOTE: founding_partner is NO LONGER stamped here. checkout.session.
        // completed fires at TRIAL START ($0 collected) — stamping here let 15
        // trial-and-cancels exhaust the founding cohort with zero revenue. The
        // stamp now happens in the invoice.payment_succeeded handler below,
        // on the first invoice with amount_paid > 0, via the founding='true'
        // breadcrumb company-checkout puts on subscription_data.metadata.
        const { error: companyUpdateErr } = await supabase
          .from('profiles')
          .update(companyUpdates)
          .eq('id', userId)
        if (companyUpdateErr) {
          console.error('[stripe/webhook] company subscription update failed:', companyUpdateErr.message)
        }

        // ── Brand welcome email — Stripe sends the receipt + invoice
        // automatically; this is the "you're in, here's the loop" email
        // from hello@shapi.io.
        const customerEmail = session.customer_details?.email || session.customer_email
        if (customerEmail) {
          const { data: companyProfile } = await supabase
            .from('profiles')
            .select('company_name, full_name')
            .eq('id', userId)
            .single()
          const displayName = companyProfile?.company_name || companyProfile?.full_name || 'there'
          sendCompanyWelcomeEmail({ to: customerEmail, companyName: displayName, tier })
            .catch(err => console.error('[stripe/webhook] company welcome email failed:', err))
        }

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

  // ── Dunning: payment failed ───────────────────────────────────────────────
  // Up to 40% of all SaaS churn is involuntary payment failure. Stripe retries
  // the card on its own schedule; our job is the COMMUNICATION layer. Stamp
  // the moment of failure, kick the user a WhatsApp NOW with a Customer
  // Portal link to update their card, and let the cron handle Day 3 + Day 7
  // follow-ups. Requires the supabase/dunning.sql migration; degrades quietly
  // if columns aren't present yet.
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    if (customerId) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, company_name, whatsapp_number')
          .eq('stripe_customer_id', customerId)
          .single()
        if (profile) {
          // Stamp the failure + reset dunning_step to 0 (start of cycle).
          await supabase
            .from('profiles')
            .update({ payment_failed_at: new Date().toISOString(), dunning_step: 0 })
            .eq('id', profile.id)
            .then(() => undefined, () => undefined)

          if (profile.whatsapp_number) {
            // Build a Customer Portal URL so they can update card in one tap.
            let portalUrl = `${SITE}/company/pricing`
            try {
              const portal = await stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: `${SITE}/company/dashboard`,
              })
              portalUrl = portal.url
            } catch (e) {
              console.warn('[stripe/webhook] portal session failed:', e)
            }
            const name = (profile.company_name as string | null) || (profile.full_name as string | null) || 'there'
            await sendWhatsApp(
              profile.whatsapp_number as string,
              `Hi ${name} — your Shapi payment just failed.\n\nMost common cause: expired card or insufficient funds. *Tap to update in 30 seconds:*\n\n${portalUrl}\n\nYour access stays live for the next 7 days while we sort this. After that we&apos;ll keep all your data but pause paid features until the card is updated.`
            )
          }
        }
      } catch (e) {
        console.error('[stripe/webhook] payment_failed handler error:', e)
      }
    }
  }

  // Payment recovered — clear the dunning state so the cron stops nudging.
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice

    // ── Founding Partner stamp (STRATEGY §2 LOCKED v5) ────────────────────
    // Stamped HERE — on the first invoice with REAL money (amount_paid > 0) —
    // not at checkout completion, which fires at trial start with $0
    // collected. Flow: company-checkout puts founding='true' + user_id on
    // subscription_data.metadata → Stripe snapshots that metadata onto each
    // invoice (invoice.parent.subscription_details.metadata) → when the first
    // paid invoice lands we flip profiles.founding_partner=true. That flag is
    // what foundingRedeemedCount() counts against the cap of 15, so trial-
    // and-cancels never consume a founding slot. Re-stamping on later paid
    // invoices is idempotent (true → true). Degrades quietly if the
    // founding_partner column hasn't been migrated yet.
    if (invoice.amount_paid > 0) {
      try {
        const subDetails = invoice.parent?.subscription_details
        let subMeta: Record<string, string> | null | undefined = subDetails?.metadata
        if (!subMeta) {
          // Metadata snapshot missing (rare) — fall back to retrieving the
          // subscription directly.
          const subId = typeof subDetails?.subscription === 'string'
            ? subDetails.subscription
            : subDetails?.subscription?.id
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId)
            subMeta = sub.metadata
          }
        }
        if (subMeta?.founding === 'true' && subMeta.user_id) {
          const { error: foundingErr } = await supabase
            .from('profiles')
            .update({ founding_partner: true })
            .eq('id', subMeta.user_id)
          if (foundingErr) {
            console.warn('[stripe/webhook] founding stamp failed (column missing?):', foundingErr.message)
          } else {
            console.log('[stripe/webhook] founding_partner stamped on first PAID invoice for user', subMeta.user_id)
          }
        }
      } catch (e) {
        console.error('[stripe/webhook] founding stamp handler error:', e)
      }
    }

    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    if (customerId) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, payment_failed_at, whatsapp_number, company_name, full_name')
          .eq('stripe_customer_id', customerId)
          .single()
        if (profile && (profile as { payment_failed_at?: string | null }).payment_failed_at) {
          await supabase
            .from('profiles')
            .update({ payment_failed_at: null, dunning_step: 0 })
            .eq('id', profile.id)
            .then(() => undefined, () => undefined)
          if (profile.whatsapp_number) {
            const name = (profile.company_name as string | null) || (profile.full_name as string | null) || 'there'
            await sendWhatsApp(
              profile.whatsapp_number as string,
              `✓ Payment received, ${name}. You're all set — thanks for sorting that out.`,
            )
          }
        }
      } catch (e) {
        console.error('[stripe/webhook] payment_succeeded recovery handler error:', e)
      }
    }
  }

  return NextResponse.json({ received: true })
}
