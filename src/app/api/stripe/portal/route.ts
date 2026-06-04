import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

// Stripe Customer Portal — redirect endpoint. Used by /company/welcome and
// the welcome email to give the subscriber a self-serve billing dashboard
// (update card, view invoices, cancel). Reads stripe_customer_id from the
// signed-in user's profile, creates a Stripe Billing Portal session, 302s
// the user there.
//
// Both GET (for direct links from email / pages) and POST (for forms).

async function makePortalRedirect() {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/company/welcome',
      process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = (profile as { stripe_customer_id?: string | null })?.stripe_customer_id
  if (!customerId) {
    // No customer yet — send to pricing (probably never subscribed) rather
    // than an opaque error.
    return NextResponse.redirect(new URL('/company/pricing',
      process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'))
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'}/company/dashboard`,
  })

  return NextResponse.redirect(session.url)
}

export async function GET() {
  return makePortalRedirect()
}

export async function POST() {
  return makePortalRedirect()
}
