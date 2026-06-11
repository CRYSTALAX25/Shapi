'use client'

// Free top-of-funnel "Profile Preview" hook.
//
// Sits ABOVE /upload-cv as a softer, no-login entry: a visitor drops a CV,
// we parse it (POST /api/preview — stateless, no auth, nothing stored) and
// render a POLISHED profile preview. The top (name, headline, top of summary)
// is fully visible to create desire; the lower/key parts (full summary, full
// experience, skills, verification tier) are BLURRED behind a gradient fade +
// lock chip. The prominent CTA unlocks the polished profile for $25 by routing
// into the existing CV Kit flow (signup → upload-cv → /pay → $25 cv-checkout).

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Stage = 'upload' | 'parsing' | 'preview'

type Lang = { language: string; level?: string }
type Job = { title?: string; company?: string; start?: string; end?: string; achievements?: string }
type Quadrant = { hands?: number; heart?: number; head?: number; spark?: number; reasoning?: string }

type Profile = {
  full_name?: string | null
  headline?: string | null
  location?: string | null
  summary?: string | null
  nationality?: string | null
  languages_spoken?: Lang[]
  work_history?: Job[]
  skills?: string[]
  ai_tier?: string | null
  matched_industries?: string[]
  skill_quadrant?: Quadrant | null
}

// $25 CV Kit unlock — drops the visitor into the real flow that ends at the
// existing /api/stripe/cv-checkout 'kit' ($25) Stripe session via /pay.
const UNLOCK_HREF = '/signup?type=candidate'

const TIER_LABEL: Record<string, string> = {
  user: 'AI User',
  integrator: 'AI Integrator',
  builder: 'AI Builder',
}

