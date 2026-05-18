'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

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
  const fetched = useRef(false)

  // Also load skill_quadrant + AI tier + profile ID for the PDF footer
  // line (single-line teaser that drives recruiters back to the live profile)
  const [footerData, setFooterData] = useState<{
    skill_quadrant?: { hands: number; heart: number; head: number; spark: number } | null
    ai_tier?: string | null
    profile_id?: string | null
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
        setFooterData({
          skill_quadrant: profile.skill_quadrant as { hands: number; heart: number; head: number; spark: number } | null,
          ai_tier: profile.ai_tier,
          profile_id: profile.id,
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
          style={{ background: 'linear-gradient(135deg,#22D3EE,#A78BFA)', color: '#060609', border: 'none', borderRadius: 99, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
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
          background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
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

  return (
    <>
      {/* Force light mode at browser level — prevents Chrome dark mode inverting CV colours */}
      <meta name="color-scheme" content="light" />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { color-scheme: light !important; background: #f8f8f8 !important; }
        html, body { background: #f8f8f8 !important; color: #1a1a2e !important; }

        .no-print {
          position: fixed; top: 12px; right: 12px; z-index: 9999;
          display: flex; gap: 6px; align-items: center;
          background: rgba(255,255,255,0.92); backdrop-filter: blur(8px);
          padding: 6px 8px; border-radius: 999px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.12);
          max-width: calc(100vw - 24px);
        }
        .btn { padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; font-family: system-ui, sans-serif; white-space: nowrap; }
        .btn-primary { background: linear-gradient(135deg,#22D3EE,#A78BFA); color: #060609; }
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
        .lang-picker:focus { outline: 2px solid #22D3EE; outline-offset: 2px; }
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

        .quote { border-${isRTL ? 'right' : 'left'}: 3px solid #A78BFA; padding-${isRTL ? 'right' : 'left'}: 16px; margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #555; font-style: italic; break-inside: avoid; page-break-inside: avoid; text-align: justify; }

        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #bbb; font-family: system-ui, sans-serif; text-align: center; }

        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .translation-notice { display: none !important; }
          .page { margin: 0; padding: 40px 48px; box-shadow: none; max-width: 100%; }
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
          }}
        >
          <option value="__english">🇬🇧 English</option>
          {availableLangs.map(l => (
            <option key={l} value={`lang:${l}`}>🌐 {l}</option>
          ))}
          <option value="__universal">📋 Universal (industry-agnostic)</option>
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
      {/* Print tip — shown only on screen, hidden on print */}
      <div className="no-print" style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: 'rgba(255,255,255,0.5)', fontSize: 12, padding: '8px 16px', borderRadius: 99, whiteSpace: 'nowrap', backdropFilter: 'blur(8px)' }}>
        Click &quot;Save as PDF&quot; → in the print dialog choose &quot;Save as PDF&quot; as the destination
      </div>

      <div className="page">
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
      </div>
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
