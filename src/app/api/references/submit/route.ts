import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNominatedReferenceEmail, sendReferencesVerifiedEmail } from '@/lib/email'
import { sendReferenceOutreach } from '@/lib/whatsapp'
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
    .select('id, status, candidate_id, ref_type, job_slot, referee_name, candidate_company, candidate_job_title, candidate_dates')
    .eq('token', token)
    .single()

  if (error || !ref) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (ref.status === 'completed') return NextResponse.json({ error: 'Already submitted' }, { status: 400 })

  const refType = (ref.ref_type as string) || 'manager'
  const isManager = refType === 'manager'

  if (isManager && (!quality || !achievement || !skills || !would_rehire)) {
    return NextResponse.json({ error: 'Missing required manager fields' }, { status: 400 })
  }
  if (!isManager && (!how_worked || !biggest_strength)) {
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
          let contacted = false

          // 1. WhatsApp / SMS first
          if (nominee.phone) {
            const waMsg =
              `Hi ${nominee.name.split(' ')[0]} 👋 ${ref.referee_name} at ${ref.candidate_company} suggested you worked with ${candidateName} and might share a perspective.\n\n` +
              `${candidateName.split(' ')[0]} doesn't know we've reached out — you can be completely candid. Takes 2 minutes:\n\n${referenceUrl}`

            const { whatsapp, sms } = await sendReferenceOutreach({
              phone: nominee.phone,
              message: waMsg,
              label: `${nominee.ref_type} ref for ${candidateName}`,
            })
            if (whatsapp || sms) contacted = true
          }

          // 2. Email — always send if provided
          if (nominee.email) {
            await sendNominatedReferenceEmail({
              to: nominee.email,
              refereeName: nominee.name,
              candidateName,
              nominatorName: ref.referee_name as string,
              nominatorCompany: ref.candidate_company as string,
              nomineeRole: nominee.ref_type,
              referenceUrl,
            })
            contacted = true
          }

          if (contacted) {
            await admin.from('candidate_references')
              .update({ status: 'contacted', contacted_at: new Date().toISOString() })
              .eq('id', row.id)
          }
        }
      } catch (err) {
        console.error(`[references/submit] ${nominee.ref_type} outreach failed:`, err)
      }
    }
  }

  // Update profile completion & maybe notify candidate
  const { data: allRefs } = await admin.from('candidate_references').select('status').eq('candidate_id', ref.candidate_id)
  const completedCount = (allRefs || []).filter(r => r.status === 'completed').length

  await admin.from('profiles').update({
    completion_pct: Math.min(100, 70 + completedCount * 5),
    updated_at: new Date().toISOString(),
  }).eq('id', ref.candidate_id)

  // Notify candidate at 3+ completed
  if (completedCount >= 3) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(ref.candidate_id as string)
      const { data: cProfile } = await admin.from('profiles').select('full_name').eq('id', ref.candidate_id).single()
      if (authUser?.user?.email) {
        await sendReferencesVerifiedEmail(authUser.user.email, (cProfile?.full_name as string) || '', completedCount)
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ success: true })
}
