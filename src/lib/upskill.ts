// Upskill catalogue helpers.
//
// We deliberately link to platform SEARCH pages (not specific course URLs) so
// links never rot or 404 — the candidate lands on a live, relevant result set.
// Each provider is tagged with a cost tier so the /upskill page can group them
// into Free / Paid / Financing columns.

export type CostTier = 'free' | 'paid' | 'financing'

export type Provider = {
  name: string
  tier: CostTier
  // Build a search URL for a given skill query
  searchUrl: (q: string) => string
  note?: string
}

const enc = (s: string) => encodeURIComponent(s.trim())

export const PROVIDERS: Provider[] = [
  // ── Free ──
  { name: 'Coursera — free to learn', tier: 'free', searchUrl: q => `https://www.coursera.org/search?query=${enc(q)}`, note: 'Watch all the lessons free; only pay if you want the certificate at the end.' },
  { name: 'edX — free to learn', tier: 'free', searchUrl: q => `https://www.edx.org/search?q=${enc(q)}`, note: 'Take the whole course free; the verified certificate is the only paid part.' },
  { name: 'YouTube', tier: 'free', searchUrl: q => `https://www.youtube.com/results?search_query=${enc(q + ' full course')}`, note: 'Full-length courses from creators — no certificate.' },
  { name: 'freeCodeCamp', tier: 'free', searchUrl: q => `https://www.freecodecamp.org/news/search/?query=${enc(q)}`, note: 'Free, project-based, with free certifications.' },
  { name: 'Google Digital Garage', tier: 'free', searchUrl: () => `https://grow.google/certificates/`, note: 'Free Google career certificates + financial aid.' },

  // ── Paid ──
  { name: 'Udemy', tier: 'paid', searchUrl: q => `https://www.udemy.com/courses/search/?q=${enc(q)}`, note: 'Frequent sales; lifetime access; certificate of completion.' },
  { name: 'Coursera — certificate', tier: 'paid', searchUrl: q => `https://www.coursera.org/search?query=${enc(q)}`, note: 'University + industry certificates, verifiable credential.' },
  { name: 'DeepLearning.AI', tier: 'paid', searchUrl: q => `https://www.deeplearning.ai/courses/?search=${enc(q)}`, note: 'Best-in-class for AI/ML upskilling.' },
  { name: 'LinkedIn Learning', tier: 'paid', searchUrl: q => `https://www.linkedin.com/learning/search?keywords=${enc(q)}`, note: 'Certificate posts straight to your LinkedIn profile.' },
  { name: 'Pluralsight', tier: 'paid', searchUrl: q => `https://www.pluralsight.com/search?q=${enc(q)}`, note: 'Deep tech/ops skill paths with assessments.' },
]

// Financing options — static guidance, not search links. These are the routes
// candidates can use to pay for paid courses without upfront cost.
// Financing options — static guidance. Links use search URLs (never 404) since
// providers' deep article links rot frequently.
const gsearch = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`
export const FINANCING_OPTIONS: Array<{ title: string; detail: string; href?: string }> = [
  {
    title: 'Course financial aid',
    detail: 'Coursera and edX offer financial aid on most certificates — apply and it can be fully free if approved (≈2 week turnaround).',
    href: gsearch('how to apply for Coursera financial aid'),
  },
  {
    title: 'Employer sponsorship',
    detail: 'Many employers have an annual L&D / training budget. Ask HR — a one-line request often unlocks it.',
  },
  {
    title: 'Government / regional schemes',
    detail: 'Check national upskilling funds and free programmes (e.g. UAE’s "One Million Coders", UK Skills Bootcamps, EU digital skills funds).',
    href: gsearch('government free upskilling programmes near me'),
  },
  {
    title: 'Pay-after-you-earn (ISA / BNPL)',
    detail: 'Some bootcamps offer income-share agreements or instalments (Klarna/Affirm) — you pay once you’re placed or in monthly chunks.',
    href: gsearch('bootcamp income share agreement courses'),
  },
]

// Build a search URL that lands on a SPECIFIC named course on its platform.
// Searching the exact course name puts it at/near the top of results — gives
// the candidate the curated pick without a rot-prone hardcoded course URL.
export function courseSearchUrl(platform: string | undefined, courseName: string): string {
  const p = (platform || '').toLowerCase()
  const q = enc(courseName)
  if (p.includes('coursera')) return `https://www.coursera.org/search?query=${q}`
  if (p.includes('udemy')) return `https://www.udemy.com/courses/search/?q=${q}`
  if (p.includes('edx')) return `https://www.edx.org/search?q=${q}`
  if (p.includes('deeplearning')) return `https://www.deeplearning.ai/courses/?search=${q}`
  if (p.includes('linkedin')) return `https://www.linkedin.com/learning/search?keywords=${q}`
  if (p.includes('pluralsight')) return `https://www.pluralsight.com/search?q=${q}`
  if (p.includes('udacity')) return `https://www.udacity.com/catalog?searchValue=${q}`
  if (p.includes('youtube')) return `https://www.youtube.com/results?search_query=${enc(courseName + ' full course')}`
  // Unknown platform → Google the course + platform so they still find it
  return `https://www.google.com/search?q=${enc(courseName + ' ' + (platform || 'course'))}`
}

export function providersByTier(skillQuery: string) {
  const build = (tier: CostTier) =>
    PROVIDERS.filter(p => p.tier === tier).map(p => ({ name: p.name, url: p.searchUrl(skillQuery), note: p.note }))
  return {
    free: build('free'),
    paid: build('paid'),
  }
}
