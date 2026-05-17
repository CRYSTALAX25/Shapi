import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

type Candidate = {
  id: string
  full_name: string | null
  headline: string | null
  location: string | null
  skills: string[]
  ai_tier: string | null
  completion_pct: number
  summary: string | null
  whatsapp_chat: unknown[]
  industry: string | null
}

type Role = {
  id: string
  title: string
  department: string | null
  location: string | null
  requirements: string | null
  description: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
}

/**
 * Score a candidate against a role. Returns 0–100.
 *
 * Skills overlap  → up to 50 pts
 * Location match  → up to 20 pts
 * Dept / headline → up to 15 pts
 * Completion pct  → up to 15 pts
 */
function scoreCandidate(candidate: Candidate, role: Role): number {
  let score = 0

  // ── 1. Skills overlap (50 pts) ──────────────────────────────────────────
  const reqText = `${role.requirements || ''} ${role.description || ''} ${role.title || ''}`.toLowerCase()
  const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase())

  if (candidateSkills.length > 0) {
    let matchCount = 0
    for (const skill of candidateSkills) {
      // exact word match inside requirements text
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${escaped}\\b`).test(reqText)) matchCount++
    }
    // proportional — cap at 50
    const overlap = candidateSkills.length > 0 ? matchCount / candidateSkills.length : 0
    score += Math.round(overlap * 50)
  }

  // ── 2. Location match (20 pts) ──────────────────────────────────────────
  if (role.location && candidate.location) {
    const roleCity = role.location.toLowerCase()
    const candCity = candidate.location.toLowerCase()

    // Check if either contains the other (e.g. "Dubai" ↔ "Dubai, UAE")
    if (roleCity.includes(candCity) || candCity.includes(roleCity)) {
      score += 20
    } else {
      // Partial country/region match
      const roleWords = roleCity.split(/[\s,]+/)
      const candWords = candCity.split(/[\s,]+/)
      const hasOverlap = roleWords.some(w => w.length > 2 && candWords.includes(w))
      if (hasOverlap) score += 10
    }
  } else if (!role.location) {
    // Role is location-agnostic — no penalty
    score += 10
  }

  // ── 3. Department / headline keyword match (15 pts) ─────────────────────
  const deptText = `${role.department || ''} ${role.title || ''}`.toLowerCase()
  const headlineText = `${candidate.headline || ''} ${candidate.industry || ''}`.toLowerCase()

  if (deptText && headlineText) {
    const deptWords = deptText.split(/[\s,\/\-]+/).filter(w => w.length > 3)
    const headlineWords = headlineText.split(/[\s,\/\-]+/)
    const deptMatch = deptWords.some(w => headlineWords.some(h => h.includes(w) || w.includes(h)))
    if (deptMatch) score += 15
  }

  // ── 4. Profile completeness (15 pts) ────────────────────────────────────
  score += Math.round((candidate.completion_pct / 100) * 15)

  return Math.min(score, 100)
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const roleId = searchParams.get('role_id')

  if (!roleId) return NextResponse.json({ error: 'role_id required' }, { status: 400 })

  // Verify the role belongs to this company
  const { data: role } = await supabase
    .from('roles')
    .select('id, title, department, location, requirements, description, salary_min, salary_max, salary_currency')
    .eq('id', roleId)
    .eq('company_id', user.id)
    .single()

  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })

  // Fetch candidates (admin client — bypasses RLS)
  const admin = createAdminClient()
  const { data: candidates } = await admin
    .from('profiles')
    .select('id, full_name, headline, location, skills, ai_tier, completion_pct, summary, whatsapp_chat, industry')
    .eq('type', 'candidate')
    .gte('completion_pct', 20)
    .order('completion_pct', { ascending: false })
    .limit(200)

  if (!candidates) return NextResponse.json({ candidates: [], role })

  // Score and sort
  const scored = candidates
    .map(c => ({ ...c, match_score: scoreCandidate(c as Candidate, role as Role) }))
    .sort((a, b) => b.match_score - a.match_score)

  return NextResponse.json({ candidates: scored, role })
}
