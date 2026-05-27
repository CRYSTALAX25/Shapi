'use client'

import { useState } from 'react'
import Link from 'next/link'

type TeamRow = {
  name: string
  headcount: string
  manager_span: string
  weekly_meeting_hours: string
  recent_changes: string
  on_call: boolean
  ai_tool_adoption: 'low' | 'medium' | 'high' | ''
  scope: string
}

type LoadTeam = {
  name: string
  load_score: number
  verdict: 'sustainable' | 'stretched' | 'overloaded' | string
  drivers: string[]
  relief_actions: string[]
  hire_or_redistribute?: 'hire' | 'redistribute' | 'adopt_ai' | null
}

type Load = {
  summary: string
  teams: LoadTeam[]
  org_wide_recommendation: string
  sources: string
}

const VERDICT_COLOR: Record<string, string> = {
  sustainable: '#34D399',
  stretched: '#FBBF24',
  overloaded: '#FB7185',
}

const HIRE_TAG_COLOR: Record<string, string> = {
  hire: '#A78BFA',
  redistribute: '#6AA8F5',
  adopt_ai: '#22D3EE',
}

const HIRE_TAG_LABEL: Record<string, string> = {
  hire: 'Hire',
  redistribute: 'Redistribute',
  adopt_ai: 'Adopt AI',
}

