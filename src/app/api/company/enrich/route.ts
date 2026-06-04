import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Vercel Pro plan — 300s ceiling. Enrich fetches 4 external URLs + calls
// Claude; without this it defaults to 60s which Ana hit repeatedly during
// onboarding (Chrome shows "This page couldn't load" when an API function
// times out mid-stream). 120s is comfortable headroom: 4×5s fetches in
// parallel + ~15s Claude call = ~20s typical, 120s catches cold starts +
// any slow external source.
export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { company_name, website } = await request.json()
  if (!company_name) return NextResponse.json({ error: 'company_name required' }, { status: 400 })

  console.log('[enrich] Starting enrichment for:', company_name)

  // Fetch public pages in parallel. 5s per-URL cap — a source that's too
  // slow simply contributes nothing to the prompt. This keeps the total
  // function time predictable instead of waiting for the slowest source.
  const fetchSafe = async (url: string) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Shapi/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      return res.ok ? await res.text() : ''
    } catch { return '' }
  }

  const [glassdoorHtml, redditHtml, linkedinHtml, newsHtml] = await Promise.all([
    fetchSafe(`https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(company_name)}`),
    fetchSafe(`https://www.reddit.com/search.json?q=${encodeURIComponent(company_name + ' company culture')}&sort=relevance&limit=10`),
    fetchSafe(`https://www.linkedin.com/company/${encodeURIComponent(company_name.toLowerCase().replace(/\s+/g, '-'))}`),
    fetchSafe(`https://news.google.com/rss/search?q=${encodeURIComponent(company_name)}&hl=en`),
  ])

  // Parse Reddit JSON
  let redditSnippets = ''
  try {
    const redditData = JSON.parse(redditHtml)
    redditSnippets = redditData?.data?.children
      ?.slice(0, 5)
      ?.map((c: { data: { title: string; selftext: string } }) => `${c.data.title}: ${c.data.selftext?.slice(0, 200)}`)
      ?.join('\n') || ''
  } catch { /* no reddit data */ }

  // Extract news headlines from RSS
  const newsHeadlines = (newsHtml.match(/<title>(.*?)<\/title>/g) || [])
    .slice(1, 8)
    .map(t => t.replace(/<\/?title>/g, ''))
    .join(', ')

  // Strip HTML for Glassdoor/LinkedIn snippets
  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are extracting company information for a hiring platform profile.

Company: ${company_name}
Website: ${website || 'unknown'}

DATA COLLECTED FROM PUBLIC SOURCES:

LinkedIn page snippet:
${stripHtml(linkedinHtml).slice(0, 800) || 'Not found'}

Glassdoor search snippet:
${stripHtml(glassdoorHtml).slice(0, 800) || 'Not found'}

Reddit mentions (employee/candidate discussions):
${redditSnippets || 'None found'}

Recent news:
${newsHeadlines || 'None found'}

Extract what you can find and return ONLY valid JSON:
{
  "description": "2-3 sentence factual company overview (what they do, where, scale)",
  "industry": "primary industry",
  "size": "estimated company size (e.g. 50-200, 1000-5000, 10000+)",
  "founded": "founding year or null",
  "headquarters": "city, country or null",
  "glassdoor_rating": null or number 1-5,
  "glassdoor_reviews_count": null or number,
  "reddit_sentiment": "positive | mixed | negative | unknown",
  "reddit_themes": ["theme1", "theme2"] up to 3 recurring themes from Reddit,
  "recent_news": ["headline 1", "headline 2"] up to 3 most relevant headlines,
  "red_flags": [] or up to 2 concerning signals from public data,
  "green_flags": [] or up to 2 positive signals,
  "last_enriched": "${new Date().toISOString()}"
}`

  let companyData: Record<string, unknown> = { last_enriched: new Date().toISOString() }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) companyData = JSON.parse(match[0])
  } catch (err) {
    console.error('[enrich] Claude error:', err)
  }

  // Save to profile
  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({
      company_data: companyData,
      company_name: company_name,
      company_website: website || null,
      company_size: (companyData.size as string) || null,
    })
    .eq('id', user.id)

  console.log('[enrich] Enrichment complete for:', company_name)
  return NextResponse.json({ company_data: companyData })
}