export default function PreviewPage() {
  const [stage, setStage] = useState<Stage>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('That file is over 5MB — try a smaller PDF')
      return
    }
    setFileName(file.name)
    setError('')
    setStage('parsing')

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/preview', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not read your CV — try again')
        setStage('upload')
        return
      }
      const data = await res.json()
      setProfile(data.profile || {})
      setStage('preview')
    } catch {
      setError('Something went wrong — try again')
      setStage('upload')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ─── Parsing ───
  if (stage === 'parsing') {
    return (
      <Screen>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(157, 140, 255, 0.18), rgba(157, 140, 255, 0.18))' }}>
            <div className="w-7 h-7 rounded-full border-2 border-[#9D8CFF] border-t-transparent animate-spin" />
          </div>
          <p className="text-[#F4F4F7] font-black text-xl mb-2">Polishing your profile…</p>
          <p className="text-[#7E7E8E] text-sm">{fileName}</p>
          <p className="text-[#7E7E8E] text-sm mt-3">Reading your experience, scoring your skills, writing your summary. About 10 seconds.</p>
        </div>
      </Screen>
    )
  }

  // ─── Preview (the hook) ───
  if (stage === 'preview' && profile) {
    return <PreviewResult profile={profile} onUnlock={() => router.push(UNLOCK_HREF)} />
  }

  // ─── Upload (default) ───
  return (
    <Screen>
      <CardStyles />
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <Link href="/" className="font-black text-2xl tracking-tighter inline-block" style={{
            background: 'linear-gradient(135deg, #9D8CFF, #34D399)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            animation: 'gradientShift 5s ease infinite',
          }}>shapi</Link>
          <h1 className="text-3xl font-black text-[#F4F4F7] mt-6 mb-3 tracking-tight">See your polished profile — free.</h1>
          <p className="text-[#A6A6B4] leading-relaxed text-sm">
            Drop your CV. In 10 seconds we&apos;ll show you the Shapi version of you — sharper headline, rewritten summary, scored skills. No signup to look.
          </p>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`gradient-border-card rounded-2xl p-12 text-center cursor-pointer mb-4 ${dragging ? 'drop-zone-active' : 'hover:bg-[rgba(255,255,255,0.03)]'}`}
        >
          <div className="w-14 h-14 rounded-xl bg-[rgba(157, 140, 255, 0.10)] flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-[#9D8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-[#F4F4F7] font-bold mb-1">Drop your CV here</p>
          <p className="text-sm text-[#7E7E8E]">or click to browse · PDF · Max 5MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>

        {error && (
          <p className="text-[#FB7185] text-sm text-center mb-3 bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <p className="text-center text-[11px] text-[#5C5C6A] mt-4">
          We don&apos;t store your CV from this preview. Free to look, no account needed.
        </p>
      </div>
    </Screen>
  )
}

// ─── The polished, partially-blurred preview ───
function PreviewResult({ profile, onUnlock }: { profile: Profile; onUnlock: () => void }) {
  const name = profile.full_name?.trim() || 'Your name'
  const headline = profile.headline?.trim() || 'Your professional headline'
  const summary = profile.summary?.trim() || ''
  const firstSentence = summary ? summary.split(/(?<=[.!?])\s+/)[0] : ''
  const restSummary = summary ? summary.slice(firstSentence.length).trim() : ''
  const jobs = Array.isArray(profile.work_history) ? profile.work_history : []
  const skills = Array.isArray(profile.skills) ? profile.skills : []
  const tier = profile.ai_tier && TIER_LABEL[profile.ai_tier] ? TIER_LABEL[profile.ai_tier] : null
  const industries = Array.isArray(profile.matched_industries) ? profile.matched_industries : []

  return (
    <div className="min-h-screen bg-[#060609]">
      <CardStyles />
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-2xl mx-auto border-b border-[rgba(255,255,255,0.08)]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #9D8CFF, #34D399)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <span className="text-[#7E7E8E] text-xs uppercase tracking-wider font-bold">Profile preview</span>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-5 pt-8 pb-32">

        {/* ── Visible top: name + headline (creates desire) ── */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-xl font-black text-white"
            style={{ background: 'linear-gradient(135deg, #9D8CFF, #34D399)' }}>
            {name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'S'}
          </div>
          <h1 className="text-2xl font-black text-[#F4F4F7]">{name}</h1>
          <p className="text-[#A6A6B4] text-sm mt-1">{headline}</p>
          {profile.location && <p className="text-[#7E7E8E] text-xs mt-1">{profile.location}</p>}

          <div className="flex items-center justify-center gap-2 flex-wrap mt-4">
            <span className="text-[11px] font-bold px-3 py-1 rounded-full"
              style={{ background: 'rgba(157, 140, 255, 0.12)', color: '#9D8CFF' }}>
              Shapi-polished
            </span>
            {industries.slice(0, 2).map((ind, i) => (
              <span key={i} className="text-[11px] font-bold px-3 py-1 rounded-full capitalize"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#A6A6B4' }}>
                {ind}
              </span>
            ))}
          </div>
        </div>

        {/* ── Summary: first sentence visible, rest blurred ── */}
        <div className="gradient-border-card rounded-2xl p-5 mb-4">
          <p className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-3">Professional summary</p>
          {firstSentence ? (
            <>
              <p className="text-[#F4F4F7] text-sm leading-relaxed">{firstSentence}</p>
              {restSummary && (
                <p className="text-[#F4F4F7] text-sm leading-relaxed blur-[5px] select-none mt-1" aria-hidden>
                  {restSummary}
                </p>
              )}
            </>
          ) : (
            <p className="text-[#F4F4F7] text-sm leading-relaxed blur-[5px] select-none" aria-hidden>
              A polished, specific professional summary written from your experience — quantified, sharp, and recruiter-ready.
            </p>
          )}
        </div>

        {/* ── Experience: first role visible, rest blurred under fade ── */}
        <div className="gradient-border-card rounded-2xl p-5 mb-4">
          <p className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-4">Experience</p>

          {jobs.length === 0 && (
            <p className="text-[#7E7E8E] text-sm">Your work history, rewritten with impact.</p>
          )}

          {jobs[0] && (
            <div className="mb-4">
              <p className="text-[#F4F4F7] text-sm font-bold">{jobs[0].title || 'Role'}</p>
              <p className="text-[#A6A6B4] text-xs">
                {[jobs[0].company, [jobs[0].start, jobs[0].end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
              </p>
              {jobs[0].achievements && (
                <p className="text-[#A6A6B4] text-xs leading-relaxed mt-2 line-clamp-2">
                  {jobs[0].achievements}
                </p>
              )}
            </div>
          )}

          {/* Remaining roles blurred with a gradient fade-out */}
          {jobs.length > 1 && (
            <div className="relative">
              <div className="blur-[6px] select-none space-y-4 pointer-events-none" aria-hidden>
                {jobs.slice(1, 4).map((job, i) => (
                  <div key={i}>
                    <p className="text-[#F4F4F7] text-sm font-bold">{job.title || 'Role'}</p>
                    <p className="text-[#A6A6B4] text-xs">
                      {[job.company, [job.start, job.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
                    </p>
                    {job.achievements && (
                      <p className="text-[#A6A6B4] text-xs leading-relaxed mt-1">{job.achievements.slice(0, 140)}</p>
                    )}
                  </div>
                ))}
              </div>
              <FadeOverlay />
            </div>
          )}
        </div>

        {/* ── Skills + verification tier teaser: blurred ── */}
        <div className="gradient-border-card rounded-2xl p-5 mb-4 relative overflow-hidden">
          <p className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-4">Skills &amp; verification</p>

          <div className="blur-[5px] select-none pointer-events-none" aria-hidden>
            <div className="flex flex-wrap gap-2 mb-4">
              {(skills.length ? skills.slice(0, 10) : ['Leadership', 'Operations', 'Strategy', 'Communication', 'Analysis', 'Project delivery']).map((s, i) => (
                <span key={i} className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#C7C7D1' }}>
                  {s}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold px-3 py-1 rounded-full"
                style={{ background: 'rgba(157, 140, 255, 0.13)', color: '#9D8CFF' }}>
                {tier || 'AI Integrator'}
              </span>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full"
                style={{ background: 'rgba(52,211,153,0.13)', color: '#34D399' }}>
                Verification ready
              </span>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <LockChip label="Unlock to reveal" />
          </div>
        </div>

        {/* ── Unlock CTA ── */}
        <div className="gradient-border-card rounded-2xl p-6 mt-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[#F4F4F7] font-black text-lg">Unlock your polished profile</p>
              <p className="text-[#7E7E8E] text-sm mt-1">Full rewrite · every section · yours to keep</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-[#F4F4F7]">$25</p>
              <p className="text-[#7E7E8E] text-xs">one-time</p>
            </div>
          </div>

          <div className="space-y-2.5 mb-5">
            {[
              'Full rewritten summary + every role, quantified',
              'Verified skills + AI tier on your public profile',
              'Multi-language &amp; industry-targeted CV versions',
              'Downloadable PDF — sent to WhatsApp &amp; email',
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-[#34D399] text-sm flex-shrink-0">✓</span>
                <p className="text-[#A6A6B4] text-xs" dangerouslySetInnerHTML={{ __html: line }} />
              </div>
            ))}
          </div>

          <button
            onClick={onUnlock}
            className="w-full py-4 rounded-full font-black text-sm text-white hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #9D8CFF, #34D399)' }}
          >
            Unlock your polished profile — $25 →
          </button>
          <p className="text-center text-[11px] text-[#5C5C6A] mt-3">
            Already started?{' '}
            <Link href="/login" className="text-[#9D8CFF] hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function FadeOverlay() {
  return (
    <div className="absolute inset-0 flex items-end justify-center"
      style={{ background: 'linear-gradient(to bottom, rgba(14,14,19,0) 0%, rgba(14,14,19,0.6) 55%, #060609 100%)' }}>
      <div className="mb-2">
        <LockChip label="Unlock to see all roles" />
      </div>
    </div>
  )
}

function LockChip({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#C7C7D1] bg-[#0D0C14]/90 border border-[rgba(255,255,255,0.1)] px-3 py-1.5 rounded-full">
      <svg className="w-3 h-3 text-[#9D8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      {label}
    </span>
  )
}

// Shared dark layout wrapper (matches /upload-cv).
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060609] flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

function CardStyles() {
  return (
    <style>{`
      @keyframes gradientShift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      .gradient-border-card {
        background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                    linear-gradient(135deg, rgba(157, 140, 255, 0.2), rgba(157, 140, 255, 0.2)) border-box;
        border: 1px solid transparent;
        box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        transition: all 0.25s ease;
      }
      .drop-zone-active {
        background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                    linear-gradient(135deg, rgba(157, 140, 255, 0.6), rgba(157, 140, 255, 0.6)) border-box !important;
        transform: scale(1.01);
      }
    `}</style>
  )
}
