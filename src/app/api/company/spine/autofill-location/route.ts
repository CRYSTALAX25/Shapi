import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const COUNTRY_TO_ISO: Record<string, string> = {
  'saudi arabia': 'SA', 'ksa': 'SA', 'kingdom of saudi arabia': 'SA',
  'united arab emirates': 'AE', 'uae': 'AE', 'emirates': 'AE',
  'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM',
  'india': 'IN', 'pakistan': 'PK', 'bangladesh': 'BD',
  'philippines': 'PH', 'egypt': 'EG', 'jordan': 'JO', 'lebanon': 'LB',
  'turkey': 'TR', 'germany': 'DE', 'france': 'FR', 'spain': 'ES',
  'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB',
  'united states': 'US', 'usa': 'US', 'us': 'US',
  'canada': 'CA', 'singapore': 'SG',
}

const CITY_TO_TZ: Record<string, string> = {
  'riyadh': 'Asia/Riyadh', 'jeddah': 'Asia/Riyadh', 'dammam': 'Asia/Riyadh',
  'dubai': 'Asia/Dubai', 'abu dhabi': 'Asia/Dubai', 'sharjah': 'Asia/Dubai',
  'doha': 'Asia/Qatar', 'kuwait city': 'Asia/Kuwait', 'manama': 'Asia/Bahrain',
  'muscat': 'Asia/Muscat', 'cairo': 'Africa/Cairo', 'amman': 'Asia/Amman',
  'beirut': 'Asia/Beirut', 'istanbul': 'Europe/Istanbul',
  'mumbai': 'Asia/Kolkata', 'bangalore': 'Asia/Kolkata', 'delhi': 'Asia/Kolkata',
  'karachi': 'Asia/Karachi', 'dhaka': 'Asia/Dhaka', 'manila': 'Asia/Manila',
  'london': 'Europe/London', 'paris': 'Europe/Paris', 'berlin': 'Europe/Berlin',
  'madrid': 'Europe/Madrid', 'new york': 'America/New_York',
  'san francisco': 'America/Los_Angeles', 'toronto': 'America/Toronto',
  'singapore': 'Asia/Singapore',
}

function parseHQ(hq: string | null | undefined): { city: string; country: string; timezone: string } {
  if (!hq) return { city: '', country: '', timezone: '' }
  const parts = hq.split(',').map(s => s.trim())
  const cityRaw = parts[0] || ''
  const countryRaw = parts[parts.length - 1] || ''
  const cityLower = cityRaw.toLowerCase()
  const countryLower = countryRaw.toLowerCase()
  const country = COUNTRY_TO_ISO[countryLower] || (countryRaw.length === 2 ? countryRaw.toUpperCase() : '')
  const timezone = CITY_TO_TZ[cityLower] || ''
  return { city: cityRaw, country, timezone }
}

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
