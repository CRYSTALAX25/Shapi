// Employer prestige overlay — manually-curated analyst ratings for
// hiring companies. Used to show candidates whether the company they're
// considering is recognised in its industry (Gartner MQ leader, Forrester
// Wave leader, G2 Grid leader, etc.).
//
// We do this offline rather than via paid Gartner/Forrester APIs because:
//   - The signals change slowly (yearly cycle)
//   - For the candidate side, "is this company respected" is binary enough
//     that a curated list captures 95% of the value
//   - Free alternatives (G2, Glassdoor) provide reputational signal for
//     the long tail we can't reach with analyst reports
//
// To add a company: lookup their most recent Gartner MQ / Forrester Wave /
// G2 Grid position and add a row. Keep `source_year` honest so the badge
// can de-rank stale entries.

export type AnalystPosition = 'leader' | 'challenger' | 'visionary' | 'niche' | 'strong_performer' | 'contender'

export type CompanyPrestige = {
  gartner_mq?: { category: string; position: AnalystPosition; year: number }
  forrester_wave?: { category: string; position: AnalystPosition; year: number }
  g2_grid?: { category: string; position: AnalystPosition; year: number }
  glassdoor?: number   // out of 5
  ft500?: boolean       // FT Global 500 large-cap
  // Free-form note for the badge tooltip (e.g. "Recognised AI leader 2024")
  note?: string
}

