import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// POST /api/company/enterprise-trial
//
// Flips the signed-in company user into a 14-day Enterprise trial. No
// Stripe involvement — Enterprise pricing is sales-led (see memory
// project-enterprise-trial-provisional), so the actual price is scoped
// in a sales call before the trial ends. The trial just unlocks the
// feature gates so prospects can experience the full product.
//
// Side-effects:
//   1. Updates profile.plan_tier='enterprise', trial_ends_at = +14 days,
//      subscription_status='trialing'
//   2. Emails Ana at hello@shapi.io with the trial signup details so
//      sales can reach out within 24h
//
// Provisional: this endpoint exists for end-to-end testing pre-launch.
// Decision to either keep, restrict to qualified ICP, or remove is parked
// until launch — see memory project-enterprise-trial-provisional.

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, company_website, location')
    .eq('id', user.id)
    .single()

  if (!profile || profile.type !== 'company') {
    return NextResponse.json({ error: 'Company account required' }, { status: 403 })
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()

  // Use the admin client for the update — RLS would otherwise let it through
  // for the signed-in user but admin is the safer pattern when we're flipping
  // plan tier / billing fields.
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      plan_tier: 'enterprise',
      trial_ends_at: trialEndsAt,
      subscription_status: 'trialing',
      subscription_tier: 'enterprise',
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('[enterprise-trial] update failed:', updateError.message)
    return NextResponse.json({ error: 'Could not start trial' }, { status: 500 })
  }

  // Fire-and-forget admin notification email. Best-effort — don't block the
  // user's redirect on it.
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      resend.emails.send({
        from: 'Shapi <hello@shapi.io>',
        to: 'ana.vbarber@gmail.com',
        subject: `Enterprise trial started: ${profile.company_name || user.email}`,
        html: `
          <p><strong>New Enterprise trial signup</strong></p>
          <ul>
            <li>Company: ${profile.company_name || '—'}</li>
            <li>Website: ${profile.company_website || '—'}</li>
            <li>HQ: ${profile.location || '—'}</li>
            <li>User: ${user.email}</li>
            <li>User ID: ${user.id}</li>
            <li>Trial ends: ${trialEndsAt}</li>
          </ul>
          <p>Reach out within 24h to scope pricing and confirm fit.</p>
        `,
      }).catch(err => console.error('[enterprise-trial] admin email failed:', err))
    } catch (err) {
      console.error('[enterprise-trial] admin email setup failed:', err)
    }
  }

  return NextResponse.json({
    success: true,
    trial_ends_at: trialEndsAt,
  })
}
