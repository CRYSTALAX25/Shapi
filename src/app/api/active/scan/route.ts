import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAnthropic } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_role, location, keywords } = await request.json()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, skills, work_history, summary, industry, location')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const anthropic = getAnthropic()

  const searchQuery = [target_role || profile.headline, location || profile.location, keywords].filter(Boolean).join(' ')

  // Use Claude with web search to find real job postings
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
    messages: [{
      role: 'user',
      content: `Search for job openings that match this candidate's profile. Find 5-8 real, currently open positions.

CANDIDATE PROFILE:
- Name: ${profile.full_name}
- Headline: ${profile.headline}
- Industry: ${profile.industry}
- Skills: ${(profile.skills as string[] || []).join(', ')}
- Location: ${profile.location}
- Summary: ${(profile.summary as string || '').slice(0, 300)}

SEARCH CRITERIA:
- Target role: ${target_role || profile.headline || 'similar to current role'}
- Location: ${location || profile.location || 'UAE, Saudi Arabia'}
- Keywords: ${keywords || ''}

Search LinkedIn Jobs, Bayt.com, GulfTalent, and Indeed for matching roles. Focus on direct company postings (avoid recruitment agency posts where possible).

For each job found, return JSON array:
[{
  "job_title": "exact title",
  "company_name": "company name",
  "company_website": "company.com or null",
  "job_url": "direct link to the posting",
  "location": "city, country",
  "salary_range": "if shown or null",
  "match_reason": "1 sentence: why this matches the candidate",
  "match_score": 0-100,
  "posted_date": "when posted or null",
  "key_requirements": ["req1", "req2", "req3"]
}]

Return ONLY the JSON array. No other text.`,
    }],
  })

  // Extract text from response (may have tool use blocks)
  let jobsText = ''
  for (const block of response.content) {
    if (block.type === 'text') jobsText += block.text
  }

  let jobs = []
  try {
    const match = jobsText.match(/\[[\s\S]*\]/)
    if (match) jobs = JSON.parse(match[0])
  } catch {
    // Try to extract partial
    jobs = []
  }

  // Score against candidate profile
  const candidateSkills = (profile.skills as string[] || []).map(s => s.toLowerCase())
  const scored = jobs.map((job: Record<string, unknown>) => {
    const baseScore = (job.match_score as number) || 50
    const reqText = ((job.key_requirements as string[] || []).join(' ')).toLowerCase()
    const skillHits = candidateSkills.filter(s => reqText.includes(s)).length
    const bonus = Math.min(20, skillHits * 5)
    return { ...job, match_score: Math.min(100, baseScore + bonus) }
  }).sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.match_score as number) - (a.match_score as number))

  return NextResponse.json({ jobs: scored, query: searchQuery, profile_headline: profile.headline })
}