// Keyed by normalized company name (lowercase, stripped of common suffixes)
const PRESTIGE: Record<string, CompanyPrestige> = {
  // Cloud / Infra
  'microsoft': { gartner_mq: { category: 'Cloud (Azure)', position: 'leader', year: 2024 }, ft500: true, glassdoor: 4.4 },
  'aws': { gartner_mq: { category: 'Cloud (IaaS)', position: 'leader', year: 2024 }, ft500: true, glassdoor: 3.9 },
  'amazon web services': { gartner_mq: { category: 'Cloud (IaaS)', position: 'leader', year: 2024 }, ft500: true, glassdoor: 3.9 },
  'amazon': { gartner_mq: { category: 'Cloud (IaaS)', position: 'leader', year: 2024 }, ft500: true, glassdoor: 3.7 },
  'google': { gartner_mq: { category: 'Cloud Platform', position: 'leader', year: 2024 }, ft500: true, glassdoor: 4.4 },
  'google cloud': { gartner_mq: { category: 'Cloud Platform', position: 'leader', year: 2024 }, glassdoor: 4.3 },
  'snowflake': { gartner_mq: { category: 'Cloud Data Warehouse', position: 'leader', year: 2024 }, glassdoor: 4.1 },
  'databricks': { gartner_mq: { category: 'Data Lakehouse', position: 'leader', year: 2024 }, glassdoor: 4.5 },
  'oracle': { gartner_mq: { category: 'Enterprise DB', position: 'leader', year: 2024 }, ft500: true, glassdoor: 3.8 },
  'sap': { gartner_mq: { category: 'ERP', position: 'leader', year: 2024 }, ft500: true, glassdoor: 4.2 },

  // CRM / Salestech
  'salesforce': { gartner_mq: { category: 'CRM Customer Engagement', position: 'leader', year: 2024 }, ft500: true, glassdoor: 4.1 },
  'hubspot': { g2_grid: { category: 'CRM', position: 'leader', year: 2024 }, glassdoor: 4.4 },
  'pipedrive': { g2_grid: { category: 'CRM', position: 'leader', year: 2024 } },
  'zoho': { g2_grid: { category: 'CRM', position: 'strong_performer', year: 2024 } },

  // Marketing / Adtech
  'adobe': { gartner_mq: { category: 'DXP', position: 'leader', year: 2024 }, ft500: true, glassdoor: 4.2 },
  'sitecore': { gartner_mq: { category: 'DXP', position: 'challenger', year: 2024 } },
  'optimizely': { forrester_wave: { category: 'CMS', position: 'leader', year: 2024 } },

  // Cybersecurity
  'crowdstrike': { gartner_mq: { category: 'Endpoint Protection', position: 'leader', year: 2024 }, glassdoor: 4.5 },
  'palo alto networks': { gartner_mq: { category: 'Network Firewalls', position: 'leader', year: 2024 }, ft500: true, glassdoor: 4.3 },
  'fortinet': { gartner_mq: { category: 'Network Firewalls', position: 'leader', year: 2024 }, glassdoor: 4.0 },
  'sentinelone': { gartner_mq: { category: 'Endpoint Protection', position: 'leader', year: 2024 }, glassdoor: 3.7 },
  'cloudflare': { gartner_mq: { category: 'WAAP', position: 'leader', year: 2024 }, glassdoor: 4.2 },

  // Dev / DevOps
  'gitlab': { gartner_mq: { category: 'DevOps Platforms', position: 'leader', year: 2024 }, glassdoor: 4.3 },
  'github': { gartner_mq: { category: 'DevOps Platforms', position: 'leader', year: 2024 }, glassdoor: 4.5 },
  'atlassian': { gartner_mq: { category: 'Agile Planning', position: 'leader', year: 2024 }, glassdoor: 4.3 },
  'jetbrains': { glassdoor: 4.5, note: 'Top-rated developer-tool maker' },
  'datadog': { gartner_mq: { category: 'Observability', position: 'leader', year: 2024 }, glassdoor: 4.1 },
  'splunk': { gartner_mq: { category: 'SIEM', position: 'leader', year: 2024 }, glassdoor: 4.0 },
  'mongodb': { gartner_mq: { category: 'Cloud DBMS', position: 'leader', year: 2024 }, glassdoor: 4.1 },
  'elastic': { gartner_mq: { category: 'Observability', position: 'visionary', year: 2024 }, glassdoor: 4.0 },
  'hashicorp': { glassdoor: 4.4, note: 'IaC market leader (Terraform)' },

  // AI / Data
  'openai': { glassdoor: 4.6, note: 'Defining the genAI category' },
  'anthropic': { glassdoor: 4.7, note: 'Frontier AI lab (Claude)' },
  'hugging face': { glassdoor: 4.4, note: 'Open-source ML ecosystem leader' },
  'nvidia': { ft500: true, glassdoor: 4.6, note: 'AI compute leader' },
  'scale ai': { glassdoor: 4.0, note: 'AI data infrastructure leader' },

  // Fintech / Finance
  'stripe': { glassdoor: 4.3, note: 'Payments infrastructure leader' },
  'block': { ft500: true, glassdoor: 4.0 },
  'square': { ft500: true, glassdoor: 4.0 },
  'paypal': { ft500: true, glassdoor: 3.9 },
  'visa': { ft500: true, glassdoor: 4.3 },
  'mastercard': { ft500: true, glassdoor: 4.3 },
  'jpmorgan chase': { ft500: true, glassdoor: 4.0 },
  'goldman sachs': { ft500: true, glassdoor: 3.9 },
  'morgan stanley': { ft500: true, glassdoor: 4.0 },
  'blackrock': { ft500: true, glassdoor: 4.1 },

  // Consulting
  'mckinsey': { glassdoor: 4.3, note: 'Top-tier global strategy consulting' },
  'bcg': { glassdoor: 4.3, note: 'Top-tier global strategy consulting' },
  'boston consulting group': { glassdoor: 4.3, note: 'Top-tier global strategy consulting' },
  'bain': { glassdoor: 4.6, note: 'Top-tier global strategy consulting' },
  'bain & company': { glassdoor: 4.6, note: 'Top-tier global strategy consulting' },
  'accenture': { ft500: true, glassdoor: 4.0 },
  'deloitte': { ft500: true, glassdoor: 4.0 },
  'pwc': { ft500: true, glassdoor: 3.9 },
  'ey': { ft500: true, glassdoor: 3.9 },
  'kpmg': { ft500: true, glassdoor: 3.9 },

  // Hospitality / Travel
  'marriott': { ft500: true, glassdoor: 4.0 },
  'hilton': { ft500: true, glassdoor: 4.1 },
  'accor': { glassdoor: 3.9 },
  'four seasons': { glassdoor: 4.2, note: 'Top-rated luxury hospitality employer' },
  'jumeirah': { glassdoor: 3.9 },
  'rotana': { glassdoor: 3.8 },
  'emirates': { ft500: true, glassdoor: 4.1, note: 'World-class aviation employer' },
  'qatar airways': { glassdoor: 3.9 },
  'etihad airways': { glassdoor: 3.8 },

  // UAE / regional
  'emaar': { glassdoor: 3.9, note: 'Leading UAE real estate developer' },
  'careem': { glassdoor: 4.0, note: 'MENA tech leader (acquired by Uber)' },
  'noon': { glassdoor: 3.4 },
  'talabat': { glassdoor: 3.6 },
  'tabby': { glassdoor: 4.1, note: 'MENA BNPL leader' },
  'majid al futtaim': { glassdoor: 3.8 },
  'emirates nbd': { glassdoor: 3.9 },
  'dubai holding': { glassdoor: 3.7 },
  'mubadala': { glassdoor: 4.0, note: 'Abu Dhabi sovereign investor' },
  'adq': { glassdoor: 3.8 },

  // Misc majors
  'apple': { ft500: true, glassdoor: 4.2 },
  'meta': { ft500: true, glassdoor: 4.2 },
  'facebook': { ft500: true, glassdoor: 4.2 },
  'tesla': { ft500: true, glassdoor: 3.6 },
  'spacex': { glassdoor: 4.0, note: 'Industry-defining aerospace employer' },
  'netflix': { ft500: true, glassdoor: 3.9 },
  'spotify': { glassdoor: 4.1 },
  'shopify': { glassdoor: 4.2 },
  'cloudflare ': { gartner_mq: { category: 'WAAP', position: 'leader', year: 2024 } },
}

