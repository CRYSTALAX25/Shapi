import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendManagerReferenceEmail } from '@/lib/email'
import { sendReferenceOutreach } from '@/lib/whatsapp'
import { resolveOutreachContact } from '@/lib/references'
import { NextResponse } from 'next/server'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    job_slot,
    ref_type: rawRefType,         // 'manager' (default for past roles) | 'peer' (for current role)
    is_current_role,              // true when this is the candidate's current job (gates peer ref + skips nominee cascade)
    suggested_reason,             // Claude's reasoning from /api/references/suggest (shown to candidate)
    referee_name,
    referee_phone,                // WhatsApp / phone — primary outreach channel
    referee_email,                // secondary / always sent alongside
    referee_title,
    candidate_job_title,
    candidate_company,
    candidate_dates,
    is_test_outreach,             // when true, all outreach for this row + its nominees routes to the candidate
  } = body

  const refType: 'manager' | 'peer' = rawRefType === 'peer' ? 'peer' : 'manager'

  if (!referee_name || !job_slot || !candidate_company || (!referee_phone && !referee_email)) {
    return NextResponse.json({ error: 'Name, company, and at least one contact method required.' }, { status: 400 })
  }

  // Self-reference guard — phone-based (catches the common copy-paste mistake)
  // unless this is an explicit test-mode submission (in which case we WANT the
  // candidate's contact details to be used).
  if (!is_test_outreach) {
    const { data: ownProfile } = await supabase
      .from('profiles')
      .select('whatsapp_number')
      .eq('id', user.id)
      .single()
    const ownPhone = (ownProfile?.whatsapp_number as string | null)?.replace(/\s+/g, '')
    const refPhone = (referee_phone as string | null)?.replace(/\s+/g, '')
    if (ownPhone && refPhone && ownPhone === refPhone) {
      return NextResponse.json({
        error: 'That looks like your own phone. References must be from someone else who worked with you. (Or tick "Test mode" if you\'re validating the flow.)',
      }, { status: 400 })
    }
    if (referee_email && user.email && referee_email.toLowerCase() === user.email.toLowerCase()) {
      return NextResponse.json({
        error: 'That looks like your own email. Use the email of the manager you reported to.',
      }, { status: 400 })
    }
  }

  // Light phone format validation — Twilio requires E.164 (+countrycode...)
  if (referee_phone && !/^\+?\d{8,15}$/.test(referee_phone.replace(/\s+/g, ''))) {
    return NextResponse.json({
      error: 'Phone must include country code, e.g. +971501234567',
    }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const candidateName = (profile?.full_name as string) || 'the candidate'

  // Upsert — one ref per (job_slot, ref_type) per candidate. Manager and peer
  // live on different ref_types so they don't collide on the same slot.
  const { data: existing } = await admin
    .from('candidate_references')
    .select('id, token')
    .eq('candidate_id', user.id)
    .eq('job_slot', job_slot)
    .eq('ref_type', refType)
    .maybeSingle()

  let ref: { id: string; token: string }

  if (existing) {
    await admin.from('candidate_references').update({
      referee_name,
      referee_phone: referee_phone || null,
      referee_email: referee_email || null,
      referee_title: referee_title || null,
      candidate_job_title: candidate_job_title || null,
      candidate_company,
      candidate_dates: candidate_dates || null,
      is_test_outreach: !!is_test_outreach,
      is_current_role: !!is_current_role,
      suggested_reason: suggested_reason || null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
    ref = existing as { id: string; token: string }
  } else {
    const { data: inserted, error } = await admin.from('candidate_references').insert({
      candidate_id: user.id,
      ref_type: refType,
      job_slot,
      referee_name,
      referee_phone: referee_phone || null,
      referee_email: referee_email || null,
      referee_title: referee_title || null,
      referee_relationship: refType === 'peer' ? 'peer_colleague' : 'direct_manager',
      candidate_job_title: candidate_job_title || null,
      candidate_company,
      candidate_dates: candidate_dates || null,
      is_test_outreach: !!is_test_outreach,
      is_current_role: !!is_current_role,
      suggested_reason: suggested_reason || null,
      status: 'pending',
    }).select('id, token').single()

    if (error || !inserted) {
      console.error('[references/request]', error?.message)
      return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })
    }
    ref = inserted as { id: string; token: string }
  }

  const referenceUrl = `${SITE}/reference/${ref.token}`
  const candidateFirst = candidateName.split(' ')[0]

  // Resolve where the outreach actually goes — for test mode, redirect everything
  // to the candidate's own WhatsApp + email so they can play all 3 roles
  const outreach = await resolveOutreachContact(user.id, referee_phone || null, referee_email || null, !!is_test_outreach)
  const testBanner = outreach.testMode ? '🧪 *TEST MODE* — this would normally go to the actual manager.\n\n' : ''

  let channels: string[] = []

  // 1. WhatsApp / SMS first (if phone provided)
  if (outreach.phone) {
    const relationLabel = refType === 'peer' ? 'a colleague they currently work with' : 'their manager'
    const waMsg = refType === 'peer'
      ? `${testBanner}Hi ${referee_name.split(' ')[0]} 👋 ${candidateName} listed you as a colleague at ${candidate_company}.\n\nWe're building their verified profile on Shapi — your perspective as someone who works with them helps a lot. 3 short questions, takes 2 minutes:\n\n${referenceUrl}\n\n${candidateFirst} can't edit your responses — they appear exactly as you write them.`
      : `${testBanner}Hi ${referee_name.split(' ')[0]} 👋 ${candidateName} listed you as ${relationLabel} at ${candidate_company}.\n\nWe're building their verified profile on Shapi. Takes 5 minutes — your honest answers help them stand out to the right employers.\n\nFill in here: ${referenceUrl}\n\n${candidateFirst} can't edit your responses — they appear exactly as you write them.`

    const { whatsapp, sms } = await sendReferenceOutreach({
      phone: outreach.phone,
      message: waMsg,
      label: `${refType} ref slot ${job_slot} for ${candidateName}${outreach.testMode ? ' [TEST]' : ''}`,
    })
    if (whatsapp) channels.push('whatsapp')
    else if (sms) channels.push('sms')
  }

  // 2. Email — always send if provided (belt + suspenders)
  if (outreach.email) {
    try {
      await sendManagerReferenceEmail({
        to: outreach.email,
        refereeName: outreach.testMode ? `${referee_name} [TEST]` : referee_name,
        candidateName,
        candidateJobTitle: candidate_job_title || 'their role',
        candidateCompany: candidate_company,
        candidateDates: candidate_dates || '',
        referenceUrl,
      })
      channels.push('email')
    } catch (err) {
      console.error('[references/request] Email failed:', err)
    }
  }

  if (channels.length > 0) {
    await admin.from('candidate_references')
      .update({
        status: 'contacted',
        contacted_at: new Date().toISOString(),
        last_contacted_at: new Date().toISOString(),
        outreach_channel: channels.length > 1 ? channels.join('+') : channels[0],
      })
      .eq('id', ref.id)
  }

  return NextResponse.json({ success: true, id: ref.id, channels, testMode: outreach.testMode })
}

// GET — list all references for the current candidate
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: refs } = await admin
    .from('candidate_references')
    .select('id, ref_type, job_slot, referee_name, referee_title, candidate_company, candidate_job_title, candidate_dates, status, nominated_by, nominator_name')
    .eq('candidate_id', user.id)
    .order('job_slot', { ascending: true })

  return NextResponse.json({ refs: refs || [] })
}
