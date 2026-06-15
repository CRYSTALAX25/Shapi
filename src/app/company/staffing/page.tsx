'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SpinePrefillBanner, { useSpinePrefill } from '@/components/SpinePrefillBanner'

type Recommendation = {
  id: string
  kind: string | null
  title: string | null
  rationale: string | null
  urgency: string | null
  variance_driver: string | null
  sources: string | null
  status: string | null
  created_at: string
}

const KIND_COLOR: Record<string, string> = {
  hire: '#38BDF8',          // blue
  reskill: '#38BDF8',        // pink
  freeze: '#FB7185',         // light pink / high-risk
  redeploy: '#FB7185',       // light pink / high-risk
  restructure: '#FBBF24',    // amber
}

const KIND_LABEL: Record<string, string> = {
  hire: 'Hire',
  reskill: 'Reskill',
  freeze: 'Freeze',
  redeploy: 'Redeploy',
  restructure: 'Restructure',
}

const URGENCY_COLOR: Record<string, string> = {
  'now': '#FB7185',
  'this quarter': '#FBBF24',
  'next 6 months': '#38BDF8',
}

export default function AutonomousStaffingPage() {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [teamComposition, setTeamComposition] = useState('')

  // Spine pre-fill — same team-composition summary as the Hiring Roadmap.
  // Saves the user from re-typing what's already in roles_seats.
  const { spine, applied: spineApplied, apply: applySpine } = useSpinePrefill()
  const handleApplySpine = () => {
    if (!spine || spine.roles.length === 0) { applySpine(); return }
    const summary = spine.roles
      .map(r => {
        const n = Number(r.count)
        const noun = n === 1 ? r.role : `${r.role}s`
        return `${r.count} ${noun}${r.dept ? ` · ${r.dept}` : ''}`
      })
      .join(', ')
    setTeamComposition(summary)
    applySpine()
  }

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/company/staffing-recommendations', { cache: 'no-store' })
      const raw = await res.text()
      let d: { success?: boolean; recommendations?: Recommendation[]; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr(`Server error (${res.status}) — try refreshing.`)
        return
      }
      if (!res.ok) {
        setErr(d.error || 'Could not load recommendations.')
        return
      }
      setRecs(Array.isArray(d.recommendations) ? d.recommendations : [])
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generate = async () => {
    setGenerating(true)
    setErr('')
    try {
      const res = await fetch('/api/company/staffing-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_composition: teamComposition.trim() || undefined }),
      })
      const raw = await res.text()
      let d: { success?: boolean; recommendations?: Recommendation[]; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr((res.status === 504 || /timeout|gateway/i.test(raw))
          ? 'Generation took too long — tap again, it usually works on the second try.'
          : `Server error (${res.status}) — try again in a moment.`)
        return
      }
      if (!res.ok || !d.recommendations) {
        setErr(d.error || 'Could not generate recommendations. Try again.')
        return
      }
      // Merge fresh recs in front of existing ones (the GET sort is server-side).
      // Reload from server so urgency ordering stays consistent.
      await load()
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setGenerating(false)
    }
  }

  const updateStatus = async (id: string, status: 'acted' | 'dismissed') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/company/staffing-recommendations/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const raw = await res.text()
      let d: { success?: boolean; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr(`Server error (${res.status}) — try again.`)
        return
      }
      if (!res.ok) {
        setErr(d.error || 'Could not update — try again.')
        return
      }
      // Optimistically remove from list (we only show 'open' on this view).
      setRecs(prev => prev.filter(r => r.id !== id))
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setBusyId(null)
    }
  }

  const cardStyle = { background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider'

  return (
    <div className="min-h-screen bg-[#060609] text-[#F4F4F7]">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-5xl mx-auto">
        <Link
          href="/"
          className="font-black text-xl tracking-tighter"
          style={{
            background: 'linear-gradient(135deg, #38BDF8, #34D399)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          shapi
        </Link>
        <Link href="/company/dashboard" className="text-[#A6A6B4] text-sm hover:text-[#F4F4F7]">
          ← Dashboard
        </Link>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-20">
        <h1
          className="text-3xl md:text-4xl font-black tracking-tighter mb-2"
          style={{ color: '#FB7185' }}
        >
          Autonomous staffing
        </h1>
        <p className="text-[#A6A6B4] text-sm mb-6 max-w-2xl">
          Proactive recommendations from Shapi — what we&apos;d do next if we ran your team.
        </p>

        <SpinePrefillBanner
          spine={spine}
          applied={spineApplied}
          onApply={handleApplySpine}
          fieldsLabel="A team-composition summary from your seats"
        />

        {/* Generate fresh card — always visible at the top */}
        <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
          <p className="text-[#C7C7D1] text-sm mb-4 leading-relaxed">
            Tell us roughly who you already employ so the briefing references your real team. Or skip — we&apos;ll work from your industry, open roles, and Shapi&apos;s platform data.
          </p>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">
            Your team today (optional)
          </label>
          <textarea
            value={teamComposition}
            onChange={e => setTeamComposition(e.target.value)}
            placeholder="e.g. 5 engineers, 1 designer, 2 sales reps, 1 marketing lead, 1 ops manager"
            rows={3}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#38BDF8]/50 mb-4"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
          <p className="text-[#7E7E8E] text-[11px] mb-4">
            Roles + counts only — no names, no salaries. Better answers in, sharper briefing out.
          </p>
          <button
            onClick={generate}
            disabled={generating}
            className="px-6 py-3 rounded-full font-black text-sm text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}
          >
            {generating ? 'Generating…' : 'Generate fresh recommendations'}
          </button>
          {err && <p className="text-[#FB7185] text-xs mt-3">{err}</p>}
        </div>

        {/* Recommendations list */}
        {loading ? (
          <p className="text-[#7E7E8E] text-sm">Loading your briefing…</p>
        ) : recs.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={cardStyle}>
            <p className={`${labelCls} mb-2`}>No open recommendations</p>
            <p className="text-[#A6A6B4] text-sm">
              Tap <strong className="text-[#F4F4F7]">Generate fresh recommendations</strong> above to get a new briefing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recs.map(rec => {
              const kindKey = (rec.kind || '').toLowerCase()
              const kc = KIND_COLOR[kindKey] || '#A6A6B4'
              const kindLabel = KIND_LABEL[kindKey] || (rec.kind || 'Action')
              const urgencyKey = (rec.urgency || '').toLowerCase()
              const uc = URGENCY_COLOR[urgencyKey] || '#A6A6B4'
              const isBusy = busyId === rec.id
              return (
                <div
                  key={rec.id}
                  className="rounded-2xl p-5"
                  style={cardStyle}
                >
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                        style={{ background: `${kc}26`, color: kc }}
                      >
                        {kindLabel}
                      </span>
                      {rec.urgency && (
                        <span
                          className="text-[10px] font-black px-2.5 py-1 rounded-full"
                          style={{ background: `${uc}26`, color: uc }}
                        >
                          {rec.urgency}
                        </span>
                      )}
                    </div>
                  </div>

                  {rec.title && (
                    <p className="text-[#F4F4F7] font-bold text-base mb-2 leading-snug">{rec.title}</p>
                  )}
                  {rec.rationale && (
                    <p className="text-[#C7C7D1] text-sm leading-relaxed mb-3">{rec.rationale}</p>
                  )}

                  {rec.variance_driver && (
                    <p className="text-xs leading-relaxed mb-3">
                      <span className="text-[#7E7E8E] font-bold uppercase tracking-wider text-[10px]">Variance driver: </span>
                      <span className="text-[#A6A6B4]">{rec.variance_driver}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.06] flex-wrap">
                    <p className="text-[#7E7E8E] text-[10px] leading-relaxed">
                      {rec.sources ? (
                        <>Sources: <span className="text-[#A6A6B4]">{rec.sources}</span></>
                      ) : (
                        <span className="italic">Sources: Shapi platform synthesis</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateStatus(rec.id, 'acted')}
                        disabled={isBusy}
                        className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
                        style={{
                          background: 'rgba(52,211,153,0.12)',
                          color: '#34D399',
                          border: '1px solid rgba(52,211,153,0.25)',
                        }}
                      >
                        {isBusy ? '…' : 'Mark as acted'}
                      </button>
                      <button
                        onClick={() => updateStatus(rec.id, 'dismissed')}
                        disabled={isBusy}
                        className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          color: '#A6A6B4',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {isBusy ? '…' : 'Dismiss'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            <p className="text-[#7E7E8E] text-[10px] leading-relaxed pt-2">
              70%-confidence read. Variance drivers flagged per recommendation. Synthesised from Mercer salary data · Anthropic/OpenAI published API pricing · WEF Future of Jobs · Shapi platform data.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