function emptyRow(): TeamRow {
  return {
    name: '',
    headcount: '',
    manager_span: '',
    weekly_meeting_hours: '',
    recent_changes: '',
    on_call: false,
    ai_tool_adoption: '',
    scope: '',
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return '#FB7185'
  if (score >= 50) return '#FBBF24'
  return '#34D399'
}

export default function CompanyCognitiveLoad() {
  const [rows, setRows] = useState<TeamRow[]>([emptyRow()])
  const [context, setContext] = useState('')
  const [load, setLoad] = useState<Load | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const update = (i: number, patch: Partial<TeamRow>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  const addRow = () => setRows(prev => [...prev, emptyRow()])
  const removeRow = (i: number) => setRows(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i))

  const submit = async () => {
    setLoading(true)
    setErr('')
    try {
      const teams = rows
        .filter(r => r.name.trim() && Number(r.headcount) > 0)
        .map(r => ({
          name: r.name.trim(),
          headcount: Number(r.headcount),
          manager_span: r.manager_span ? Number(r.manager_span) : undefined,
          weekly_meeting_hours: r.weekly_meeting_hours ? Number(r.weekly_meeting_hours) : undefined,
          recent_changes: r.recent_changes.trim() || undefined,
          on_call: r.on_call,
          ai_tool_adoption: r.ai_tool_adoption || undefined,
          scope: r.scope.trim() || undefined,
        }))

      if (teams.length === 0) {
        setErr('Add at least one team with a name and headcount.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/company/cognitive-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams, context: context.trim() || undefined }),
      })
      // Defensive parsing — a 504 returns HTML, not JSON.
      const raw = await res.text()
      let d: { success?: boolean; load?: Load; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr((res.status === 504 || /timeout|gateway/i.test(raw))
          ? 'The read took too long — tap again, it usually works on the second try.'
          : `Server error (${res.status}) — try again in a moment.`)
        return
      }
      if (!res.ok || !d.load) {
        setErr(d.error || 'Could not run the load check. Try again.')
        return
      }
      setLoad(d.load)
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider'
  const inputCls = 'w-full rounded-lg px-3 py-2 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50'
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
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
            background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
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
          Cognitive load check
        </h1>
        <p className="text-[#A6A6B4] text-sm mb-6 max-w-2xl">
          Tell us about your teams — we&apos;ll flag who&apos;s overloaded and what to do about it.
        </p>

        {!load && (
          <div className="space-y-5">
            <div className="space-y-4">
              {rows.map((row, i) => (
                <div key={i} className="rounded-2xl p-5" style={cardStyle}>
                  <div className="flex items-center justify-between mb-4">
                    <p className={labelCls}>Team {i + 1}</p>
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(i)}
                        className="text-[#7E7E8E] text-xs hover:text-[#FB7185]"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className={`${labelCls} block mb-1.5`}>Team name</label>
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => update(i, { name: e.target.value })}
                        placeholder="e.g. Backend platform"
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={`${labelCls} block mb-1.5`}>Headcount</label>
                      <input
                        type="number"
                        min={1}
                        value={row.headcount}
                        onChange={e => update(i, { headcount: e.target.value })}
                        placeholder="e.g. 8"
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={`${labelCls} block mb-1.5`}>Manager span (direct reports)</label>
                      <input
                        type="number"
                        min={0}
                        value={row.manager_span}
                        onChange={e => update(i, { manager_span: e.target.value })}
                        placeholder="e.g. 7"
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={`${labelCls} block mb-1.5`}>Weekly meeting hours / person</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={row.weekly_meeting_hours}
                        onChange={e => update(i, { weekly_meeting_hours: e.target.value })}
                        placeholder="e.g. 12"
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className={`${labelCls} block mb-1.5`}>Scope (1 line)</label>
                    <input
                      type="text"
                      value={row.scope}
                      onChange={e => update(i, { scope: e.target.value })}
                      placeholder="What this team owns — e.g. payments + billing infra"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>

                  <div className="mb-3">
                    <label className={`${labelCls} block mb-1.5`}>Recent changes (last 2 quarters)</label>
                    <textarea
                      value={row.recent_changes}
                      onChange={e => update(i, { recent_changes: e.target.value })}
                      placeholder="e.g. lost 2 people in Q3, took on a major new client"
                      rows={2}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`${labelCls} block mb-1.5`}>On-call rotation?</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.on_call}
                          onChange={e => update(i, { on_call: e.target.checked })}
                          className="w-4 h-4 accent-[#6AA8F5]"
                        />
                        <span className="text-[#C7C7D1] text-sm">Yes, this team carries on-call</span>
                      </label>
                    </div>
                    <div>
                      <label className={`${labelCls} block mb-1.5`}>AI tool adoption</label>
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map(level => {
                          const active = row.ai_tool_adoption === level
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => update(i, { ai_tool_adoption: active ? '' : level })}
                              className="text-xs font-bold px-3 py-1.5 rounded-full capitalize"
                              style={active
                                ? { background: 'rgba(34,211,238,0.18)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.35)' }
                                : { background: 'rgba(255,255,255,0.04)', color: '#A6A6B4', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                              {level}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addRow}
              className="text-xs font-bold px-4 py-2 rounded-full"
              style={{
                background: 'rgba(106,168,245,0.12)',
                color: '#6AA8F5',
                border: '1px solid rgba(106,168,245,0.25)',
              }}
            >
              + Add team
            </button>

            <div className="rounded-2xl p-5" style={cardStyle}>
              <label className={`${labelCls} block mb-2`}>Anything else worth knowing (optional)</label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="e.g. fundraise next quarter, hiring freeze in effect, founder still in every standup"
                rows={3}
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={submit}
                disabled={loading}
                className="px-6 py-3 rounded-full font-black text-sm text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #22D3EE, #A78BFA)' }}
              >
                {loading ? 'Reading the load…' : 'Run cognitive load check'}
              </button>
              {err && <p className="text-[#FB7185] text-xs">{err}</p>}
            </div>
          </div>
        )}

        {load && (
          <div className="space-y-5">
            {/* Org-wide recommendation banner */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'linear-gradient(135deg, rgba(251,113,133,0.10), rgba(167,139,250,0.10))',
                border: '1px solid rgba(251,113,133,0.25)',
              }}
            >
              <p className={`${labelCls} mb-2`}>Do this first</p>
              <p className="text-[#F4F4F7] font-bold text-base leading-relaxed mb-2">
                {load.org_wide_recommendation || '—'}
              </p>
              {load.summary && (
                <p className="text-[#A6A6B4] text-sm leading-relaxed">{load.summary}</p>
              )}
            </div>

            {/* Team cards */}
            <div className="space-y-4">
              {load.teams.map((t, i) => {
                const sc = scoreColor(t.load_score)
                const vc = VERDICT_COLOR[t.verdict] || '#A6A6B4'
                return (
                  <div key={i} className="rounded-2xl p-5" style={cardStyle}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-[#F4F4F7] font-bold text-base mb-1">{t.name || '—'}</p>
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: `${vc}26`, color: vc }}
                        >
                          {t.verdict}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-0.5">Load</p>
                        <p className="font-black text-3xl tracking-tighter" style={{ color: sc }}>
                          {t.load_score}
                        </p>
                      </div>
                    </div>

                    {t.drivers.length > 0 && (
                      <div className="mb-3">
                        <p className={`${labelCls} mb-1.5`}>Drivers</p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.drivers.map((d, j) => (
                            <span
                              key={j}
                              className="text-[11px] px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(255,255,255,0.05)', color: '#C7C7D1', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {t.relief_actions.length > 0 && (
                      <div className="mb-3">
                        <p className={`${labelCls} mb-1.5`}>Relief actions</p>
                        <ul className="space-y-1 pl-3">
                          {t.relief_actions.map((a, j) => (
                            <li key={j} className="text-[#C7C7D1] text-sm leading-relaxed list-disc">{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {t.hire_or_redistribute && (
                      <span
                        className="inline-block text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                        style={{
                          background: `${HIRE_TAG_COLOR[t.hire_or_redistribute]}20`,
                          color: HIRE_TAG_COLOR[t.hire_or_redistribute],
                          border: `1px solid ${HIRE_TAG_COLOR[t.hire_or_redistribute]}40`,
                        }}
                      >
                        Highest leverage: {HIRE_TAG_LABEL[t.hire_or_redistribute]}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-[#7E7E8E] text-[11px]">
                70%-confidence read; variance drivers flagged in-text.
              </p>
              <button
                onClick={() => { setLoad(null); setErr('') }}
                className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(34,211,238,0.12)',
                  color: '#22D3EE',
                  border: '1px solid rgba(34,211,238,0.25)',
                }}
              >
                Edit teams & re-run
              </button>
            </div>
            <p className="text-[#7E7E8E] text-[10px] leading-relaxed">
              Sources: <span className="text-[#A6A6B4]">{load.sources}</span>
            </p>
            {err && <p className="text-[#FB7185] text-xs">{err}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
