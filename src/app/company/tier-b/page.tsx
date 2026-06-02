'use client'

// Tier B — 5-year Workforce Plan engagement workspace.
// 4 wizard steps: operating model diagnostic → org DNA → workforce + AI plan
// → execution playbook. Each step persists to its jsonb column, appends to
// the audit trail, and advances `step`. Lock button finalises the deliverable.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import StepCard, { StepStatus } from './StepCard'

// ─────────────────────────────────────────────────────────────────────────────
// People Outlay Map types — mirrors the shape produced by
// /api/company/tier-b → map_people_outlay action (Claude extraction + the
// post-Claude candidate-pool augmentation pass).
// ─────────────────────────────────────────────────────────────────────────────
type MatchedCandidate = {
  id: string
  public_id: string
  full_name: string | null
  headline: string | null
  location: string | null
  verification_tier: string | null
  match_score: number
  match_reasons: string[]
}
type PeopleOutlayGap = {
  title?: string
  seniority?: string
  when?: string
  type?: 'new_hire' | 'reskill' | 'redeploy'
  why?: string
  must_have_skills?: string[]
  location_hint?: string
  headcount?: number
  time_to_fill_weeks?: string
  verified_candidates?: MatchedCandidate[]
  pool_match_count?: number
}

type Engagement = {
  id: string
  company_id: string
  step: number
  operating_model_diagnostic: Record<string, unknown> | null
  org_dna: Record<string, unknown> | null
  workforce_plan: Record<string, unknown> | null
  people_outlay: Record<string, unknown> | null
  execution_playbook: Record<string, unknown> | null
  audit_trail: Array<{ ts: string; who: string; what: string }> | null
  status: 'in_progress' | 'locked' | 'annual_refresh_due'
  created_at: string
  updated_at: string
}

const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }
const labelCls = 'text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider'

function stepStatus(engagement: Engagement | null, stepNum: number, columnFilled: boolean): StepStatus {
  if (!engagement) return 'not-started'
  if (columnFilled) return 'done'
  if (engagement.step === stepNum) return 'in-progress'
  return 'not-started'
}

