import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseHQ } from '@/lib/parseHQ'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, company_website, company_data, company_size')
    .eq('id', user.id)
    .single()

  if (!profile || profile.type !== 'company') {
    return NextResponse.json({ error: 'Company account required' }, { status: 403 })
  }

  type CompanyData = { headquarters?: string; industry?: string; size?: string; description?: string; last_enriched?: string }
  let companyData = (profile.company_data || {}) as CompanyData

  // If no enrichment yet (or stale > 30d), kick off enrich.
  const stale = !companyData.last_enriched || (Date.now() - new Date(companyData.last_enriched).getTime() > 30 * 24 * 3600 * 1000)
  if (stale && profile.company_name) {
    try {
      // Call enrich inline. Same Anthropic + scraping logic; result writes to profiles.company_data.
      const enrichRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'}/api/company/enrich`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: '' }, // server-side, no cookie
        body: JSON.stringify({ company_name: profile.company_name, website: profile.company_website }),
      }).catch(() => null)
      if (enrichRes?.ok) {
        const data = await enrichRes.json()
        companyData = data.company_data || companyData
      }
    } catch (err) {
      console.error('[spine/autofill-location] enrich error:', err)
    }
  }

  // Service-role re-read in case enrich just wrote.
  if (!companyData.headquarters && profile.company_name) {
    const admin = createAdminClient()
    const { data: fresh } = await admin
      .from('profiles')
      .select('company_data')
      .eq('id', user.id)
      .single()
    if (fresh?.company_data) companyData = fresh.company_data as CompanyData
  }

  const { city, country, timezone } = parseHQ(companyData.headquarters)
  return NextResponse.json({
    name: profile.company_name ? `${profile.company_name} HQ` : '',
    city,
    country,
    timezone,
    headquarters_raw: companyData.headquarters || null,
    industry: companyData.industry || null,
    size: companyData.size || null,
    description: companyData.description || null,
    source: companyData.last_enriched ? 'enriched' : 'none',
  })
}
