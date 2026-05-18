import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNominatedReferenceEmail, sendReferencesVerifiedEmail } from '@/lib/email'
import { sendReferenceOutreach } from '@/lib/whatsapp'
import { recomputeProfileLive, resolveOutreachContact, computeJobCompletionScore, updateVerificationTier, runVerificationCrossCheck } from '@/lib/references'
import { NextResponse } from 'next/server'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

export async function POST(request: Request) {
  const body = await request.json()
  const {
    token,
    // Manager questions (5)
    quality, achievement, skills, would_rehire, anything_else,
    // Manager nominations — now include phone for each
    colleague_name, colleague_phone, colleague_email, colleague_title,
    stakeholder_name, stakeholder_phone, stakeholder_email, stakeholder_company,
    // Colleague / stakeholder questions (3)
    how_worked, biggest_strength, extra,
  } = body

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const admin = createAdminClient()

  const { data: ref, error } = await admin
    .from('candidate_references')
    .select('id, status, candidate_id, ref_type, job_slot, referee_name, candidate_company, candidate_job_title, candidate_dates, is_test_outreach, is_current_role')
    .eq('token', token)
    .single()

  if (error || !ref) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (ref.status === 'completed') return NextResponse.json({ error: 'Already submitted' }, { status: 400 })

  const refType = (ref.ref_type as string) || 'manager'
  const isManager = refType === 'manager'
  const isPeer = refType === 'peer'
  // Peer and nominees (colleague/stakeholder) use the same 3-question form.
  // Only managers cascade to nominees.
  const usesNomineeForm = !isManager

  if (isManager && (!quality || !achievement || !skills || !would_rehire)) {
    return NextResponse.json({ error: 'Missing required manager fields' }, { status: 400 })
  }
  if (usesNomineeForm && (!how_worked || !biggest_strength)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const responses = isManager
    ? { quality, achievement, skills, would_rehire, anything_else: anything_else || null }
    : { how_worked, biggest_strength, extra: extra || null }

  // Extract skills with Claude (non-fatal)
  let extractedSkills: string[] = []
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const allText = isManager
      ? `${quality} ${achievement} ${skills} ${anything_else || ''}`
      : `${how_worked} ${biggest_strength} ${extra || ''}`
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Extract professional skills mentioned in this reference. Return ONLY a JSON array of short strings (max 8 items).\n\n${allText}` }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : '[]'
    const s = text.indexOf('['), e = text.lastIndexOf(']')
    extractedSkills = s !== -1 && e !== -1 ? JSON.parse(text.slice(s, e + 1)) : []
  } catch { /* non-fatal */ }

  // Mark completed
  await admin.from('candidate_references').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    responses,
    extracted_skills: extractedSkills,
    updated_at: new Date().toISOString(),
  }).eq('id', ref.id)

  // ── Manager only: create + email the 2 nominees ──────────────────────────
  if (isManager) {
    const nominees = [
      colleague_name && (colleague_phone || colleague_email)
        ? { ref_type: 'colleague' as const, name: colleague_name, phone: colleague_phone || null, email: colleague_email || null, extra: colleague_title || null }
        : null,
      stakeholder_name && (stakeholder_phone || stakeholder_email)
        ? { ref_type: 'stakeholder' as const, name: stakeholder_name, phone: stakeholder_phone || null, email: stakeholder_email || null, extra: stakeholder_company || null }
        : null,
    ].filter(Boolean) as Array<{ ref_type: 'colleague' | 'stakeholder'; name: string; phone: string | null; email: string | null; extra: string | null }>

    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', ref.candidate_id).single()
    const candidateName = (profile?.full_name as string) || 'the candidate'

    for (const nominee of nominees) {
      try {
        const { data: inserted } = await admin.from('candidate_references').insert({
          candidate_id: ref.candidate_id,
          ref_type: nominee.ref_type,
          job_slot: ref.job_slot,
          nominated_by: ref.id,
          nominator_name: ref.referee_name,
          referee_name: nominee.name,
          referee_phone: nominee.phone,
          referee_email: nominee.email,
          referee_title: nominee.extra,
          referee_relationship: nominee.ref_type,
          candidate_job_title: ref.candidate_job_title,
          candidate_company: ref.candidate_company,
          candidate_dates: ref.candidate_dates,
          status: 'pending',
        }).select('id, token').single()

        if (inserted) {
          const row = inserted as { id: string; token: string }
          const referenceUrl = `${SITE}/reference/${row.token}`

          // Cascade test mode from the manager row down to the nominees
          const isTest = !!ref.is_test_outreach
          const outreach = await resolveOutreachContact(ref.candidate_id as string, nominee.phone, nominee.email, isTest)
          const testBanner = outreach.testMode ? '🧪 *TEST MODE* — this would normally go to the actual ' + nominee.ref_type + '.\n\n' : ''
          const channels: string[] = []

          // 1. WhatsApp / SMS first — invite chat, web form as fallback
          if (outreach.phone) {
            const waMsg =
              `${testBanner}Hi ${nominee.name.split(' ')[0]} 👋 I'm Shapi.\n\n` +
              `${ref.referee_name} at ${ref.candidate_company} suggested you worked with ${candidateName} and might share a perspective. ${candidateName.split(' ')[0]} doesn't know we've reached out — completely candid is welcome.\n\n` +
              `*Just reply to this message* — 3 short questions, voice notes or text, any language. Takes 2 minutes.\n\n` +
              `(Prefer a web form? ${referenceUrl})`

            const { whatsapp, sms } = await sendReferenceOutreach({
              phone: outreach.phone,
              message: waMsg,
              label: `${nominee.ref_type} ref for ${candidateName}${outreach.testMode ? ' [TEST]' : ''}`,
            })
            if (whatsapp) channels.push('whatsapp')
            else if (sms) channels.push('sms')
          }

          // 2. Email — always send if provided
          if (outreach.email) {
            await sendNominatedReferenceEmail({
              to: outreach.email,
              refereeName: outreach.testMode ? `${nominee.name} [TEST]` : nominee.name,
              candidateName,
              nominatorName: ref.referee_name as string,
              nominatorCompany: ref.candidate_company as string,
              nomineeRole: nominee.ref_type,
              referenceUrl,
            })
            channels.push('email')
          }

          // Persist the test flag + outreach channel on the nominee row
          await admin.from('candidate_references')
            .update({
              is_test_outreach: isTest,
              ...(channels.length > 0 ? {
                status: 'contacted',
                contacted_at: new Date().toISOString(),
                last_contacted_at: new Date().toISOString(),
                outreach_channel: channels.length > 1 ? channels.join('+') : channels[0],
              } : {}),
            })
            .eq('id', row.id)
        }
      } catch (err) {
        console.error(`[references/submit] ${nominee.ref_type} outreach failed:`, err)
      }
    }
  }

  // Tiered profile completion per Ana's spec:
  //   0 of 2 jobs complete → 75% floor (CV + WA + Purchased)
  //   1 of 2 jobs complete → 85% (+10)
  //   2 of 2 jobs complete → 100% AND profile_live=true
  const score = await computeJobCompletionScore(ref.candidate_id as string)
  const completionPct = 75 + score.bonusPct
  await admin.from('profiles').update({
    completion_pct: completionPct,
    updated_at: new Date().toISOString(),
  }).eq('id', ref.candidate_id)

  // Auto-flip profile_live when both jobs are fully verified
  const { profileLive } = await recomputeProfileLive(ref.candidate_id as string)

  // Verification tier + AI cross-check — runs whenever a reference completes.
  // Cross-check only runs after we have enough completed refs (≥3) so the
  // analysis has substance. Tier always recomputed.
  let tier
  try {
    const { data: completedRefs } = await admin
      .from('candidate_references')
      .select('id')
      .eq('candidate_id', ref.candidate_id)
      .eq('status', 'completed')
    const completedCount = completedRefs?.length || 0
    if (completedCount >= 3) {
      await runVerificationCrossCheck(ref.candidate_id as string)
    }
    tier = await updateVerificationTier(ref.candidate_id as string)
  } catch (err) {
    console.error('[references/submit] verification pipeline failed:', err)
  }

  // Notify the candidate the FIRST time a job's chain (3 refs) completes
  if (score.jobsComplete >= 1 && score.jobsComplete <= 2) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(ref.candidate_id as string)
      const { data: cProfile } = await admin.from('profiles').select('full_name').eq('id', ref.candidate_id).single()
      if (authUser?.user?.email) {
        // Count completed refs for display
        const { data: completedRefs } = await admin
          .from('candidate_references')
          .select('id')
          .eq('candidate_id', ref.candidate_id)
          .eq('status', 'completed')
        const completedCount = completedRefs?.length || 0
        await sendReferencesVerifiedEmail(authUser.user.email, (cProfile?.full_name as string) || '', completedCount)
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ success: true, completionPct, profileLive, jobsComplete: score.jobsComplete, tier })
}