// Common suffixes to strip when normalizing a name for lookup
const SUFFIXES = [
  ' inc.', ' inc', ' llc', ' ltd.', ' ltd', ' limited',
  ' plc', ' s.a.', ' s.a', ' sa', ' gmbh', ' ag', ' nv',
  ' corp.', ' corp', ' corporation', ' co.', ' co',
  ' group', ' holdings', ' international',
]

function normalize(name: string): string {
  let n = (name || '').toLowerCase().trim()
  // Trailing comma/period bits
  n = n.replace(/[.,]$/, '').trim()
  for (const suffix of SUFFIXES) {
    if (n.endsWith(suffix)) {
      n = n.slice(0, -suffix.length).trim()
      break
    }
  }
  // Collapse whitespace
  n = n.replace(/\s+/g, ' ')
  return n
}

export function getPrestigeForCompany(name: string | null | undefined): CompanyPrestige | null {
  if (!name) return null
  const key = normalize(name)
  if (key in PRESTIGE) return PRESTIGE[key]
  // Try first word match for short brand names ("Stripe Inc" → "stripe")
  const firstWord = key.split(' ')[0]
  if (firstWord && firstWord !== key && firstWord.length >= 4 && firstWord in PRESTIGE) {
    return PRESTIGE[firstWord]
  }
  return null
}

// Convert position → human label for badges
export function positionLabel(p: AnalystPosition): string {
  switch (p) {
    case 'leader': return 'Leader'
    case 'challenger': return 'Challenger'
    case 'visionary': return 'Visionary'
    case 'niche': return 'Niche'
    case 'strong_performer': return 'Strong Performer'
    case 'contender': return 'Contender'
  }
}

// Pick a single most-impressive accolade for compact card display
export function topAccolade(p: CompanyPrestige): { label: string; tooltip: string; tone: 'gold' | 'teal' | 'purple' } | null {
  if (p.gartner_mq?.position === 'leader') {
    return {
      label: 'Gartner MQ Leader',
      tooltip: `Gartner Magic Quadrant Leader · ${p.gartner_mq.category} · ${p.gartner_mq.year}`,
      tone: 'gold',
    }
  }
  if (p.forrester_wave?.position === 'leader') {
    return {
      label: 'Forrester Leader',
      tooltip: `Forrester Wave Leader · ${p.forrester_wave.category} · ${p.forrester_wave.year}`,
      tone: 'gold',
    }
  }
  if (p.gartner_mq) {
    return {
      label: `Gartner MQ ${positionLabel(p.gartner_mq.position)}`,
      tooltip: `Gartner Magic Quadrant ${positionLabel(p.gartner_mq.position)} · ${p.gartner_mq.category} · ${p.gartner_mq.year}`,
      tone: 'teal',
    }
  }
  if (p.g2_grid?.position === 'leader') {
    return {
      label: 'G2 Grid Leader',
      tooltip: `G2 Grid Leader · ${p.g2_grid.category} · ${p.g2_grid.year}`,
      tone: 'teal',
    }
  }
  if (p.ft500) {
    return {
      label: 'FT 500',
      tooltip: 'Member of the Financial Times Global 500 — among the largest companies in the world',
      tone: 'purple',
    }
  }
  if (p.note) {
    return { label: 'Notable employer', tooltip: p.note, tone: 'purple' }
  }
  return null
}
