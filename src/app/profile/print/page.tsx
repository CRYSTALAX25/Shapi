'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { hasProAccess } from '@/lib/subscriptions'

type WorkEntry = {
  title?: string
  company?: string
  start?: string
  end?: string
  achievements?: string
}

type CV = {
  language: string
  languageCode: string
  full_name: string
  headline: string
  location: string
  summary: string
  sectionLabels: {
    profile: string
    inTheirOwnWords: string
    experience: string
    skills: string
    languages?: string
    certifications?: string
    present: string
    verifiedBy: string
  }
  workHistory: WorkEntry[]
  chatAnswers: string[]
  skills: string[]
  languages_spoken?: Array<{ language: string; level: string }>
  certifications?: Array<{ name?: string; issuer?: string; year?: string }>
  courses?: Array<{ name?: string; platform?: string; year?: string }>
  events?: Array<{ name?: string; year?: string; role?: string }>
  talks?: Array<{ venue?: string; year?: string; title?: string }>
}

type Meta = {
  whatsapp_number: string | null
  ai_tier: string | null
  has_whatsapp: boolean
}

// Parse a stat token into a comparable magnitude so we can lead with the
// biggest achievement across the whole career ($56M > $1M > $75K > 120).
function statMagnitude(v: string): number {
  const s = v.toLowerCase().replace(/[$,\s]/g, '')
  const num = parseFloat(s)
  if (isNaN(num)) return 0
  if (/b|bn|billion/.test(s)) return num * 1e9
  if (/m|million/.test(s)) return num * 1e6
  if (/k|thousand/.test(s)) return num * 1e3
  if (s.includes('%')) return num            // percentages rank low (small abs)
  return num
}

