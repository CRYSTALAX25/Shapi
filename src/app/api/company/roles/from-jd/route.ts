// Create a draft role straight from a Hiring Roadmap starter JD.
// Lets the company go: Roadmap → "Post this role" → editable draft in
// /company/roles/[id] without going through the long creation form.
//
// Status is set to 'draft' so the company can review/edit/publish, never
// auto-publishes a JD the company hasn't approved.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type StarterJD = {
  headline?: string
  responsibilities?: string[]
  must_haves?: string[]
  nice_to_haves?: string[]
  salary_band?: string
}

// Parse "$45-65k" / "$45,000-$65,000" / "AED 50000-80000" / "~$80k" → { min, max, currency }.
function parseSalaryBand(input: string | undefined): { min: number | null; max: number | null; currency: string | null } {
  if (!input) return { min: null, max: null, currency: null }
  const s = input.replace(/[,~]/g, '').trim()
  const currencyMatch = s.match(/[A-Z]{3}|[$£€¥₹]/)
  const currency = currencyMatch ? currencyMatch[0] : null
  // Find two numbers (with optional k/m suffix) separated by a dash.
  const nums = s.match(/(\d+(?:\.\d+)?)\s*([km]?)/gi) || []
  const parsed = nums.slice(0, 2).map(n => {
    const m = n.match(/(\d+(?:\.\d+)?)\s*([km]?)/i)
    if (!m) return null
    const base = parseFloat(m[1])
    const mult = m[2]?.toLowerCase() === 'k' ? 1000 : m[2]?.toLowerCase() === 'm' ? 1_000_000 : 1
    return Math.round(base * mult)
  }).filter((n): n is number => n !== null)
  if (parsed.length === 2) return { min: parsed[0], max: parsed[1], currency }
  if (parsed.length === 1) return { min: parsed[0], max: parsed[0], currency }
  return { min: null, max: null, currency }
}

function buildDescription(jd: StarterJD): string {
  const lines: string[] = []
  if (jd.headline) lines.push(jd.headline, '')
  if (jd.responsibilities?.length) {
    lines.push('What you\'ll do:')
    jd.responsibilities.forEach(r => lines.push(`• ${r}`))
    lines.push('')
  }
  if (jd.nice_to_haves?.length) {
    lines.push('Nice to have:')
    jd.nice_to_haves.forEach(r => lines.push(`• ${r}`))
  }
  return lines.join('\n').trim()
}

function buildRequirements(jd: StarterJD): string {
  if (!jd.must_haves?.length) return ''
  return jd.must_haves.map(m => `- ${m}`).join('\n')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', user.id)
    .single()
  if (!company || company.type !== 'company') {
    return NextResponse.json({ error: 'Company account required' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const title: string = typeof body.role === 'string' ? body.role.trim() : ''
  const jd: StarterJD = (body.starter_jd && typeof body.starter_jd === 'object') ? body.starter_jd : {}

  if (!title) return NextResponse.json({ error: 'Role title required' }, { status: 400 })

  const { min, max, currency } = parseSalaryBand(jd.salary_band)

  const { data: inserted, error } = await supabase
    .from('roles')
    .insert({
      company_id: user.id,
      title,
      description: buildDescription(jd),
      requirements: buildRequirements(jd),
      salary_min: min,
      salary_max: max,
      salary_currency: currency,
      // Don't auto-publish from a Roadmap suggestion — company reviews first.
      status: 'draft',
      salary_visible: true,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message || 'Could not create role' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: inserted.id })
}
