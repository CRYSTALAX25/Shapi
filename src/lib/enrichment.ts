// Enrichment — Hunter.io wrapper for finding a verified hiring-manager email
// behind an external job (SPEC_ACTIVE_CROSSSELL.md §4). GRACEFUL by design:
// if HUNTER_API_KEY is missing or any Hunter call fails, we degrade to a
// no-email result and NEVER throw — the caller marks the outreach
// 'ready_no_email' and surfaces that to the candidate, rather than guessing or
// spraying a generic address.
//
// The verifier step is the anti-bounce moat: we only ever return an email whose
// Hunter verification status is 'deliverable'. No deliverable email → no email.

const HUNTER_BASE = 'https://api.hunter.io/v2'

// Parse the host out of a URL, strip a leading www., lowercase it. Returns null
// on anything that doesn't parse to a host with a dot (so "localhost", bare
// words, and junk all degrade cleanly).
export function domainFromUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null
  const raw = url.trim()
  if (!raw) return null
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const host = new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '')
    if (!host || !host.includes('.')) return null
    return host
  } catch {
    return null
  }
}

export type HiringManager = {
  email: string | null
  name: string | null
  title: string | null
  domain: string | null
  source: 'hunter' | 'posting' | null
}

// The shape we degrade to whenever Hunter is unavailable or unhelpful. We keep
// any name the candidate already gave us (so the email can be addressed) and
// the best domain we can resolve without an API call.
function degraded(opts: {
  hmName?: string | null
  companyDomain?: string | null
  jobUrl?: string | null
}): HiringManager {
  return {
    email: null,
    name: opts.hmName ?? null,
    title: null,
    domain: opts.companyDomain ?? domainFromUrl(opts.jobUrl) ?? null,
    source: null,
  }
}

async function hunterGet(path: string, params: Record<string, string>): Promise<unknown | null> {
  const key = process.env.HUNTER_API_KEY
  if (!key) return null
  const qs = new URLSearchParams({ ...params, api_key: key }).toString()
  try {
    const res = await fetch(`${HUNTER_BASE}/${path}?${qs}`)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error(`[enrichment] hunter ${path} failed:`, err)
    return null
  }
}

// Resolve a company domain via Hunter Domain Search (by company name) when we
// don't already have one from the job URL.
async function resolveDomain(companyName: string): Promise<string | null> {
  const json = (await hunterGet('domain-search', { company: companyName, limit: '1' })) as
    | { data?: { domain?: string } }
    | null
  const domain = json?.data?.domain
  return domain ? domain.toLowerCase().replace(/^www\./, '') : null
}

// Hunter Email Finder — needs a domain. If we have a hiring-manager name we use
// it for a person-level match; otherwise we fall back to a leadership-department
// search so we still target a human (never a generic careers@ inbox).
async function findEmail(
  domain: string,
  hmName?: string | null,
): Promise<{ email: string; name: string | null; title: string | null } | null> {
  const params: Record<string, string> = { domain }
  if (hmName && hmName.trim()) {
    const parts = hmName.trim().split(/\s+/)
    params.first_name = parts[0]
    if (parts.length > 1) params.last_name = parts.slice(1).join(' ')
  } else {
    params.department = 'executive'
  }

  const json = (await hunterGet('email-finder', params)) as
    | { data?: { email?: string | null; first_name?: string | null; last_name?: string | null; position?: string | null } }
    | null
  const data = json?.data
  if (!data?.email) return null

  const name =
    [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || hmName?.trim() || null
  return { email: data.email, name, title: data.position ?? null }
}

// Hunter Email Verifier — the anti-bounce gate. Returns true only for a
// 'deliverable' status.
async function isDeliverable(email: string): Promise<boolean> {
  const json = (await hunterGet('email-verifier', { email })) as
    | { data?: { status?: string } }
    | null
  return json?.data?.status === 'deliverable'
}

// Find a verified hiring-manager email for an external job. Never throws — on
// any missing key / failure / non-deliverable result it returns the degraded
// (email:null) shape so the caller can mark 'ready_no_email'.
export async function findHiringManager(opts: {
  companyName: string
  companyDomain?: string | null
  jobUrl?: string | null
  hmName?: string | null
}): Promise<HiringManager> {
  if (!process.env.HUNTER_API_KEY) return degraded(opts)

  try {
    // 1. Domain — from the job URL / provided domain, else Hunter Domain Search.
    let domain = opts.companyDomain ?? domainFromUrl(opts.jobUrl) ?? null
    if (!domain) domain = await resolveDomain(opts.companyName)
    if (!domain) return degraded(opts)

    // 2. Email Finder.
    const found = await findEmail(domain, opts.hmName)
    if (!found) {
      return { email: null, name: opts.hmName ?? null, title: null, domain, source: null }
    }

    // 3. Verifier — anti-bounce. Only deliverable emails ever come back.
    const deliverable = await isDeliverable(found.email)
    if (!deliverable) {
      return { email: null, name: found.name, title: found.title, domain, source: null }
    }

    return { email: found.email, name: found.name, title: found.title, domain, source: 'hunter' }
  } catch (err) {
    console.error('[enrichment] findHiringManager failed:', err)
    return degraded(opts)
  }
}
