'use client'

// 3 CV design variants for side-by-side preview. Same data, different styling.
// Open ?variant=a / b / c in separate tabs to compare. Save-as-PDF on each.
//
//  A — "Verified Profile" two-column, Skill Fingerprint sidebar, brand gradient accent
//  B — "Story" single-column with inline WhatsApp quotes, warm cream paper feel
//  C — "Quadrant Header" bold modern header with embedded SVG radar + stats bar

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

type WorkEntry = { title?: string; company?: string; start?: string; end?: string; achievements?: string }

type CV = {
  language: string
  languageCode: string
  full_name: string
  headline: string
  location: string
  summary: string
  workHistory: WorkEntry[]
  chatAnswers: string[]
  skills: string[]
  languages_spoken?: Array<{ language: string; level: string }>
  certifications?: Array<{ name?: string; issuer?: string; year?: string }>
  courses?: Array<{ name?: string; platform?: string; year?: string }>
}

type Profile = {
  skill_quadrant?: { hands: number; heart: number; head: number; spark: number } | null
  ai_tier?: string | null
  verification_tier?: string | null
  id?: string
}

function PreviewContent() {
  const params = useSearchParams()
  const variant = (params.get('variant') || 'a').toLowerCase() as 'a' | 'b' | 'c'

  const [cv, setCv] = useState<CV | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true

    // Use cached English CV if available, otherwise fetch
    try {
      const stored = sessionStorage.getItem('shapi_cv_english')
      if (stored) {
        const p = JSON.parse(stored)
        if (p.cv) setCv(p.cv)
      }
    } catch { /* ignore */ }

    fetch('/api/cv/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'english' }),
    })
      .then(r => r.json())
      .then(d => { if (d.cv) setCv(d.cv) })
      .catch(() => {})

    fetch('/api/profile/get')
      .then(r => r.json())
      .then(({ profile }) => {
        if (!profile) return
        setProfile({
          skill_quadrant: profile.skill_quadrant,
          ai_tier: profile.ai_tier,
          verification_tier: profile.verification_tier,
          id: profile.id,
        })
        // Auto-compute skill_quadrant if it's missing — common for accounts
        // whose CV was parsed before the quadrant extractor was added.
        if (!profile.skill_quadrant) {
          fetch('/api/profile/refresh-quadrant', { method: 'POST' })
            .then(r => r.json())
            .then(d => {
              if (d.success && d.skill_quadrant) {
                setProfile(prev => prev ? { ...prev, skill_quadrant: d.skill_quadrant } : prev)
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  if (!cv) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: 'system-ui' }}>
        Loading your CV preview…
      </div>
    )
  }

  return (
    <>
      <ToolBar variant={variant} />
      {variant === 'a' && <VariantA cv={cv} profile={profile} />}
      {variant === 'b' && <VariantB cv={cv} profile={profile} />}
      {variant === 'c' && <VariantC cv={cv} profile={profile} />}
    </>
  )
}

function ToolBar({ variant }: { variant: 'a' | 'b' | 'c' }) {
  const variantLabels = {
    a: 'A · Verified Profile',
    b: 'B · Story',
    c: 'C · Quadrant Header',
  }
  return (
    <div className="no-print" style={{
      position: 'fixed', top: 12, right: 12, zIndex: 9999, display: 'flex', gap: 8, alignItems: 'center',
      background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)',
      padding: '8px 12px', borderRadius: 999, boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      fontFamily: 'system-ui',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#333', marginRight: 4 }}>{variantLabels[variant]}</span>
      {(['a', 'b', 'c'] as const).map(v => (
        <a key={v} href={`/profile/print/preview?variant=${v}`}
          style={{
            padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            textDecoration: 'none',
            background: v === variant ? '#1a1a2e' : '#e8e8e8',
            color: v === variant ? 'white' : '#333',
          }}>{v.toUpperCase()}</a>
      ))}
      <button onClick={() => setTimeout(() => window.print(), 100)}
        style={{
          padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 800, border: 'none',
          background: 'linear-gradient(135deg, #22D3EE, #A78BFA)', color: '#060609', cursor: 'pointer',
        }}>
        ↓ Save as PDF
      </button>
    </div>
  )
}

// ═══ VARIANT A — Verified Profile (two-column, sidebar with fingerprint + tier) ═══
function VariantA({ cv, profile }: { cv: CV; profile: Profile | null }) {
  const q = profile?.skill_quadrant
  const tier = profile?.verification_tier
  const tierMeta: Record<string, { label: string; color: string }> = {
    basic: { label: 'Basic Verified', color: '#22D3EE' },
    strong: { label: 'Strongly Verified', color: '#34D399' },
    premium: { label: 'Premium Verified', color: '#FBBF24' },
  }
  const tierInfo = tier && tier !== 'unverified'
    ? tierMeta[tier]
    : { label: 'Shapi Verified Profile', color: '#A78BFA' }  // fallback for Kit users — generic "verified" badge

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: #ECEFF4; color: #1a1a2e; font-family: 'Inter','Helvetica Neue',Arial,system-ui,sans-serif; }
        .page-a { width: 210mm; min-height: 297mm; margin: 24px auto; background: white; box-shadow: 0 6px 48px rgba(0,0,0,0.12); display: grid; grid-template-columns: 1fr 220px; }
        .top-strip { grid-column: 1 / -1; height: 6px; background: linear-gradient(90deg,#22D3EE,#A78BFA); }
        .main-col { padding: 36px 32px 32px 40px; }
        .side-col { padding: 36px 24px 32px 24px; background: #F7F9FB; border-left: 1px solid #E5E9F0; }
        h1.name { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
        .headline-a { font-size: 14px; color: #555; margin-top: 4px; }
        .location-a { font-size: 12px; color: #888; margin-top: 8px; }
        .verified-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; margin-top: 12px; }
        .section-a { margin-top: 22px; }
        .label-a { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #6B7280; margin-bottom: 8px; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; }
        .summary-a { font-size: 12.5px; line-height: 1.6; color: #374151; }
        .job-a { margin-bottom: 14px; break-inside: avoid; }
        .jt { font-size: 13px; font-weight: 700; }
        .jc { font-size: 12px; color: #4B5563; }
        .jd { font-size: 11px; color: #9CA3AF; }
        .jach { font-size: 11.5px; line-height: 1.6; color: #4B5563; margin-top: 4px; white-space: pre-line; }
        .side-label { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #6B7280; margin-bottom: 8px; }
        .side-block { margin-bottom: 20px; }
        .bar-row { display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; font-weight: 600; margin-bottom: 6px; color: #1a1a2e; }
        .bar-fill { display: flex; align-items: center; gap: 2px; }
        .bar-seg { width: 8px; height: 6px; border-radius: 1px; }
        .side-chip { display: inline-block; font-size: 10px; padding: 3px 8px; border-radius: 999px; background: white; color: #374151; border: 1px solid #E5E7EB; margin: 2px 3px 2px 0; }
        .footer-a { grid-column: 1 / -1; padding: 14px 32px 24px; font-size: 9.5px; color: #9CA3AF; border-top: 1px solid #E5E7EB; text-align: center; }
        @media print {
          html, body { background: white; }
          .no-print { display: none !important; }
          .page-a { margin: 0; box-shadow: none; }
        }
      `}</style>
      <div className="page-a">
        <div className="top-strip" />

        <div className="main-col">
          <h1 className="name">{cv.full_name}</h1>
          <p className="headline-a">{cv.headline}</p>
          <p className="location-a">📍 {cv.location}</p>
          {tierInfo && (
            <span className="verified-chip" style={{ background: tierInfo.color + '15', color: tierInfo.color, border: `1px solid ${tierInfo.color}40` }}>
              ✓ {tierInfo.label}
            </span>
          )}

          <div className="section-a">
            <p className="label-a">Profile</p>
            <p className="summary-a">{cv.summary}</p>
          </div>

          <div className="section-a">
            <p className="label-a">Experience</p>
            {cv.workHistory.map((j, i) => (
              <div key={i} className="job-a">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div className="jt">{j.title}</div>
                  <div className="jd">{j.start} – {j.end || 'Present'}</div>
                </div>
                <div className="jc">{j.company}</div>
                {j.achievements && <div className="jach">{j.achievements}</div>}
              </div>
            ))}
          </div>

          {(cv.certifications?.length || 0) > 0 && (
            <div className="section-a">
              <p className="label-a">Certifications & Learning</p>
              <p style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.5 }}>
                {cv.certifications!.map(c => `${c.name}${c.issuer ? ' (' + c.issuer + ')' : ''}${c.year ? ' ' + c.year : ''}`).join(' · ')}
              </p>
            </div>
          )}
        </div>

        <div className="side-col">
          {q && (
            <div className="side-block">
              <p className="side-label">Skill Fingerprint</p>
              {([
                { key: 'heart', label: 'Heart', val: Math.round(q.heart), color: '#FB7185' },
                { key: 'spark', label: 'Spark', val: Math.round(q.spark), color: '#A78BFA' },
                { key: 'head', label: 'Head', val: Math.round(q.head), color: '#22D3EE' },
                { key: 'hands', label: 'Hands', val: Math.round(q.hands), color: '#34D399' },
              ]).map(r => (
                <div key={r.key} className="bar-row">
                  <span>{r.label}</span>
                  <div className="bar-fill">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} className="bar-seg" style={{ background: i < r.val ? r.color : '#E5E7EB' }} />
                    ))}
                  </div>
                </div>
              ))}
              {profile?.ai_tier && (
                <p style={{ fontSize: 10, color: '#6B7280', marginTop: 8 }}>🤖 AI {profile.ai_tier.charAt(0).toUpperCase() + profile.ai_tier.slice(1)}</p>
              )}
            </div>
          )}

          {cv.languages_spoken && cv.languages_spoken.length > 0 && (
            <div className="side-block">
              <p className="side-label">Languages</p>
              <div>
                {cv.languages_spoken.map((l, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#374151', marginBottom: 3 }}>
                    <strong>{l.language}</strong> <span style={{ color: '#9CA3AF' }}>· {l.level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="side-block">
            <p className="side-label">Skills</p>
            <div>{cv.skills.slice(0, 20).map((s, i) => <span key={i} className="side-chip">{s}</span>)}</div>
          </div>
        </div>

        <div className="footer-a">
          {profile?.id ? `Verified by Shapi · shapi.io/p/${profile.id.slice(0, 8)}` : 'Verified by Shapi · shapi.io'}
        </div>
      </div>
    </>
  )
}

// ═══ VARIANT B — Story (warm cream, inline WhatsApp quotes) ═══
function VariantB({ cv, profile }: { cv: CV; profile: Profile | null }) {
  const tier = profile?.verification_tier
  // Pair every other job with a chat answer as an inline pull-quote — best storytelling
  const quotes = cv.chatAnswers || []

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: #F4F1EC; color: #2C2A24; font-family: 'Charter','Georgia','Cambria',serif; }
        .page-b { max-width: 210mm; min-height: 297mm; margin: 24px auto; background: #FDFBF7; box-shadow: 0 6px 48px rgba(0,0,0,0.10); padding: 56px 60px 48px; }
        .hdr { border-bottom: 2px solid #C7A36F; padding-bottom: 18px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
        .hdr-left h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.3px; }
        .hdr-left .head-b { font-size: 14px; color: #5C4A1E; font-style: italic; margin-top: 4px; }
        .hdr-left .loc-b { font-size: 11.5px; color: #8A7C52; margin-top: 4px; font-family: system-ui; }
        .verified-b { font-size: 10px; font-weight: 700; padding: 5px 10px; border-radius: 4px; white-space: nowrap; font-family: system-ui; letter-spacing: 0.5px; }
        .label-b { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: #C7A36F; font-family: system-ui; margin: 22px 0 10px; }
        .summary-b { font-size: 13px; line-height: 1.75; color: #38332B; text-align: justify; }
        .job-b { margin-bottom: 18px; break-inside: avoid; }
        .job-b .row { display: flex; justify-content: space-between; align-items: baseline; }
        .job-b .t { font-size: 14px; font-weight: 700; color: #2C2A24; }
        .job-b .d { font-size: 11px; color: #8A7C52; font-family: system-ui; }
        .job-b .c { font-size: 13px; color: #5C4A1E; font-style: italic; }
        .job-b .a { font-size: 12px; line-height: 1.65; color: #4A4337; margin-top: 4px; white-space: pre-line; }
        .quote-b { border-left: 3px solid #A78BFA; padding: 8px 0 8px 16px; margin: 14px 0; font-size: 12.5px; line-height: 1.6; color: #4A4337; font-style: italic; }
        .quote-b .attr { font-size: 9.5px; font-style: normal; color: #9C8C5C; margin-top: 6px; font-family: system-ui; letter-spacing: 0.5px; text-transform: uppercase; }
        .footer-b { margin-top: 32px; padding-top: 14px; border-top: 1px solid #E0D7C7; font-size: 10px; color: #8A7C52; text-align: center; font-family: system-ui; }
        .langs-row { display: flex; flex-wrap: wrap; gap: 14px; }
        .lang-b { font-size: 11.5px; color: #38332B; }
        .lang-b strong { color: #5C4A1E; }
        .skills-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .skill-b { font-size: 10.5px; padding: 3px 9px; border-radius: 3px; background: #F0E9D8; color: #5C4A1E; font-family: system-ui; }
        @media print {
          html, body { background: #FDFBF7; }
          .no-print { display: none !important; }
          .page-b { margin: 0; box-shadow: none; }
        }
      `}</style>
      <div className="page-b">
        <div className="hdr">
          <div className="hdr-left">
            <h1>{cv.full_name}</h1>
            <p className="head-b">{cv.headline}</p>
            <p className="loc-b">📍 {cv.location}</p>
          </div>
          <span className="verified-b" style={{
            background: tier === 'premium' ? '#FEF3C7' : tier === 'strong' ? '#D1FAE5' : tier === 'basic' ? '#DBEAFE' : '#EDE9FE',
            color: tier === 'premium' ? '#92400E' : tier === 'strong' ? '#065F46' : tier === 'basic' ? '#1E40AF' : '#5B21B6',
            border: `1px solid ${tier === 'premium' ? '#FBBF24' : tier === 'strong' ? '#34D399' : tier === 'basic' ? '#3B82F6' : '#A78BFA'}`,
          }}>
            ✓ {tier === 'premium' ? 'Premium Verified' : tier === 'strong' ? 'Strongly Verified' : tier === 'basic' ? 'Basic Verified' : 'Shapi Verified'}
          </span>
        </div>

        <p className="label-b">In Their Own Words</p>
        <p className="summary-b">{cv.summary}</p>

        {quotes.length > 0 && (
          <div className="quote-b">
            &ldquo;{quotes[0]}&rdquo;
            <p className="attr">— {cv.full_name.split(' ')[0]}, in their own words</p>
          </div>
        )}

        <p className="label-b">Experience</p>
        {cv.workHistory.map((j, i) => (
          <div key={i}>
            <div className="job-b">
              <div className="row">
                <div className="t">{j.title}</div>
                <div className="d">{j.start} – {j.end || 'Present'}</div>
              </div>
              <div className="c">{j.company}</div>
              {j.achievements && <div className="a">{j.achievements}</div>}
            </div>
            {/* Insert a quote between every 2-3 roles for storytelling */}
            {i === 1 && quotes[1] && (
              <div className="quote-b">
                &ldquo;{quotes[1]}&rdquo;
                <p className="attr">— in their own words</p>
              </div>
            )}
            {i === 3 && quotes[2] && (
              <div className="quote-b">
                &ldquo;{quotes[2]}&rdquo;
                <p className="attr">— in their own words</p>
              </div>
            )}
          </div>
        ))}

        {cv.languages_spoken && cv.languages_spoken.length > 0 && (
          <>
            <p className="label-b">Languages</p>
            <div className="langs-row">
              {cv.languages_spoken.map((l, i) => (
                <span key={i} className="lang-b"><strong>{l.language}</strong> · {l.level}</span>
              ))}
            </div>
          </>
        )}

        <p className="label-b">Skills</p>
        <div className="skills-row">
          {cv.skills.slice(0, 24).map((s, i) => <span key={i} className="skill-b">{s}</span>)}
        </div>

        <div className="footer-b">
          {profile?.id ? `Verified by Shapi · shapi.io/p/${profile.id.slice(0, 8)}` : 'Verified by Shapi · shapi.io'}
        </div>
      </div>
    </>
  )
}

// ═══ VARIANT C — Quadrant Header (bold modern header with SVG radar) ═══
function VariantC({ cv, profile }: { cv: CV; profile: Profile | null }) {
  const q = profile?.skill_quadrant
  const tier = profile?.verification_tier

  // SVG radar coords
  const radarSize = 110
  const cx = radarSize / 2, cy = radarSize / 2, maxR = 38
  const pt = (angle: number, val: number) => {
    const r = (val / 10) * maxR
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }
  const angles = { head: -Math.PI / 2, spark: 0, heart: Math.PI / 2, hands: Math.PI }
  const path = q ? (() => {
    const p = {
      head: pt(angles.head, q.head),
      spark: pt(angles.spark, q.spark),
      heart: pt(angles.heart, q.heart),
      hands: pt(angles.hands, q.hands),
    }
    return `M ${p.head.x} ${p.head.y} L ${p.spark.x} ${p.spark.y} L ${p.heart.x} ${p.heart.y} L ${p.hands.x} ${p.hands.y} Z`
  })() : ''

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: #F0F2F8; color: #14152A; font-family: 'Inter','Helvetica Neue',Arial,system-ui,sans-serif; }
        .page-c { max-width: 210mm; min-height: 297mm; margin: 24px auto; background: white; box-shadow: 0 6px 48px rgba(0,0,0,0.12); }
        .top-strip-c { height: 8px; background: linear-gradient(90deg,#22D3EE 0%,#A78BFA 50%,#FB7185 100%); }
        .header-c { padding: 32px 44px 24px; display: flex; justify-content: space-between; align-items: center; gap: 28px; border-bottom: 1px solid #E5E7EB; }
        .header-c .lhs h1 { font-size: 32px; font-weight: 900; letter-spacing: -0.8px; line-height: 1.1; }
        .header-c .lhs .h2-c { font-size: 14px; color: #4B5563; margin-top: 6px; font-weight: 500; }
        .header-c .lhs .loc-c { font-size: 12px; color: #9CA3AF; margin-top: 6px; }
        .stats-c { background: linear-gradient(135deg,#F9FAFB,#EEF2F6); padding: 18px 44px; display: flex; gap: 18px; flex-wrap: wrap; align-items: center; font-size: 11.5px; border-bottom: 1px solid #E5E7EB; }
        .chip-c { display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .body-c { padding: 28px 44px 28px; }
        .label-c { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #1a1a2e; margin: 22px 0 10px; display: flex; align-items: center; gap: 8px; }
        .label-c::before { content: ''; width: 18px; height: 2px; background: linear-gradient(90deg,#22D3EE,#A78BFA); display: inline-block; }
        .summary-c { font-size: 13px; line-height: 1.68; color: #374151; }
        .job-c { margin-bottom: 16px; break-inside: avoid; padding-bottom: 12px; border-bottom: 1px dashed #E5E7EB; }
        .job-c:last-child { border-bottom: none; }
        .job-c .row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
        .job-c .t { font-size: 14px; font-weight: 700; color: #14152A; }
        .job-c .c { font-size: 12.5px; color: #6B7280; }
        .job-c .d { font-size: 11px; color: #9CA3AF; font-feature-settings: 'tnum'; }
        .job-c .a { font-size: 12px; line-height: 1.65; color: #4B5563; margin-top: 4px; white-space: pre-line; }
        .skills-c { display: flex; flex-wrap: wrap; gap: 6px; }
        .skill-c { font-size: 11px; padding: 4px 10px; border-radius: 6px; background: linear-gradient(135deg,#F0F4FA,#E8EEF7); color: #1a1a2e; border: 1px solid #E0E7F0; }
        .lang-c { font-size: 12px; color: #1a1a2e; }
        .lang-c strong { color: #14152A; }
        .footer-c { padding: 16px 44px 24px; font-size: 10px; color: #9CA3AF; border-top: 1px solid #E5E7EB; text-align: center; }
        @media print {
          html, body { background: white; }
          .no-print { display: none !important; }
          .page-c { margin: 0; box-shadow: none; }
        }
      `}</style>
      <div className="page-c">
        <div className="top-strip-c" />

        <div className="header-c">
          <div className="lhs">
            <h1>{cv.full_name}</h1>
            <p className="h2-c">{cv.headline}</p>
            <p className="loc-c">📍 {cv.location}</p>
          </div>

          {q && (
            <svg width={radarSize} height={radarSize} viewBox={`0 0 ${radarSize} ${radarSize}`} style={{ flexShrink: 0 }}>
              <defs>
                <linearGradient id="radarFillC" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              {[0.33, 0.66, 1].map(r => (
                <path key={r} d={`M ${cx} ${cy - maxR * r} L ${cx + maxR * r} ${cy} L ${cx} ${cy + maxR * r} L ${cx - maxR * r} ${cy} Z`}
                  fill="none" stroke="#E5E7EB" strokeWidth={1} />
              ))}
              <path d={path} fill="url(#radarFillC)" stroke="#22D3EE" strokeWidth={1.5} strokeLinejoin="round" />
              <text x={cx} y={cy - maxR - 4} fontSize={8} fontWeight={700} textAnchor="middle" fill="#6B7280">HEAD</text>
              <text x={cx + maxR + 14} y={cy + 3} fontSize={8} fontWeight={700} textAnchor="middle" fill="#6B7280">SPARK</text>
              <text x={cx} y={cy + maxR + 10} fontSize={8} fontWeight={700} textAnchor="middle" fill="#6B7280">HEART</text>
              <text x={cx - maxR - 14} y={cy + 3} fontSize={8} fontWeight={700} textAnchor="middle" fill="#6B7280">HANDS</text>
            </svg>
          )}
        </div>

        <div className="stats-c">
          <span className="chip-c" style={{
            background: tier === 'premium' ? '#FEF3C7' : tier === 'strong' ? '#D1FAE5' : tier === 'basic' ? '#DBEAFE' : '#EDE9FE',
            color: tier === 'premium' ? '#92400E' : tier === 'strong' ? '#065F46' : tier === 'basic' ? '#1E40AF' : '#5B21B6',
          }}>
            ✓ {tier === 'premium' ? 'Premium Verified' : tier === 'strong' ? 'Strongly Verified' : tier === 'basic' ? 'Basic Verified' : 'Shapi Verified'}
          </span>
          {profile?.ai_tier && (
            <span className="chip-c" style={{ background: '#EDE9FE', color: '#5B21B6' }}>
              🤖 AI {profile.ai_tier.charAt(0).toUpperCase() + profile.ai_tier.slice(1)}
            </span>
          )}
          {cv.languages_spoken && cv.languages_spoken.length > 0 && (
            <span style={{ color: '#4B5563' }}>
              <strong style={{ color: '#1a1a2e' }}>Speaks:</strong> {cv.languages_spoken.map(l => l.language).join(' · ')}
            </span>
          )}
        </div>

        <div className="body-c">
          <p className="label-c">Profile</p>
          <p className="summary-c">{cv.summary}</p>

          <p className="label-c">Experience</p>
          {cv.workHistory.map((j, i) => (
            <div key={i} className="job-c">
              <div className="row">
                <div>
                  <div className="t">{j.title}</div>
                  <div className="c">{j.company}</div>
                </div>
                <div className="d">{j.start} – {j.end || 'Present'}</div>
              </div>
              {j.achievements && <div className="a">{j.achievements}</div>}
            </div>
          ))}

          <p className="label-c">Skills</p>
          <div className="skills-c">
            {cv.skills.slice(0, 24).map((s, i) => <span key={i} className="skill-c">{s}</span>)}
          </div>

          {(cv.certifications?.length || 0) > 0 && (
            <>
              <p className="label-c">Certifications & Learning</p>
              <p style={{ fontSize: 11.5, color: '#4B5563', lineHeight: 1.55 }}>
                {cv.certifications!.map(c => `${c.name}${c.issuer ? ' (' + c.issuer + ')' : ''}${c.year ? ' ' + c.year : ''}`).join(' · ')}
              </p>
            </>
          )}
        </div>

        <div className="footer-c">
          {profile?.id ? `Verified by Shapi · shapi.io/p/${profile.id.slice(0, 8)}` : 'Verified by Shapi · shapi.io'}
        </div>
      </div>
    </>
  )
}

export default function PrintPreview() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#1a1a2e' }} />}>
      <PreviewContent />
    </Suspense>
  )
}
