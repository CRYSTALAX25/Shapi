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
    present: string
    verifiedBy: string
  }
  workHistory: WorkEntry[]
  chatAnswers: string[]
  skills: string[]
}

type Meta = {
  whatsapp_number: string | null
  ai_tier: string | null
  has_whatsapp: boolean
}

function PrintContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isNative = searchParams.get('lang') === 'native'
  const mode = isNative ? 'native' : 'english'

  const [cv, setCv] = useState<CV | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState('')
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true

    fetch('/api/cv/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setCv(d.cv)
        setMeta(d.meta)
      })
      .catch(() => setError('Failed to generate CV — please try again.'))
  }, [mode])

  const isRTL = cv && ['ar', 'he', 'ur', 'fa'].includes(cv.languageCode)

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#060609', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ color: '#FB7185', fontSize: 16, fontWeight: 700 }}>Something went wrong</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{error}</div>
        <button onClick={() => { fetched.current = false; setError(''); setCv(null) }}
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
          {isNative ? 'Writing your native language CV…' : 'Writing your CV…'}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Claude is weaving in your WhatsApp answers — about 20 seconds.</p>
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
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #f8f8f8; }

        .no-print {
          position: fixed; top: 16px; right: 16px; z-index: 100;
          display: flex; gap: 10px; align-items: center;
        }
        .btn { padding: 10px 20px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; font-family: system-ui, sans-serif; }
        .btn-primary { background: linear-gradient(135deg,#22D3EE,#A78BFA); color: #060609; }
        .btn-secondary { background: #e8e8e8; color: #333; }

        .page {
          max-width: 800px; margin: 32px auto; padding: 56px 64px;
          background: white; box-shadow: 0 4px 40px rgba(0,0,0,0.08);
          font-family: ${isRTL ? "'Noto Sans Arabic','Arial',sans-serif" : "'Georgia',serif"};
          color: #1a1a2e; direction: ${isRTL ? 'rtl' : 'ltr'};
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

        .section { margin-bottom: 28px; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #999; font-family: system-ui, sans-serif; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; }

        .summary { font-size: 14px; line-height: 1.7; color: #444; }

        .job { margin-bottom: 20px; }
        .job-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
        .job-title { font-size: 15px; font-weight: 700; }
        .job-company { font-size: 14px; color: #666; margin-bottom: 4px; }
        .job-dates { font-size: 12px; color: #999; font-family: system-ui, sans-serif; white-space: nowrap; }
        .job-achievements { font-size: 13px; line-height: 1.65; color: #555; margin-top: 6px; white-space: pre-line; }

        .skills { display: flex; flex-wrap: wrap; gap: 8px; }
        .skill { background: #f5f5f5; color: #444; font-size: 12px; padding: 4px 12px; border-radius: 999px; font-family: system-ui, sans-serif; }

        .quote { border-${isRTL ? 'right' : 'left'}: 3px solid #A78BFA; padding-${isRTL ? 'right' : 'left'}: 16px; margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #555; font-style: italic; }

        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #bbb; font-family: system-ui, sans-serif; text-align: center; }

        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .translation-notice { display: none !important; }
          .page { margin: 0; padding: 40px 48px; box-shadow: none; max-width: 100%; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print">
        <button className="btn btn-secondary" onClick={() => router.back()}>← Back</button>
        {isNative ? (
          <button className="btn btn-secondary" onClick={() => router.push('/profile/print')}>🇬🇧 English version</button>
        ) : (
          <button className="btn btn-secondary" onClick={() => router.push('/profile/print?lang=native')}>🌐 Native language</button>
        )}
        <button className="btn btn-primary" onClick={() => window.print()}>Download PDF ↓</button>
      </div>

      <div className="page">
        {isNative && cv.languageCode !== 'en' && (
          <div className="translation-notice">
            🌐 {cv.language} version — auto-translated by Shapi AI. Review before sending.
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
