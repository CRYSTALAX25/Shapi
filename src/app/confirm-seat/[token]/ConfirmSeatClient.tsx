'use client'

// Client half of /confirm-seat/[token] — the employee's 10-second confirm
// flow. Candidate-side palette (#060609 bg, #38BDF8→#38BDF8 gradient), same
// visual language as /reference/[token]. Mobile-first: one card, two big
// buttons, optional corrections form.

import { useState } from 'react'
import Link from 'next/link'
import CultureSurveyForm from '@/app/culture/[token]/CultureSurveyForm'

type InitialState = 'pending' | 'confirmed' | 'disputed' | 'expired' | 'invalid'

type Props = {
  token: string
  initial: {
    state: InitialState
    personName?: string | null
    companyName?: string
    seatTitle?: string
    teamName?: string | null
    managerName?: string | null
  }
}

const FSI: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, padding: '14px 16px', fontSize: 14, color: '#F4F4F7', outline: 'none',
  fontFamily: 'inherit', lineHeight: 1.6,
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060609]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.05) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
      <nav className="relative z-10 px-6 py-5 border-b border-[rgba(255,255,255,0.08)]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
      </nav>
      <div className="relative z-10 max-w-md mx-auto px-6 pt-10 pb-24">{children}</div>
    </div>
  )
}

function Center({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <Shell>
      <div className="text-center pt-12">
        <div className="text-4xl mb-4">{icon}</div>
        <h1 className="text-2xl font-black text-[#F4F4F7] mb-3">{title}</h1>
        <p className="text-[#A6A6B4] text-sm leading-relaxed">{body}</p>
        <p className="text-[#5C5C6A] text-xs mt-8"><Link href="/" className="text-[#7E7E8E] hover:text-[#A6A6B4]">shapi.io</Link></p>
      </div>
    </Shell>
  )
}