export default function TierBWorkspace() {
  const [engagement, setEngagement] = useState<Engagement | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [savingStep, setSavingStep] = useState<number | null>(null)
  const [locking, setLocking] = useState(false)

  // Step 1 inputs
  const [orgDescription, setOrgDescription] = useState('')
  // Step 2 inputs
  const [cultureDescriptors, setCultureDescriptors] = useState('')
  const [leadershipDescriptors, setLeadershipDescriptors] = useState('')
  const [riskDescriptors, setRiskDescriptors] = useState('')

  // Defensive parse helper — mirrors the roadmap page pattern.
  const parseRes = async (res: Response) => {
    const raw = await res.text()
    try {
      return { ok: res.ok, data: JSON.parse(raw) as Record<string, unknown> }
    } catch {
      return {
        ok: false,
        data: {
          error: (res.status === 504 || /timeout|gateway/i.test(raw))
            ? 'That step took too long — tap again, usually works on retry.'
            : `Server error (${res.status}) — try again in a moment.`,
        },
      }
    }
  }

  // Initial load.
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/company/tier-b', { method: 'GET' })
        const { ok, data } = await parseRes(res)
        if (!alive) return
        if (!ok || !data.engagement) {
          setErr((data.error as string) || 'Could not load engagement.')
          return
        }
        setEngagement(data.engagement as Engagement)
      } catch {
        if (alive) setErr('Connection dropped — refresh the page.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const runStep = async (action: string, input: Record<string, unknown>, stepNum: number) => {
    setSavingStep(stepNum)
    setErr('')
    try {
      const res = await fetch('/api/company/tier-b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, input, advance: true }),
      })
      const { ok, data } = await parseRes(res)
      if (!ok || !data.engagement) {
        setErr((data.error as string) || 'Step failed — try again.')
        return
      }
      setEngagement(data.engagement as Engagement)
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setSavingStep(null)
    }
  }

  const lockEngagement = async () => {
    setLocking(true)
    setErr('')
    try {
      const res = await fetch('/api/company/tier-b', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'locked' }),
      })
      const { ok, data } = await parseRes(res)
      if (!ok || !data.engagement) {
        setErr((data.error as string) || 'Could not lock engagement.')
        return
      }
      setEngagement(data.engagement as Engagement)
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setLocking(false)
    }
  }

  const status1: StepStatus = stepStatus(engagement, 1, !!engagement?.operating_model_diagnostic)
  const status2: StepStatus = stepStatus(engagement, 2, !!engagement?.org_dna)
  const status3: StepStatus = stepStatus(engagement, 3, !!engagement?.workforce_plan)
  const status4: StepStatus = stepStatus(engagement, 4, !!engagement?.people_outlay)
  const status5: StepStatus = stepStatus(engagement, 5, !!engagement?.execution_playbook)
  const allDone = status1 === 'done' && status2 === 'done' && status3 === 'done' && status4 === 'done' && status5 === 'done'
  const isLocked = engagement?.status === 'locked'

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
            background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
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
          Strategic Workforce Plan
        </h1>
        <p className="text-[#A6A6B4] text-sm mb-6 max-w-2xl">
          Full engagement workspace — 1 / 3 / 5 / 10-year horizons. Operating-model diagnostic → org DNA → workforce + AI plan → execution playbook.
        </p>

        {loading && (
          <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
            <p className="text-[#A6A6B4] text-sm">Loading engagement…</p>
          </div>
        )}

        {!loading && engagement && (
          <>
            {/* Founder strategy session — prominent CTA at the top of the
                workspace. This is the "human insurance" that justifies the
                price (decided 2026-06-02 pricing session: every engagement
                ≥$5k includes 30 min of founder time so buyers feel
                "I talked to a person who built this", not "I bought a
                chatbot output"). One CTA, hard to miss, links to the
                existing /book-call form with the founder-session topic. */}
            <Link
              href={`/book-call?topic=founder-session&engagement=${engagement.id}`}
              className="block rounded-2xl p-4 mb-5 transition-opacity hover:opacity-95"
              style={{
                background: 'linear-gradient(135deg, rgba(106,168,245,0.14), rgba(240,140,174,0.10))',
                border: '1px solid rgba(240,140,174,0.40)',
              }}
            >
              <div className="flex items-center gap-3.5">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }}>👋</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#F08CAE' }}>Included with your engagement</p>
                  <p className="text-[#F4F4F7] font-black text-base mb-0.5">Your founder strategy session — 30 minutes with Ana</p>
                  <p className="text-[#A6A6B4] text-xs leading-relaxed">
                    Talk through your plan with the founder. Pressure-test the trickier calls, decide what to action first. Best run after Step 3 (the workforce plan).
                  </p>
                </div>
                <span className="flex-shrink-0 text-[#F08CAE] text-xs font-black whitespace-nowrap hidden sm:inline">Book session →</span>
              </div>
            </Link>

            <div className="rounded-2xl p-4 mb-5 flex items-center justify-between" style={cardStyle}>
              <div>
                <p className={`${labelCls} mb-1`}>Engagement status</p>
                <p className="text-[#F4F4F7] text-sm font-bold">
                  {isLocked ? 'Locked — final deliverable' : engagement.status === 'annual_refresh_due' ? 'Annual refresh due' : 'In progress'}
                  <span className="text-[#7E7E8E] font-normal"> · current step {engagement.step}/5</span>
                </p>
              </div>
              <p className="text-[#7E7E8E] text-[11px] text-right hidden sm:block">
                Started {new Date(engagement.created_at).toLocaleDateString()} · {engagement.audit_trail?.length || 0} log entries
              </p>
            </div>

            <div className="space-y-4">
              {/* ── Step 1: Operating Model Diagnostic ────────────────────── */}
              <StepCard
                step={1}
                title="Operating model diagnostic"
                subtitle="Per business unit — current model, target state in 3-5 years, transition path, misalignments."
                status={status1}
                onSave={isLocked ? undefined : () => runStep('diagnose_operating_model', { org_description: orgDescription }, 1)}
                saveLabel={engagement.operating_model_diagnostic ? 'Re-run diagnostic' : 'Run diagnostic'}
                saving={savingStep === 1}
                defaultOpen={status1 !== 'done'}
              >
                <label className={`${labelCls} block mb-2`}>Describe your org (BUs, reporting lines, decision rights)</label>
                <textarea
                  value={orgDescription}
                  onChange={e => setOrgDescription(e.target.value)}
                  placeholder="e.g. 4 BUs: Product (40 ppl, squad-based), Sales (12 ppl, geo-split EMEA/APAC), Ops (8 ppl, centralised), G&A (6 ppl). CEO + COO + 4 BU heads. Decisions flow through weekly exec."
                  rows={4}
                  disabled={isLocked}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                />

                {engagement.operating_model_diagnostic && (
                  <DiagnosticOutput data={engagement.operating_model_diagnostic} />
                )}
              </StepCard>

              {/* ── Step 2: Org DNA ─────────────────────────────────────── */}
              <StepCard
                step={2}
                title="Org DNA"
                subtitle="Culture, leadership style, risk tolerance, innovation appetite, collaboration maturity."
                status={status2}
                onSave={isLocked ? undefined : () => runStep('map_org_dna', {
                  culture_descriptors: cultureDescriptors,
                  leadership_descriptors: leadershipDescriptors,
                  risk_descriptors: riskDescriptors,
                }, 2)}
                saveLabel={engagement.org_dna ? 'Re-map DNA' : 'Map DNA'}
                saving={savingStep === 2}
                defaultOpen={status1 === 'done' && status2 !== 'done'}
              >
                <label className={`${labelCls} block mb-2`}>Culture — how people actually behave day-to-day</label>
                <textarea
                  value={cultureDescriptors}
                  onChange={e => setCultureDescriptors(e.target.value)}
                  placeholder="e.g. Move fast, ship in public, low ceremony, async-first, manager-light."
                  rows={3}
                  disabled={isLocked}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                />

                <label className={`${labelCls} block mb-2 mt-3`}>Leadership style</label>
                <textarea
                  value={leadershipDescriptors}
                  onChange={e => setLeadershipDescriptors(e.target.value)}
                  placeholder="e.g. Founder-led, two co-CEOs, weekly all-hands, decisions written up in docs."
                  rows={2}
                  disabled={isLocked}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                />

                <label className={`${labelCls} block mb-2 mt-3`}>Risk tolerance + innovation appetite</label>
                <textarea
                  value={riskDescriptors}
                  onChange={e => setRiskDescriptors(e.target.value)}
                  placeholder="e.g. Comfortable shipping unfinished things to learn; conservative on hiring above market; bullish on AI tools, cautious on AI agents in customer flow."
                  rows={2}
                  disabled={isLocked}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                />

                {engagement.org_dna && <DnaOutput data={engagement.org_dna} />}
              </StepCard>

              {/* ── Step 3: Workforce + AI plan ─────────────────────────── */}
              <StepCard
                step={3}
                title="5-year workforce + AI plan"
                subtitle="Y1 / Y3 / Y5 scenarios, cost trajectory, Replace / Augment / Reskill / Redeploy / Protect counts."
                status={status3}
                onSave={isLocked ? undefined : () => runStep('plan_workforce', {}, 3)}
                saveLabel={engagement.workforce_plan ? 'Re-run plan' : 'Build plan'}
                saving={savingStep === 3}
                defaultOpen={status2 === 'done' && status3 !== 'done'}
              >
                <p className="text-[#A6A6B4] text-xs leading-relaxed">
                  Combines the operating-model diagnostic + org DNA + your latest Workforce Snapshot (if on file) to produce the Strategic Workforce Plan. No extra inputs needed.
                </p>
                {engagement.workforce_plan && <WorkforcePlanOutput data={engagement.workforce_plan} />}
              </StepCard>

              {/* ── Step 4: People Outlay Map (the consultant-killer) ────── */}
              <StepCard
                step={4}
                title="People Outlay Map"
                subtitle="Specific role gaps from the plan, matched to verified candidates already in Shapi's pool. The bit no consultant can do."
                status={status4}
                onSave={isLocked ? undefined : () => runStep('map_people_outlay', {}, 4)}
                saveLabel={engagement.people_outlay ? 'Re-run map' : 'Build the map'}
                saving={savingStep === 4}
                defaultOpen={status3 === 'done' && status4 !== 'done'}
              >
                <p className="text-[#A6A6B4] text-xs leading-relaxed">
                  Extracts the concrete role gaps from the workforce plan and matches each one against Shapi&apos;s verified candidate pool — top 5 candidates per gap with match score, verification tier, and click-through to their profile.
                </p>
                {engagement.people_outlay && <PeopleOutlayOutput data={engagement.people_outlay} />}
              </StepCard>

              {/* ── Step 5: Execution playbook ──────────────────────────── */}
              <StepCard
                step={5}
                title="Execution playbook"
                subtitle="Comms drafts, compliance checklist, outplacement plan, hiring plan, 90-day milestones."
                status={status5}
                onSave={isLocked ? undefined : () => runStep('generate_playbook', {}, 5)}
                saveLabel={engagement.execution_playbook ? 'Re-generate playbook' : 'Generate playbook'}
                saving={savingStep === 5}
                defaultOpen={status4 === 'done' && status5 !== 'done'}
              >
                <p className="text-[#A6A6B4] text-xs leading-relaxed">
                  Turns the approved Strategic Workforce Plan + People Outlay Map into Monday-morning deliverables — drafts, compliance, named hiring plan, milestones.
                </p>
                {engagement.execution_playbook && <PlaybookOutput data={engagement.execution_playbook} />}
              </StepCard>
            </div>

            {/* Lock button — final deliverable */}
            <div className="mt-6 rounded-2xl p-5 flex items-center justify-between" style={cardStyle}>
              <div className="flex-1 min-w-0">
                <p className="text-[#F4F4F7] font-bold text-sm mb-1">
                  {isLocked ? 'Engagement is locked.' : allDone ? 'All four steps complete.' : 'Finish all four steps to lock the engagement.'}
                </p>
                <p className="text-[#7E7E8E] text-xs leading-relaxed">
                  {isLocked
                    ? 'A locked engagement is the signed-off final deliverable. Unlock by status change if scope shifts.'
                    : 'Locking freezes this version of the deliverable. Annual refresh re-opens the workspace.'}
                </p>
              </div>
              <button
                onClick={lockEngagement}
                disabled={!allDone || isLocked || locking}
                className="ml-4 px-5 py-2.5 rounded-full font-black text-xs text-white disabled:opacity-40 whitespace-nowrap"
                style={{ background: isLocked ? 'rgba(52,211,153,0.18)' : 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', color: isLocked ? '#34D399' : 'white' }}
              >
                {isLocked ? 'Locked' : locking ? 'Locking…' : 'Lock engagement'}
              </button>
            </div>

            {err && <p className="text-[#F58E9A] text-xs mt-4">{err}</p>}

            <p className="text-[#7E7E8E] text-[10px] leading-relaxed mt-6">
              Sources: <span className="text-[#A6A6B4]">Mercer compensation benchmarks · Glassdoor public ratings · Anthropic/OpenAI published API pricing · BLS/government labour statistics · Shapi platform data.</span> Figures are 70%-confidence bands; named variance drivers in-text.
            </p>
          </>
        )}

        {!loading && !engagement && err && (
          <div className="rounded-2xl p-6" style={cardStyle}>
            <p className="text-[#F58E9A] text-sm">{err}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight output renderers (kept inline to keep the workspace self-contained)
// ─────────────────────────────────────────────────────────────────────────────

function DiagnosticOutput({ data }: { data: Record<string, unknown> }) {
  const perBU = Array.isArray(data.perBU) ? (data.perBU as Array<Record<string, string>>) : []
  const misalignments = Array.isArray(data.misalignments) ? (data.misalignments as Array<Record<string, string>>) : []
  return (
    <div className="mt-4 space-y-3">
      <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider">Per-BU read</p>
      {perBU.map((b, i) => (
        <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[#F4F4F7] font-bold text-sm">{b.bu}</p>
          <p className="text-[#C7C7D1] text-xs mt-1"><span className="text-[#7E7E8E]">Current:</span> {b.model}</p>
          <p className="text-[#C7C7D1] text-xs"><span className="text-[#7E7E8E]">Target:</span> {b.target_model}</p>
          {b.why && <p className="text-[#A6A6B4] text-xs mt-1 leading-relaxed">{b.why}</p>}
          {b.transition_path && <p className="text-[#A6A6B4] text-xs mt-1 leading-relaxed"><span className="text-[#7E7E8E] font-bold">Path: </span>{b.transition_path}</p>}
          {b.confidence_band && <p className="text-[#FBBF24] text-[10px] mt-1">Confidence: {b.confidence_band}</p>}
        </div>
      ))}
      {misalignments.length > 0 && (
        <>
          <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mt-3">Misalignments</p>
          {misalignments.map((m, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}>
              <p className="text-[#F4F4F7] font-bold text-xs">{m.issue}</p>
              <p className="text-[#A6A6B4] text-xs mt-1"><span className="text-[#7E7E8E]">Impact:</span> {m.impact}</p>
              <p className="text-[#A6A6B4] text-xs"><span className="text-[#7E7E8E]">Fix:</span> {m.fix}</p>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function DnaOutput({ data }: { data: Record<string, unknown> }) {
  const dims = ['culture', 'leadership_style', 'risk_tolerance', 'innovation_appetite', 'collaboration_maturity'] as const
  return (
    <div className="mt-4 space-y-2">
      {data.headline_archetype && (
        <p className="text-[#F08CAE] text-sm font-bold mb-2">{String(data.headline_archetype)}</p>
      )}
      {dims.map(k => {
        const d = (data[k] as Record<string, unknown> | undefined) || {}
        const score = Number(d.score ?? 0)
        return (
          <div key={k} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[#F4F4F7] font-bold text-xs uppercase tracking-wider">{k.replace(/_/g, ' ')}</p>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(106,168,245,0.15)', color: '#6AA8F5' }}>{score}/10</span>
            </div>
            <p className="text-[#C7C7D1] text-xs leading-relaxed">{String(d.summary || '')}</p>
            {Boolean(d.workforce_implication) && (
              <p className="text-[#A6A6B4] text-xs mt-1"><span className="text-[#7E7E8E] font-bold">For workforce: </span>{String(d.workforce_implication)}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WorkforcePlanOutput({ data }: { data: Record<string, unknown> }) {
  const horizons = ['y1', 'y3', 'y5'] as const
  return (
    <div className="mt-4 space-y-3">
      {data.headline_call && (
        <p className="text-[#F08CAE] text-sm font-bold">{String(data.headline_call)}</p>
      )}
      {horizons.map(h => {
        const block = (data[h] as Record<string, unknown> | undefined) || {}
        const scenarios = Array.isArray(block.scenarios) ? (block.scenarios as Array<Record<string, unknown>>) : []
        const counts = (block.counts as Record<string, number> | undefined) || {}
        return (
          <div key={h} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[#F4F4F7] font-bold text-xs uppercase tracking-wider mb-2">Year {h.replace('y', '')}</p>
            <p className="text-[#A6A6B4] text-xs mb-2"><span className="text-[#7E7E8E] font-bold">Cost: </span>{String(block.cost_trajectory || '—')}</p>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {(['replace', 'augment', 'reskill', 'redeploy', 'protect'] as const).map(k => (
                <div key={k} className="rounded-md p-1.5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-[#7E7E8E] text-[9px] uppercase">{k}</p>
                  <p className="text-[#F4F4F7] font-black text-sm">{counts[k] ?? 0}</p>
                </div>
              ))}
            </div>
            {scenarios.map((s, i) => (
              <div key={i} className="mt-2 pl-2 border-l-2" style={{ borderColor: '#6AA8F5' }}>
                <p className="text-[#C7C7D1] text-xs font-bold">{String(s.name || '—')} · {String(s.headline || '')}</p>
                <p className="text-[#A6A6B4] text-[11px] mt-0.5">Δ headcount: {String(s.headcount_delta || '—')}</p>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// People Outlay Map renderer — the consultant-killer view. Each role gap is
// a card; below each gap the matched verified candidates from the pool. Empty
// state when the pool is thin (early launch reality) teaches what will appear.
// ─────────────────────────────────────────────────────────────────────────────
function PeopleOutlayOutput({ data }: { data: Record<string, unknown> }) {
  const headline = String(data.headline || '')
  const gaps = (Array.isArray(data.role_gaps) ? (data.role_gaps as PeopleOutlayGap[]) : [])
  const summary = (data.outlay_summary as Record<string, number> | undefined) || {}

  const tierColour = (t: string | null | undefined) => {
    if (t === 'premium') return { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24', label: 'Premium' }
    if (t === 'strong') return { bg: 'rgba(52,211,153,0.15)', fg: '#34D399', label: 'Strong' }
    if (t === 'basic') return { bg: 'rgba(106,168,245,0.15)', fg: '#6AA8F5', label: 'Verified' }
    return { bg: 'rgba(255,255,255,0.06)', fg: '#A6A6B4', label: 'Unverified' }
  }

  const typeChip = (t: string | undefined) => {
    if (t === 'new_hire') return { bg: 'rgba(240,140,174,0.14)', fg: '#F08CAE', label: 'New hire' }
    if (t === 'reskill') return { bg: 'rgba(251,191,36,0.14)', fg: '#FBBF24', label: 'Reskill' }
    if (t === 'redeploy') return { bg: 'rgba(106,168,245,0.14)', fg: '#6AA8F5', label: 'Redeploy' }
    return { bg: 'rgba(255,255,255,0.05)', fg: '#A6A6B4', label: t || 'role' }
  }

  return (
    <div className="mt-4 space-y-3">
      {headline && (
        <p className="text-[#F08CAE] text-sm font-bold">{headline}</p>
      )}

      {/* Summary band — at-a-glance moat signal */}
      {summary.total_role_gaps !== undefined && (
        <div className="rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Stat label="Role gaps" value={String(summary.total_role_gaps)} />
          <Stat label="With matches" value={`${summary.gaps_with_matches ?? 0}/${summary.total_role_gaps}`} highlight />
          <Stat label="Candidates surfaced" value={String(summary.total_candidates_matched ?? 0)} />
          <Stat label="Avg match score" value={`${summary.average_match_score ?? 0}%`} />
        </div>
      )}

      {gaps.map((g, i) => {
        const type = typeChip(g.type)
        const candidates = g.verified_candidates || []
        return (
          <div key={i} className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-[#F4F4F7] font-black text-sm">{g.title}{g.headcount && g.headcount > 1 ? ` ×${g.headcount}` : ''}</p>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider" style={{ background: type.bg, color: type.fg }}>{type.label}</span>
                </div>
                <p className="text-[#7E7E8E] text-[11px]">
                  {g.seniority || ''} · {g.when || ''}{g.location_hint ? ` · ${g.location_hint}` : ''}
                </p>
              </div>
              {g.time_to_fill_weeks && (
                <p className="text-[#34D399] text-[10px] font-bold whitespace-nowrap">⏱ {g.time_to_fill_weeks}</p>
              )}
            </div>

            {g.why && <p className="text-[#A6A6B4] text-xs leading-relaxed mb-2">{g.why}</p>}

            {Array.isArray(g.must_have_skills) && g.must_have_skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {g.must_have_skills.slice(0, 6).map((s, j) => (
                  <span key={j} className="text-[9px] font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(106,168,245,0.10)', color: '#6AA8F5' }}>{s}</span>
                ))}
              </div>
            )}

            {/* Matched candidates */}
            {candidates.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#A6A6B4] mb-2">
                  ✦ {candidates.length} verified candidate{candidates.length === 1 ? '' : 's'} from the Shapi pool
                </p>
                <div className="space-y-1.5">
                  {candidates.map((c) => {
                    const tier = tierColour(c.verification_tier)
                    return (
                      <Link
                        key={c.id}
                        href={`/p/${c.public_id}`}
                        target="_blank"
                        className="block rounded-lg p-2.5 hover:bg-white/[0.03] transition-colors"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[#F4F4F7] text-xs font-bold truncate">{c.full_name || 'Verified candidate'}</p>
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: tier.bg, color: tier.fg }}>{tier.label}</span>
                            </div>
                            {c.headline && <p className="text-[#7E7E8E] text-[10px] truncate">{c.headline}{c.location ? ` · ${c.location}` : ''}</p>}
                            {Array.isArray(c.match_reasons) && c.match_reasons.length > 0 && (
                              <p className="text-[#A6A6B4] text-[10px] mt-0.5 truncate">{c.match_reasons.slice(0, 2).join(' · ')}</p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-[#6AA8F5] font-black text-sm">{c.match_score}<span className="text-[9px]">%</span></p>
                            <p className="text-[#7E7E8E] text-[9px]">match</p>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1.5">✦ Verified candidates in the Shapi pool</p>
                <p className="text-[#7E7E8E] text-xs leading-relaxed italic">
                  No matched verified candidates for this gap yet — the pool will surface them as Shapi onboards more verified candidates in <strong className="text-[#A6A6B4] not-italic">{g.location_hint || 'this region'}</strong>. The execution playbook below will still produce a hiring plan we can run for you.
                </p>
              </div>
            )}
          </div>
        )
      })}

      {gaps.length === 0 && (
        <p className="text-[#7E7E8E] text-xs italic">
          The People Outlay Map turns the workforce plan&apos;s headcount counts into specific role gaps, then matches each against the verified candidate pool. Run the workforce plan first (Step 3), then re-run this step.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[#7E7E8E] text-[9px] font-bold uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`font-black text-base ${highlight ? '' : 'text-[#F4F4F7]'}`} style={highlight ? { color: '#34D399' } : undefined}>{value}</p>
    </div>
  )
}

function PlaybookOutput({ data }: { data: Record<string, unknown> }) {
  const comms = (data.comms_drafts as Record<string, string> | undefined) || {}
  const compliance = Array.isArray(data.compliance_notes) ? (data.compliance_notes as Array<Record<string, string>>) : []
  const outplacement = (data.outplacement_plan as Record<string, unknown> | undefined) || {}
  const hiring = (data.hiring_plan as Record<string, unknown> | undefined) || {}
  const milestones = Array.isArray(data.milestones) ? (data.milestones as Array<Record<string, unknown>>) : []
  return (
    <div className="mt-4 space-y-3">
      {comms.all_hands_intro && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-1">All-hands intro</p>
          <p className="text-[#C7C7D1] text-xs leading-relaxed whitespace-pre-wrap">{comms.all_hands_intro}</p>
        </div>
      )}
      {comms.manager_brief && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-1">Manager brief</p>
          <p className="text-[#C7C7D1] text-xs leading-relaxed whitespace-pre-wrap">{comms.manager_brief}</p>
        </div>
      )}
      {comms.exiting_staff_template && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-1">Exiting-staff template</p>
          <p className="text-[#C7C7D1] text-xs leading-relaxed whitespace-pre-wrap">{comms.exiting_staff_template}</p>
        </div>
      )}
      {compliance.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <p className="text-[#FBBF24] text-[10px] font-bold uppercase tracking-wider mb-2">Compliance</p>
          {compliance.map((c, i) => (
            <p key={i} className="text-[#C7C7D1] text-xs leading-relaxed mb-1">
              <span className="text-[#FBBF24] font-bold">{c.jurisdiction}: </span>{c.requirement} — <span className="text-[#A6A6B4]">{c.action}</span>
            </p>
          ))}
        </div>
      )}
      {Object.keys(outplacement).length > 0 && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-1">Outplacement</p>
          {Array.isArray(outplacement.tiered_support) && (outplacement.tiered_support as string[]).map((t, i) => (
            <p key={i} className="text-[#C7C7D1] text-xs">• {t}</p>
          ))}
          {outplacement.estimated_cost_band && (
            <p className="text-[#34D399] text-xs mt-1 font-bold">Cost band: {String(outplacement.estimated_cost_band)}</p>
          )}
        </div>
      )}
      {Object.keys(hiring).length > 0 && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-1">Hiring plan</p>
          {Array.isArray(hiring.q1_q2_roles) && (
            <p className="text-[#C7C7D1] text-xs">Q1-Q2 roles: {(hiring.q1_q2_roles as string[]).join(', ')}</p>
          )}
          {Array.isArray(hiring.channels) && (
            <p className="text-[#A6A6B4] text-xs mt-1">Channels: {(hiring.channels as string[]).join(', ')}</p>
          )}
          {hiring.interview_loop && (
            <p className="text-[#A6A6B4] text-xs mt-1">Loop: {String(hiring.interview_loop)}</p>
          )}
        </div>
      )}
      {milestones.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <p className="text-[#34D399] text-[10px] font-bold uppercase tracking-wider mb-2">90-day milestones</p>
          {milestones.map((m, i) => (
            <p key={i} className="text-[#C7C7D1] text-xs mb-0.5">
              <span className="text-[#34D399] font-black">Day {String(m.day || '—')}: </span>{String(m.milestone || '')}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