// Extract headline impact stats for the schematic "Impact" tiles.
// Rules (per Ana): at most ONE stat per role (the biggest), then sort ALL by
// magnitude descending and take the top 4 — so the strongest career achievement
// always leads, and no single company hogs multiple boxes.
function extractImpactStats(workHistory: WorkEntry[]): Array<{ value: string; label: string }> {
  const STOP = new Set(['a', 'an', 'the', 'and', 'of', 'to', 'in', 'within', 'by', 'with', 'for', 'on', 'that', 'was', 'were', 'is', 'are', 'our', 'us', 'their', 'per', 'across', 'over', 'while', 'first', 'last'])
  const numRe = /(\$\s?\d[\d,.]*\s?(?:k|m|bn|b|million|billion|thousand)?|\b\d{2,}\+?\b|\d+%)/gi
  const perRole: Array<{ value: string; label: string; mag: number }> = []

  for (const job of workHistory || []) {
    const text = (job.achievements || '').replace(/\n/g, ' ')
    let best: { value: string; label: string; mag: number } | null = null
    let m: RegExpExecArray | null
    numRe.lastIndex = 0
    while ((m = numRe.exec(text)) !== null) {
      const value = m[0].replace(/\s+/g, '')
      if (/^\d{4}$/.test(value) && +value > 1900 && +value < 2100) continue // skip years
      const mag = statMagnitude(value)
      const afterWords = text.slice(m.index + m[0].length).trim()
        .replace(/[^a-zA-Z\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP.has(w.toLowerCase()))
        .slice(0, 2)
      const label = afterWords.join(' ').toLowerCase().slice(0, 22) || 'impact'
      if (!best || mag > best.mag) best = { value, label, mag }
    }
    if (best) perRole.push(best)
  }

  return perRole.sort((a, b) => b.mag - a.mag).slice(0, 4).map(({ value, label }) => ({ value, label }))
}

// Bucket flat skills into Tech / Soft / Hard for a structured sidebar.
// Heuristic keyword match — Tech = tools/software/platforms, Soft = behavioural,
// Hard = everything else (domain expertise, methods).
const TECH_HINTS = ['excel', 'sap', 'netsuite', 'quickbooks', 'salesforce', 'hubspot', 'python', 'sql', 'tableau', 'power bi', 'powerbi', 'looker', 'shopify', 'amazon', 'aws', 'azure', 'gcp', 'figma', 'jira', 'asana', 'notion', 'slack', 'chatgpt', 'claude', 'gpt', 'midjourney', 'canva', 'wordpress', 'html', 'css', 'javascript', 'react', 'node', 'erp', 'crm', 'qr', 'api', 'photoshop', 'illustrator', 'premiere', 'word', 'powerpoint', 'google ', 'zapier', 'airtable', 'monday', 'oracle', 'workday', 'xero', 'stripe', 'meta ads', 'google ads', 'seo', 'analytics']
const SOFT_HINTS = ['communication', 'leadership', 'teamwork', 'team work', 'collaboration', 'problem solving', 'problem-solving', 'adaptability', 'negotiation', 'time management', 'critical thinking', 'creativity', 'emotional intelligence', 'mentoring', 'coaching', 'presentation', 'public speaking', 'conflict resolution', 'decision making', 'decision-making', 'interpersonal', 'empathy', 'resilience', 'work ethic', 'attention to detail', 'organisation', 'organization', 'flexibility', 'initiative', 'stakeholder management', 'relationship']
function categorizeSkills(skills: string[]): { tech: string[]; soft: string[]; hard: string[] } {
  const tech: string[] = [], soft: string[] = [], hard: string[] = []
  for (const s of skills) {
    const l = s.toLowerCase()
    if (TECH_HINTS.some(h => l.includes(h))) tech.push(s)
    else if (SOFT_HINTS.some(h => l.includes(h))) soft.push(s)
    else hard.push(s)
  }
  return { tech, soft, hard }
}

function PrintContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = searchParams.get('lang')
  const targetIndustry = searchParams.get('industry') // e.g. 'media', 'tech', 'hospitality'
  const isNative = lang === 'native'
  const isUniversal = lang === 'universal'
  const isEnglish = !lang || lang === 'english'
  // Anything other than the three keywords is treated as a specific language name
  // (e.g. ?lang=Italian, ?lang=Croatian, ?lang=Tagalog)
  const targetLanguage = lang && !isNative && !isUniversal && !isEnglish ? lang : null
  const mode = targetLanguage ? 'native' : isNative ? 'native' : isUniversal ? 'universal' : 'english'

  const [cv, setCv] = useState<CV | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [availableLangs, setAvailableLangs] = useState<string[]>([])
  // Industries the candidate has run a deep-dive for — shown as their own
  // dropdown group so the picker stays organised as versions accumulate.
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([])
  const fetched = useRef(false)

  // Also load skill_quadrant + AI tier + profile ID for the PDF footer
  // line (single-line teaser that drives recruiters back to the live profile)
  const [footerData, setFooterData] = useState<{
    skill_quadrant?: { hands: number; heart: number; head: number; spark: number } | null
    ai_tier?: string | null
    profile_id?: string | null
    verification_tier?: string | null
    cv_tier?: string | null
    subscription_product?: string[] | null
    ai_resilience_score?: number | null
    pivot?: { to_role?: string; to_industry?: string } | null
  }>({})

  // Load the candidate's spoken languages so we can render one toolbar
  // button per language (Italian, French, etc. — not just Native/Universal)
  useEffect(() => {
    fetch('/api/profile/get')
      .then(r => r.json())
      .then(({ profile }) => {
        if (!profile) return
        const spoken = Array.isArray(profile.languages_spoken)
          ? (profile.languages_spoken as Array<{ language?: string }>)
          : []
        const native = profile.native_language ? [profile.native_language as string] : []
        const all = [...native, ...spoken.map(s => s.language || '').filter(Boolean)]
        // Dedupe + exclude English (which has its own button), keep order
        const seen = new Set(['english'])
        const unique: string[] = []
        for (const l of all) {
          const k = l.toLowerCase().trim()
          if (!seen.has(k)) { seen.add(k); unique.push(l) }
        }
        setAvailableLangs(unique)
        // Industries with a completed/in-progress deep-dive (or matched_industries)
        const chats = (profile.industry_chats as Record<string, { answers?: string[]; status?: string }> | null) || {}
        const fromChats = Object.keys(chats).filter(k => (chats[k]?.answers?.length ?? 0) > 0 || chats[k]?.status === 'completed')
        const matched = Array.isArray(profile.matched_industries) ? (profile.matched_industries as string[]) : []
        setAvailableIndustries([...new Set([...fromChats, ...matched])])
        const roadmap = profile.career_recommendations as { ai_resilience_score?: number; pivot_paths?: Array<{ to_role?: string; to_industry?: string }> } | null
        setFooterData({
          skill_quadrant: profile.skill_quadrant as { hands: number; heart: number; head: number; spark: number } | null,
          ai_tier: profile.ai_tier,
          profile_id: profile.id,
          verification_tier: profile.verification_tier as string | null,
          cv_tier: profile.cv_tier as string | null,
          subscription_product: (profile.subscription_product as string[] | null) ?? null,
          ai_resilience_score: (profile.ai_resilience_score as number | null) ?? roadmap?.ai_resilience_score ?? null,
          pivot: roadmap?.pivot_paths?.[0] ?? null,
        })
      })
      .catch(() => {})
  }, [])

  const loadCV = (forceRefresh = false) => {
    setCv(null)
    setError('')
    setFromCache(false)

    // Check sessionStorage first for instant render (English CV pre-generated on cv-ready page)
    if (!forceRefresh && mode === 'english' && !targetIndustry) {
      try {
        const stored = sessionStorage.getItem('shapi_cv_english')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.cv) {
            setCv(parsed.cv)
            setMeta(parsed.meta)
            setFromCache(true)
            return // done — no API call needed
          }
        }
      } catch { /* ignore */ }
    }

    fetch('/api/cv/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        ...(targetIndustry ? { targetIndustry } : {}),
        ...(targetLanguage ? { targetLanguage } : {}),
        ...(forceRefresh ? { forceRefresh: true } : {}),
      }),
    })
      .then(async r => {
        // Defensive: cv/generate sometimes returns HTML (Vercel timeout page,
        // gateway error, etc.) instead of JSON. r.json() would throw cryptically.
        // Read as text first, try to parse, surface a clean error message if not JSON.
        const txt = await r.text()
        try {
          return JSON.parse(txt)
        } catch {
          if (!r.ok) {
            throw new Error(`Server returned ${r.status} — ${txt.slice(0, 200)}`)
          }
          throw new Error(`Could not parse server response: ${txt.slice(0, 200)}`)
        }
      })
      .then(d => {
        if (d.error) { setError(d.error); return }
        setCv(d.cv)
        setMeta(d.meta)
        setFromCache(!!d.cached)
        // Store English CV in sessionStorage for future visits in this session
        if (mode === 'english' && !targetIndustry) {
          try { sessionStorage.setItem('shapi_cv_english', JSON.stringify({ cv: d.cv, meta: d.meta })) } catch { /* ignore */ }
        }
      })
      .catch(e => setError(e?.message || 'Failed to generate CV — please try again.'))
  }

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    loadCV()
  }, [mode])

  const isRTL = cv && ['ar', 'he', 'ur', 'fa'].includes(cv.languageCode)

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#060609', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ color: '#FB7185', fontSize: 16, fontWeight: 700 }}>Something went wrong</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{error}</div>
        <button onClick={() => { fetched.current = false; loadCV(true) }}
          style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)', color: '#060609', border: 'none', borderRadius: 99, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
          Try again
        </button>
        <button onClick={() => router.back()}
          style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
          ← Go back
        </button>
      </div>
    )
  }

  if (!cv) {
    return (
      <div style={{ minHeight: '100vh', background: '#060609', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, #38BDF8, #34D399)',
          animation: 'spin 1.2s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 600 }}>
          {isNative ? 'Writing your native language CV…'
            : isUniversal ? 'Writing your universal CV…'
            : targetIndustry ? `Writing your ${targetIndustry} CV…`
            : 'Writing your CV…'}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
          {isUniversal
            ? 'Claude is removing jargon and making your achievements cross-industry — about 20 seconds.'
            : targetIndustry
            ? `Claude is re-framing your achievements for ${targetIndustry} — about 20 seconds.`
            : 'Claude is weaving in your WhatsApp answers — about 20 seconds.'}
        </p>
      </div>
    )
  }

  const labels = cv.sectionLabels || {
    profile: 'Profile',
    inTheirOwnWords: 'In Their Own Words',
    experience: 'Experience',
    skills: 'Skills',
    present: 'Present',
    verifiedBy: 'Verified profile · shapi.io',
  }

  // Pro users get the premium "Verified Profile" (Variant A) two-column design.
  // Kit users keep the classic single-column format. The premium design
  // showcases Pro-only elements: verification tier badge, skill fingerprint,
  // and "In Their Own Words" deep-dive pull-quotes.
  const isPro = hasProAccess(footerData)
  const q = footerData.skill_quadrant
  const tier = footerData.verification_tier
  const tierMeta: Record<string, { label: string; color: string }> = {
    basic: { label: 'Basic Verified', color: '#0891b2' },
    strong: { label: 'Strongly Verified', color: '#059669' },
    premium: { label: 'Premium Verified', color: '#B45309' },
  }
  const tierInfo = tier && tier !== 'unverified'
    ? tierMeta[tier]
    : { label: 'Shapi Verified Profile', color: '#7C3AED' }
  // Pick 1-2 tight pull-quotes for the sidebar
  const sidebarQuotes = (cv.chatAnswers || [])
    .map(a => (a || '').trim().replace(/\s+/g, ' '))
    .filter(a => a.length >= 40 && a.length <= 180)
    .sort((x, y) => Math.abs(110 - x.length) - Math.abs(110 - y.length))
    .slice(0, 2)

  // Blended schematic data
  const impactStats = extractImpactStats(cv.workHistory || [])
  const pivot = footerData.pivot
  // (AI-resilience score is intentionally not shown on the CV — personal to the
  // candidate, lives on /profile only.)
  // Radar geometry (only used if quadrant present + we choose the radar)
  const RS = 132, cx = RS / 2, cy = RS / 2, maxR = 46
  const pt = (angle: number, val: number) => {
    const r = (Math.max(0, Math.min(10, val)) / 10) * maxR
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }
  const ang = { head: -Math.PI / 2, spark: 0, heart: Math.PI / 2, hands: Math.PI }
  const radarPath = q
    ? (() => {
        const p = { head: pt(ang.head, q.head), spark: pt(ang.spark, q.spark), heart: pt(ang.heart, q.heart), hands: pt(ang.hands, q.hands) }
        return `M ${p.head.x} ${p.head.y} L ${p.spark.x} ${p.spark.y} L ${p.heart.x} ${p.heart.y} L ${p.hands.x} ${p.hands.y} Z`
      })()
    : ''

  return (
    <>
      {/* Force light mode at browser level — prevents Chrome dark mode inverting CV colours */}
      <meta name="color-scheme" content="light" />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { color-scheme: light !important; background: #f8f8f8 !important; }
        html, body { background: #f8f8f8 !important; color: #1a1a2e !important; }

        .no-print {
          position: fixed; top: 12px; right: 12px; z-index: 2147483647;
          display: flex; gap: 6px; align-items: center;
          background: #ffffff;
          padding: 6px 8px; border-radius: 999px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.28);
          max-width: calc(100vw - 24px);
        }
        .btn { padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; font-family: system-ui, sans-serif; white-space: nowrap; }
        .btn-primary { background: linear-gradient(135deg,#38BDF8, #34D399); color: #060609; }
        .btn-secondary { background: #e8e8e8; color: #333; }
        .btn-secondary.btn-active { background: #1a1a2e; color: white; }
        .lang-picker {
          padding: 8px 12px; border-radius: 999px; font-size: 12px;
          font-weight: 700; border: none; font-family: system-ui, sans-serif;
          background: #e8e8e8; color: #333; cursor: pointer;
          appearance: none; -webkit-appearance: none;
          padding-right: 28px;
          background-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><polygon points="0,2 10,2 5,8" fill="%23333"/></svg>');
          background-repeat: no-repeat;
          background-position: right 10px center;
        }
        .lang-picker:focus { outline: 2px solid #38BDF8; outline-offset: 2px; }
        @media (max-width: 640px) {
          .no-print { top: 8px; right: 8px; padding: 4px 6px; }
          .btn, .lang-picker { padding: 6px 10px; font-size: 11px; }
        }

        .page {
          max-width: 800px; margin: 72px auto 32px; padding: 56px 64px;
          background: white; box-shadow: 0 6px 48px rgba(0,0,0,0.15);
          font-family: ${isRTL ? "'Noto Sans Arabic','Arial',sans-serif" : "'Georgia',serif"};
          color: #1a1a2e; direction: ${isRTL ? 'rtl' : 'ltr'};
          border-radius: 4px;
        }

        .translation-notice {
          background: #fefce8; border: 1px solid #fde68a; border-radius: 8px;
          padding: 10px 16px; margin-bottom: 24px; font-size: 12px; color: #92400e;
          font-family: system-ui, sans-serif;
        }

        .header { border-bottom: 2px solid #1a1a2e; padding-bottom: 24px; margin-bottom: 28px; }
        .name { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
        .headline-text { font-size: 16px; color: #555; margin-bottom: 8px; }
        .meta { font-size: 13px; color: #888; display: flex; gap: 16px; flex-wrap: wrap; }
        .badge { display: inline-block; background: #f0f0f8; color: #6B21A8; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; font-family: system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; }

        .section { margin-bottom: 28px; break-inside: avoid; page-break-inside: avoid; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #999; font-family: system-ui, sans-serif; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; break-after: avoid; page-break-after: avoid; }

        .summary { font-size: 14px; line-height: 1.7; color: #444; text-align: justify; }

        .job { margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; orphans: 4; widows: 4; }
        .job-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; break-after: avoid; page-break-after: avoid; }
        .job-title { font-size: 15px; font-weight: 700; }
        .job-company { font-size: 14px; color: #666; margin-bottom: 4px; break-after: avoid; page-break-after: avoid; }
        .job-dates { font-size: 12px; color: #999; font-family: system-ui, sans-serif; white-space: nowrap; }
        .job-achievements { font-size: 13px; line-height: 1.65; color: #555; margin-top: 6px; white-space: pre-line; text-align: justify; orphans: 4; widows: 4; }

        .skills { display: flex; flex-wrap: wrap; gap: 8px; }
        .skill { background: #f5f5f5; color: #444; font-size: 12px; padding: 4px 12px; border-radius: 999px; font-family: system-ui, sans-serif; }

        .quote { border-${isRTL ? 'right' : 'left'}: 3px solid #38BDF8; padding-${isRTL ? 'right' : 'left'}: 16px; margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #555; font-style: italic; break-inside: avoid; page-break-inside: avoid; text-align: justify; }

        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #bbb; font-family: system-ui, sans-serif; text-align: center; }

        /* ─── Variant A — premium "Verified Profile" (Pro only) ─── */
        .va-page {
          max-width: 820px; margin: 72px auto 32px; background: white;
          box-shadow: 0 6px 48px rgba(0,0,0,0.15); border-radius: 4px;
          font-family: ${isRTL ? "'Noto Sans Arabic','Arial',sans-serif" : "'Inter','Helvetica Neue',Arial,system-ui,sans-serif"};
          color: #1a1a2e; direction: ${isRTL ? 'rtl' : 'ltr'};
          display: grid; grid-template-columns: 1fr 240px; overflow: hidden;
        }
        .va-strip { grid-column: 1 / -1; height: 7px; background: linear-gradient(90deg,#38BDF8, #34D399); }
        .va-main { padding: 40px 36px 32px 44px; }
        .va-side { padding: 40px 26px 32px 26px; background: #F7F9FB; border-${isRTL ? 'right' : 'left'}: 1px solid #E5E9F0; }
        .va-name { font-size: 28px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.1; }
        .va-headline { font-size: 14.5px; color: #555; margin-top: 5px; }
        .va-loc { font-size: 12px; color: #888; margin-top: 8px; }
        .va-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 13px; border-radius: 999px; font-size: 11px; font-weight: 700; margin-top: 13px; font-family: system-ui, sans-serif; }
        .va-section { margin-top: 24px; break-inside: avoid; }
        .va-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.3px; color: #0E7490; margin-bottom: 9px; border-bottom: 2px solid; border-image: linear-gradient(90deg,#38BDF8, #34D399) 1; padding-bottom: 5px; font-family: system-ui, sans-serif; }
        .va-summary { font-size: 13px; line-height: 1.65; color: #374151; text-align: justify; }
        .va-job { margin-bottom: 15px; break-inside: avoid; }
        .va-job-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .va-jt { font-size: 13.5px; font-weight: 700; color: #1a1a2e; }
        .va-jc { font-size: 12.5px; color: #0E7490; font-weight: 700; }
        .va-jd { font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap; font-family: system-ui, sans-serif; }
        .va-jach { font-size: 11.5px; line-height: 1.6; color: #4B5563; margin-top: 4px; white-space: pre-line; text-align: justify; }
        .va-sidelabel { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #7C3AED; margin-bottom: 9px; font-family: system-ui, sans-serif; }
        .va-block { margin-bottom: 22px; break-inside: avoid; }
        .va-bar-row { display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; font-weight: 600; margin-bottom: 6px; color: #1a1a2e; }
        .va-bar-fill { display: flex; align-items: center; gap: 2px; }
        .va-seg { width: 9px; height: 6px; border-radius: 1px; }
        .va-chip-sm { display: inline-block; font-size: 10px; padding: 3px 9px; border-radius: 999px; background: linear-gradient(135deg,#F0FBFD,#F5F3FF); color: #1a1a2e; font-weight: 600; border: 1px solid #DDEAF0; margin: 2px 3px 2px 0; }
        .va-quote { position: relative; font-size: 11.5px; line-height: 1.55; color: #374151; font-style: italic; padding: 4px 0 4px 13px; border-${isRTL ? 'right' : 'left'}: 2px solid #38BDF8; margin-bottom: 11px; break-inside: avoid; }
        .va-quote .attr { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: rgba(255,255,255,0.5); font-style: normal; margin-top: 4px; font-family: system-ui, sans-serif; }
        .va-lang { font-size: 11.5px; color: #374151; margin-bottom: 4px; }
        .va-lang strong { color: #1a1a2e; }
        .va-foot { grid-column: 1 / -1; padding: 14px 36px 22px; font-size: 9.5px; color: rgba(255,255,255,0.5); border-top: 1px solid #E5E7EB; text-align: center; font-family: system-ui, sans-serif; }
        /* Blended schematic additions */
        .va-impact { grid-column: 1 / -1; display: flex; gap: 10px; padding: 0 36px 4px 44px; margin-top: 14px; flex-wrap: wrap; }
        .va-stat { flex: 1; min-width: 90px; background: linear-gradient(135deg,#F0FBFD,#F5F3FF); border: 1px solid #E5E9F0; border-radius: 10px; padding: 12px 14px; }
        .va-stat .v { font-size: 21px; font-weight: 800; color: #0E7490; letter-spacing: -0.5px; line-height: 1; }
        .va-stat .l { font-size: 9.5px; color: #6B7280; margin-top: 5px; text-transform: capitalize; font-family: system-ui, sans-serif; }
        .va-arc { background: #F7F9FB; border: 1px solid #E5E9F0; border-radius: 10px; padding: 13px 16px; margin-top: 4px; }
        .va-arc-row { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #374151; }
        .va-arc-node { font-weight: 700; color: #1a1a2e; }
        .va-arc-sep { color: #38BDF8; font-weight: 700; }
        .va-arc-next { color: #7C3AED; font-weight: 700; }
        .va-trust { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 999px; font-family: system-ui, sans-serif; letter-spacing: 0.3px; vertical-align: middle; }
        .va-verline { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
        .va-learn-item { font-size: 10.5px; color: #6B7280; line-height: 1.45; margin-bottom: 5px; padding-left: 8px; border-left: 1.5px solid #E5E7EB; }
        .va-radar-wrap { display: flex; flex-direction: column; align-items: center; }
        .va-resil { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
        .va-resil .num { font-size: 22px; font-weight: 800; line-height: 1; }

        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .translation-notice { display: none !important; }
          .page { margin: 0; padding: 40px 48px; box-shadow: none; max-width: 100%; }
          .va-page { margin: 0; box-shadow: none; max-width: 100%; border-radius: 0; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar — hidden on print. Compact, single-row layout: Back +
          language dropdown + Regenerate + Save as PDF. Dropdown scales
          cleanly however many languages the candidate has. */}
      <div className="no-print">
        <button className="btn btn-secondary" onClick={() => router.back()}>← Back</button>

        {/* Language picker — single dropdown lists English + every CV
            language + Universal. Selecting jumps to that version. */}
        <select
          className="lang-picker"
          value={(() => {
            if (targetIndustry) return `ind:${targetIndustry}`
            if (isUniversal) return '__universal'
            if (targetLanguage) return `lang:${targetLanguage}`
            if (isNative && cv?.language) return `lang:${cv.language}`
            return '__english'
          })()}
          onChange={e => {
            const v = e.target.value
            if (v === '__english') router.push('/profile/print')
            else if (v === '__universal') router.push('/profile/print?lang=universal')
            else if (v.startsWith('lang:')) router.push(`/profile/print?lang=${encodeURIComponent(v.slice(5))}`)
            else if (v.startsWith('ind:')) router.push(`/profile/print?industry=${encodeURIComponent(v.slice(4))}`)
          }}
        >
          <optgroup label="General">
            <option value="__english">🇬🇧 English</option>
            <option value="__universal">📋 Universal (industry-agnostic)</option>
          </optgroup>
          {availableLangs.length > 0 && (
            <optgroup label="Your languages">
              {availableLangs.map(l => (
                <option key={l} value={`lang:${l}`}>🌐 {l}</option>
              ))}
            </optgroup>
          )}
          {availableIndustries.length > 0 && (
            <optgroup label="Industry-targeted">
              {availableIndustries.map(ind => (
                <option key={ind} value={`ind:${ind}`}>🎯 {ind.charAt(0).toUpperCase() + ind.slice(1)}</option>
              ))}
            </optgroup>
          )}
        </select>

        <button className="btn btn-secondary" onClick={() => { fetched.current = false; loadCV(true) }}
          title="Regenerate with latest data">
          ↺ Regenerate
        </button>

        <button className="btn btn-primary" onClick={() => {
          setTimeout(() => window.print(), 100)
        }}>
          ↓ Save as PDF
        </button>
      </div>

      {!isPro && <div className="page">
        {isNative && cv.languageCode !== 'en' && (
          <div className="translation-notice">
            🌐 {cv.language} version — auto-translated by Shapi AI. Review before sending.
          </div>
        )}
        {isUniversal && (
          <div className="translation-notice" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>
            📋 Universal version — industry jargon removed. Suitable for career changes and cross-sector applications.
          </div>
        )}
        {targetIndustry && !isNative && !isUniversal && (
          <div className="translation-notice" style={{ background: '#eff6ff', borderColor: '#93c5fd', color: '#1e40af' }}>
            🎯 {targetIndustry.charAt(0).toUpperCase() + targetIndustry.slice(1)}-targeted version — achievements re-framed for this sector.
          </div>
        )}

        {/* Header */}
        <div className="header">
          <h1 className="name">{cv.full_name}</h1>
          <p className="headline-text">{cv.headline}</p>
          <div className="meta">
            {cv.location && <span>📍 {cv.location}</span>}
            {meta?.whatsapp_number && <span>📱 {meta.whatsapp_number}</span>}
            {meta?.ai_tier && <span className="badge">AI {meta.ai_tier}</span>}
            <span className="badge" style={{ background: '#e0f7fa', color: '#0891b2' }}>✓ Shapi verified</span>
          </div>
        </div>

        {/* Summary */}
        {cv.summary && (
          <div className="section">
            <div className="section-title">{labels.profile}</div>
            <p className="summary">{cv.summary}</p>
          </div>
        )}

        {/* In their own words (WhatsApp) */}
        {meta?.has_whatsapp && cv.chatAnswers && cv.chatAnswers.length > 0 && (
          <div className="section">
            <div className="section-title">{labels.inTheirOwnWords}</div>
            {cv.chatAnswers.map((answer, i) => (
              <div key={i} className="quote">
                &ldquo;{answer}&rdquo;
              </div>
            ))}
          </div>
        )}

        {/* Work history */}
        {cv.workHistory && cv.workHistory.length > 0 && (
          <div className="section">
            <div className="section-title">{labels.experience}</div>
            {cv.workHistory.map((job, i) => (
              <div key={i} className="job">
                <div className="job-header">
                  <span className="job-title">{job.title || '—'}</span>
                  <span className="job-dates">{job.start}{job.end ? ` – ${job.end}` : ` – ${labels.present}`}</span>
                </div>
                <div className="job-company">{job.company || '—'}</div>
                {job.achievements && (
                  <div className="job-achievements">{job.achievements}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {cv.skills && cv.skills.length > 0 && (
          <div className="section">
            <div className="section-title">{labels.skills}</div>
            <div className="skills">
              {cv.skills.map((skill, i) => (
                <span key={i} className="skill">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {cv.languages_spoken && cv.languages_spoken.length > 0 && (
          <div className="section">
            <div className="section-title">{labels.languages || 'Languages'}</div>
            <div className="skills">
              {cv.languages_spoken.map((l, i) => (
                <span key={i} className="skill">
                  {l.language}{l.level ? ` · ${l.level}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certifications & continuous learning */}
        {(() => {
          const hasCerts = (cv.certifications?.length ?? 0) > 0
          const hasCourses = (cv.courses?.length ?? 0) > 0
          const hasEvents = (cv.events?.length ?? 0) > 0
          const hasTalks = (cv.talks?.length ?? 0) > 0
          if (!hasCerts && !hasCourses && !hasEvents && !hasTalks) return null
          return (
            <div className="section">
              <div className="section-title">{labels.certifications || 'Certifications & Learning'}</div>
              {hasCerts && (
                <p style={{ fontSize: 13, marginBottom: 6, color: '#444' }}>
                  <strong>Certifications:</strong>{' '}
                  {cv.certifications!.map((c, i) => (
                    <span key={i}>
                      {c.name}{c.issuer ? ` (${c.issuer})` : ''}{c.year ? ` ${c.year}` : ''}
                      {i < cv.certifications!.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </p>
              )}
              {hasCourses && (
                <p style={{ fontSize: 13, marginBottom: 6, color: '#444' }}>
                  <strong>Courses:</strong>{' '}
                  {cv.courses!.map((c, i) => (
                    <span key={i}>
                      {c.name}{c.platform ? ` · ${c.platform}` : ''}{c.year ? ` ${c.year}` : ''}
                      {i < cv.courses!.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </p>
              )}
              {hasEvents && (
                <p style={{ fontSize: 13, marginBottom: 6, color: '#444' }}>
                  <strong>Events:</strong>{' '}
                  {cv.events!.map((e, i) => (
                    <span key={i}>
                      {e.name}{e.year ? ` ${e.year}` : ''}{e.role && e.role !== 'attendee' ? ` (${e.role})` : ''}
                      {i < cv.events!.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </p>
              )}
              {hasTalks && (
                <p style={{ fontSize: 13, marginBottom: 6, color: '#444' }}>
                  <strong>Talks:</strong>{' '}
                  {cv.talks!.map((t, i) => (
                    <span key={i}>
                      {t.title}{t.venue ? ` · ${t.venue}` : ''}{t.year ? ` ${t.year}` : ''}
                      {i < cv.talks!.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )
        })()}

        {/* Compact Skill Fingerprint teaser — drives recruiters to the live
            profile where they see the full radar + AI cross-check report.
            Single line, neutral on print. Full visualization stays platform-only. */}
        {footerData.skill_quadrant && (
          <div className="footer" style={{ marginTop: 24, paddingTop: 12, fontSize: 10, color: '#999' }}>
            🎯 Skill Fingerprint:
            {' Heart '}{Math.round(footerData.skill_quadrant.heart)} ·
            {' Spark '}{Math.round(footerData.skill_quadrant.spark)} ·
            {' Head '}{Math.round(footerData.skill_quadrant.head)} ·
            {' Hands '}{Math.round(footerData.skill_quadrant.hands)}
            {footerData.ai_tier ? ` · 🤖 AI ${footerData.ai_tier.charAt(0).toUpperCase() + footerData.ai_tier.slice(1)}` : ''}
            {footerData.profile_id ? ` — full verified profile at shapi.io/p/${footerData.profile_id.slice(0, 8)}` : ''}
          </div>
        )}
        <div className="footer">{labels.verifiedBy}</div>
      </div>}

      {/* ─── Variant A — premium "Shapi Verified" blended design (Pro only) ─── */}
      {isPro && (
      <div className="va-page">
        <div className="va-strip" />

        {/* Header (spans both columns via grid auto-flow: name left, badge right) */}
        <div className="va-main" style={{ paddingBottom: 0 }}>
          <h1 className="va-name">{cv.full_name}</h1>
          {cv.headline && <p className="va-headline">{cv.headline}</p>}
          {cv.location && <p className="va-loc">📍 {cv.location}</p>}
          <span className="va-chip" style={{ background: tierInfo.color + '15', color: tierInfo.color, border: `1px solid ${tierInfo.color}40` }}>
            ✓ {tierInfo.label}
          </span>
          {(isNative && cv.languageCode !== 'en') && (
            <div className="translation-notice" style={{ marginTop: 14 }}>🌐 {cv.language} version — auto-translated by Shapi AI. Review before sending.</div>
          )}
          {isUniversal && (
            <div className="translation-notice" style={{ marginTop: 14, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>📋 Universal version — industry jargon removed.</div>
          )}
          {targetIndustry && !isNative && !isUniversal && (
            <div className="translation-notice" style={{ marginTop: 14, background: '#eff6ff', borderColor: '#93c5fd', color: '#1e40af' }}>🎯 {targetIndustry.charAt(0).toUpperCase() + targetIndustry.slice(1)}-targeted version.</div>
          )}
        </div>
        {/* Right column header spacer — radar lives here so it aligns with the name band */}
        <div className="va-side" style={{ paddingBottom: 0 }}>
          {q && (
            <div className="va-radar-wrap" style={{ marginTop: 6 }}>
              <div style={{ alignSelf: 'flex-start', marginBottom: 4 }}>
                <p className="va-sidelabel" style={{ marginBottom: 3 }}>Skill Quadrant</p>
                <span className="va-trust" style={{ background: '#EDE9FE', color: '#7C3AED' }}>◆ Shapi-assessed</span>
              </div>
              {/* viewBox padded horizontally (28px each side) + vertically so the
                  HANDS/SPARK/HEAD/HEART labels are never clipped by the column edge */}
              <svg width={RS + 56} height={RS + 20} viewBox={`-28 -10 ${RS + 56} ${RS + 20}`} style={{ maxWidth: '100%' }}>
                <defs>
                  <linearGradient id="vaRadar" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                {[0.33, 0.66, 1].map(rr => (
                  <path key={rr} d={`M ${cx} ${cy - maxR * rr} L ${cx + maxR * rr} ${cy} L ${cx} ${cy + maxR * rr} L ${cx - maxR * rr} ${cy} Z`} fill="none" stroke="#E5E7EB" strokeWidth={1} />
                ))}
                <path d={radarPath} fill="url(#vaRadar)" stroke="#38BDF8" strokeWidth={1.5} strokeLinejoin="round" />
                <text x={cx} y={cy - maxR - 6} fontSize={8} fontWeight={700} textAnchor="middle" fill="#6B7280">HEAD</text>
                <text x={cx + maxR + 6} y={cy + 3} fontSize={8} fontWeight={700} textAnchor="start" fill="#6B7280">SPARK</text>
                <text x={cx} y={cy + maxR + 13} fontSize={8} fontWeight={700} textAnchor="middle" fill="#6B7280">HEART</text>
                <text x={cx - maxR - 6} y={cy + 3} fontSize={8} fontWeight={700} textAnchor="end" fill="#6B7280">HANDS</text>
              </svg>
              {footerData.ai_tier && (
                <p style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>🤖 AI {footerData.ai_tier.charAt(0).toUpperCase() + footerData.ai_tier.slice(1)}</p>
              )}
            </div>
          )}
        </div>

        {/* Impact tiles — full width, rotating brand colours */}
        {impactStats.length >= 2 && (
          <div className="va-impact">
            {impactStats.map((s, i) => {
              const palette = [
                { v: '#0E7490', bg: 'linear-gradient(135deg,#ECFEFF,#F0F9FF)', bd: '#A5F3FC' },
                { v: '#7C3AED', bg: 'linear-gradient(135deg,#F5F3FF,#FAF5FF)', bd: '#DDD6FE' },
                { v: '#E11D48', bg: 'linear-gradient(135deg,#FFF1F2,#FFF5F5)', bd: '#FECDD3' },
                { v: '#059669', bg: 'linear-gradient(135deg,#ECFDF5,#F0FDF4)', bd: '#A7F3D0' },
              ][i % 4]
              return (
                <div key={i} className="va-stat" style={{ background: palette.bg, borderColor: palette.bd }}>
                  <div className="v" style={{ color: palette.v }}>{s.value}</div>
                  <div className="l">{s.label}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Body — left column */}
        <div className="va-main" style={{ paddingTop: 18 }}>
          {/* Career direction — where they're heading next (aspiration, not a
              claim of current fact). AI-resilience score is intentionally NOT
              shown here — it's personal to the candidate, not for employers. */}
          {pivot?.to_role && (
            <div className="va-section">
              <p className="va-label">Open to next</p>
              <div className="va-arc">
                <div className="va-arc-row">
                  <span className="va-arc-node">Now</span>
                  <span className="va-arc-sep">⟶</span>
                  <span className="va-arc-next">{pivot.to_role}{pivot.to_industry ? ` · ${pivot.to_industry}` : ''}</span>
                </div>
              </div>
            </div>
          )}

          {cv.summary && (
            <div className="va-section">
              <p className="va-label">{labels.profile}</p>
              <p className="va-summary">{cv.summary}</p>
            </div>
          )}

          {cv.workHistory && cv.workHistory.length > 0 && (
            <div className="va-section">
              <p className="va-label">{labels.experience}</p>
              {cv.workHistory.map((job, i) => (
                <div key={i} className="va-job">
                  <div className="va-job-top">
                    <span className="va-jt">{job.title || '—'}</span>
                    <span className="va-jd">{job.start}{job.end ? ` – ${job.end}` : ` – ${labels.present}`}</span>
                  </div>
                  <div className="va-jc">{job.company || '—'}</div>
                  {job.achievements && <div className="va-jach">{job.achievements}</div>}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Body — right column (sidebar). Quotes + Languages + Skills sit on
            page 1; Continuous Learning is pushed to page 2's sidebar so the
            sidebar spreads across pages instead of crowding page 1. */}
        <div className="va-side" style={{ paddingTop: 18 }}>
          {sidebarQuotes.length > 0 && (
            <div className="va-block">
              <p className="va-sidelabel">{labels.inTheirOwnWords}</p>
              {sidebarQuotes.map((quote, i) => (
                <div key={i} className="va-quote">
                  &ldquo;{quote}&rdquo;
                  {i === sidebarQuotes.length - 1 && <span className="attr">— {cv.full_name.split(' ')[0]}, Shapi interview</span>}
                </div>
              ))}
            </div>
          )}

          {cv.languages_spoken && cv.languages_spoken.length > 0 && (
            <div className="va-block">
              <p className="va-sidelabel">{labels.languages || 'Languages'}</p>
              {cv.languages_spoken.map((l, i) => (
                <div key={i} className="va-lang"><strong>{l.language}</strong>{l.level ? ` · ${l.level}` : ''}</div>
              ))}
            </div>
          )}

          {/* Skills — back in the sidebar (3 categories) */}
          {cv.skills && cv.skills.length > 0 && (() => {
            const cat = categorizeSkills(cv.skills.slice(0, 28))
            const groups = [
              { title: 'Technical & Tools', items: cat.tech, color: '#0E7490' },
              { title: 'Core Skills', items: cat.hard, color: '#7C3AED' },
              { title: 'Soft Skills', items: cat.soft, color: '#E11D48' },
            ].filter(g => g.items.length > 0)
            return (
              <div className="va-block">
                <p className="va-sidelabel">{labels.skills}</p>
                {groups.map(g => (
                  <div key={g.title} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 8.5, fontWeight: 800, color: g.color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{g.title}</p>
                    <div>{g.items.map((s, i) => <span key={i} className="va-chip-sm">{s}</span>)}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Continuous Learning — pushed to page 2's sidebar (break-before) */}
          {(cv.certifications?.length || cv.courses?.length || cv.events?.length) ? (
            <div className="va-block" style={{ breakBefore: 'page' }}>
              <p className="va-sidelabel" style={{ marginBottom: 3 }}>Continuous Learning</p>
              <span className="va-trust" style={{ background: '#F3F4F6', color: '#6B7280', marginBottom: 8, display: 'inline-block' }}>○ self-reported</span>
              {(cv.certifications?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 8.5, fontWeight: 800, color: '#0E7490', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Certifications</p>
                  {cv.certifications!.map((c, i) => (
                    <div key={`c${i}`} className="va-learn-item"><strong style={{ color: '#1a1a2e' }}>{c.name}</strong>{c.issuer ? ` — ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}</div>
                  ))}
                </div>
              )}
              {(cv.courses?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 8.5, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Courses</p>
                  {cv.courses!.map((c, i) => (
                    <div key={`co${i}`} className="va-learn-item"><strong style={{ color: '#1a1a2e' }}>{c.name}</strong>{c.platform ? ` — ${c.platform}` : ''}{c.year ? ` (${c.year})` : ''}</div>
                  ))}
                </div>
              )}
              {(cv.events?.length ?? 0) > 0 && (
                <div>
                  <p style={{ fontSize: 8.5, fontWeight: 800, color: '#E11D48', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Events</p>
                  {cv.events!.map((e, i) => (
                    <div key={`e${i}`} className="va-learn-item"><strong style={{ color: '#1a1a2e' }}>{e.name}</strong>{e.year ? ` (${e.year})` : ''}</div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="va-foot">
          {footerData.profile_id ? `Verified by Shapi · shapi.io/p/${footerData.profile_id.slice(0, 8)} · ✓ verified  ◆ Shapi-assessed  ○ self-reported` : labels.verifiedBy}
        </div>
      </div>
      )}
    </>
  )
}

export default function PrintCV() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#060609', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Loading…</div>
      </div>
    }>
      <PrintContent />
    </Suspense>
  )
}