export default function ConfirmSeatClient({ token, initial }: Props) {
  const [state, setState] = useState<InitialState>(initial.state)
  // After confirming, we offer the anonymous culture survey (Layer 2 of the
  // trust score). cultureToken is minted server-side on confirm.
  const [cultureToken, setCultureToken] = useState<string | null>(null)
  const [cultureSkipped, setCultureSkipped] = useState(false)
  const [disputing, setDisputing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Corrections form
  const [correctTitle, setCorrectTitle] = useState('')
  const [correctTeam, setCorrectTeam] = useState('')
  const [correctManager, setCorrectManager] = useState('')
  const [note, setNote] = useState('')

  const firstName = (initial.personName || '').trim().split(' ')[0] || 'there'

  async function respond(action: 'confirm' | 'dispute') {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/company/spine/verify/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'confirm'
          ? { token, action }
          : {
              token, action,
              corrections: {
                correct_title: correctTitle || null,
                correct_team: correctTeam || null,
                correct_manager: correctManager || null,
                note: note || null,
              },
            }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 410) { setState('expired'); return }
      if (res.status === 404) { setState('invalid'); return }
      if (!res.ok) { setError(data.error || 'Something went wrong — please try again.'); return }
      // Idempotent re-visit: server reports the existing status.
      setState(data.status === 'disputed' ? 'disputed' : 'confirmed')
      if (action === 'confirm' && typeof data.cultureToken === 'string') setCultureToken(data.cultureToken)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'invalid') {
    return <Center icon="🔍" title="Link not found" body="This confirmation link is invalid. If you received it recently, ask your company to send a new one." />
  }
  if (state === 'expired') {
    return <Center icon="⏳" title="This link has expired" body="Seat confirmation links are valid for 14 days. Ask your company to send a fresh one — it takes them one click." />
  }
  if (state === 'confirmed') {
    const companyName = initial.companyName || 'your company'
    // Piggyback: offer the anonymous culture survey right after confirming.
    if (cultureToken && !cultureSkipped) {
      return (
        <Shell>
          <div className="text-center">
            <div className="text-3xl mb-2">✓</div>
            <h1 className="text-2xl font-black text-[#F4F4F7] mb-2">Verified — thanks, {firstName}.</h1>
          </div>
          <p className="text-[#A6A6B4] text-sm leading-relaxed mb-1">
            While you&rsquo;re here: <strong className="text-[#C7C7D1]">anonymously</strong>, what&rsquo;s it really like to work at {companyName}?
          </p>
          <p className="text-[#7E7E8E] text-xs leading-relaxed mb-5">
            {companyName} only ever sees the combined averages — never your individual answers, and never that you took part.
            A score only appears once at least 3 people respond. Totally optional.
          </p>
          <CultureSurveyForm token={cultureToken} companyName={companyName} respondentType="current" />
          <button onClick={() => setCultureSkipped(true)} className="w-full py-3 mt-3 text-xs" style={{ color: '#7E7E8E' }}>
            No thanks — I&rsquo;m done
          </button>
        </Shell>
      )
    }
    return <Center icon="✓" title={`Thank you, ${firstName}.`} body={`Your role at ${companyName} is confirmed and now shows as verified on the org chart. Nothing else to do.`} />
  }
  if (state === 'disputed') {
    return <Center icon="📝" title={`Got it, ${firstName}.`} body="We've flagged this seat for review and passed your corrections along. Your company will update the org chart." />
  }

  // ── PENDING — the confirm card ──────────────────────────────────────
  return (
    <Shell>
      <span className="text-[#38BDF8] text-xs font-bold uppercase tracking-wider">Role confirmation</span>
      <h1 className="text-2xl sm:text-3xl font-black text-[#F4F4F7] mt-2 mb-3">
        Hi {firstName} 👋
      </h1>
      <p className="text-[#A6A6B4] text-sm leading-relaxed mb-6">
        <strong className="text-[#C7C7D1]">{initial.companyName}</strong> uses Shapi to keep a
        verified org chart. Confirm your role — takes 10 seconds, no account needed.
      </p>

      {/* Seat card */}
      <div style={{
        background: 'linear-gradient(#0D0C14,#0D0C14) padding-box,linear-gradient(135deg,rgba(56, 189, 248, 0.25),rgba(56, 189, 248, 0.25)) border-box',
        border: '1px solid transparent', borderRadius: 16, padding: 24, marginBottom: 24,
      }}>
        <p className="text-[#7E7E8E] text-[11px] font-bold uppercase tracking-wider mb-2">We have you down as</p>
        <p className="text-xl font-black" style={{ color: '#F4F4F7' }}>{initial.seatTitle}</p>
        {initial.teamName && (
          <p className="text-sm mt-1" style={{ color: '#A6A6B4' }}>Team: {initial.teamName}</p>
        )}
        {initial.managerName && (
          <p className="text-sm mt-0.5" style={{ color: '#A6A6B4' }}>Reporting to: {initial.managerName}</p>
        )}
      </div>

      {error && (
        <p className="text-sm mb-4 px-4 py-3 rounded-xl" style={{ color: '#FB7185', background: 'rgba(251, 113, 133, 0.08)', border: '1px solid rgba(251, 113, 133, 0.25)' }}>
          {error}
        </p>
      )}

      {!disputing ? (
        <div className="space-y-3">
          <button
            onClick={() => respond('confirm')}
            disabled={submitting}
            className="w-full py-4 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)', color: '#fff' }}
          >
            {submitting ? 'Confirming…' : "That's right ✓"}
          </button>
          <button
            onClick={() => setDisputing(true)}
            disabled={submitting}
            className="w-full py-4 rounded-full font-bold text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#A6A6B4' }}
          >
            Something&rsquo;s off
          </button>
          <p className="text-center text-xs text-[#5C5C6A] pt-2">
            Confirming marks this seat as verified on {initial.companyName}&rsquo;s org chart.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-bold" style={{ color: '#F4F4F7' }}>What&rsquo;s off? Fill in whatever needs correcting:</p>
          <input style={FSI} value={correctTitle} onChange={e => setCorrectTitle(e.target.value)} placeholder={`Correct title (we have: ${initial.seatTitle})`} />
          <input style={FSI} value={correctTeam} onChange={e => setCorrectTeam(e.target.value)} placeholder={`Correct team${initial.teamName ? ` (we have: ${initial.teamName})` : ''}`} />
          <input style={FSI} value={correctManager} onChange={e => setCorrectManager(e.target.value)} placeholder="Correct manager" />
          <textarea style={{ ...FSI, resize: 'vertical' }} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Anything else? (optional)" />
          <button
            onClick={() => respond('dispute')}
            disabled={submitting || !(correctTitle.trim() || correctTeam.trim() || correctManager.trim() || note.trim())}
            className="w-full py-4 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)', color: '#fff' }}
          >
            {submitting ? 'Sending…' : 'Send corrections →'}
          </button>
          <button
            onClick={() => setDisputing(false)}
            disabled={submitting}
            className="w-full py-3 rounded-full font-bold text-xs"
            style={{ color: '#7E7E8E' }}
          >
            ← Back
          </button>
        </div>
      )}
    </Shell>
  )
}
