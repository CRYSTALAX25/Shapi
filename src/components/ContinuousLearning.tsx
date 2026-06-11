'use client'

// Two-half Continuous Learning section:
//   HALF 1 (everyone): passive — what they've already done (certs, events, talks, OSS, courses)
//   HALF 2 (Pro only): active — Shapi's personalised Career Roadmap (AI resilience + upskill + pivots)

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { courseSearchUrl } from '@/lib/upskill'

// A first-step often maps to a Shapi feature: a course step → /upskill, a
// role-targeting step → /roles. Return a contextual link only when it fits
// (no forced/dead links on self-tasks like "build a case study").
function stepLink(action: string): { href: string; label: string } | null {
  const a = action.toLowerCase()
  if (/\b(course|courses|certificate|certification|cert|coursera|udemy|edx|deeplearning|learn|upskill|training|bootcamp)\b/.test(a)) {
    return { href: '/course-wallet', label: 'find courses →' }
  }
  if (/\b(role|roles|job|jobs|apply|applying|application|position|positions|target|targeting|vacanc)\b/.test(a)) {
    return { href: '/roles', label: 'see roles →' }
  }
  return null
}

type Cert = { name?: string; issuer?: string; year?: string }
type Event = { name?: string; year?: string; role?: string }
type Talk = { venue?: string; year?: string; title?: string }
type Oss = { repo_url?: string; role?: string; stars?: number }
type Course = { name?: string; platform?: string; year?: string; completed?: boolean }

export type ContinuousLearningData = {
  certifications?: Cert[]
  events?: Event[]
  talks?: Talk[]
  oss?: Oss[]
  courses?: Course[]
}

type SkillGap = { skill: string; priority: 'high' | 'medium' | 'low'; why: string; suggested_courses?: Array<{ name: string; platform: string }> }
type PivotPath = {
  to_role: string
  to_industry: string
  why: string
  transferable_skills: string[]
  gaps_to_close: string[]
  first_actions: string[]
}
type EventRec = { name: string; when: string; where: string; why: string; priority: 'high' | 'medium' | 'low'; official_url?: string | null }
type ShieldGrowth = { title: string; why: string; uplift?: string }
type Roadmap = {
  ai_resilience_score: number
  resilience_reasoning: string
  track?: 'pivot' | 'shield' | 'cross-collar'
  collar?: 'white' | 'blue' | 'mixed'
  verified_human_skills?: string[]
  shield_growth?: ShieldGrowth[]
  skills_gaps: SkillGap[]
  pivot_paths: PivotPath[]
  events_to_attend: EventRec[]
  generated_at?: string
}

export default function ContinuousLearning({
  data,
  roadmap,
  isPro,
  resilienceScore,
  view = 'all',
}: {
  data: ContinuousLearningData | null
  roadmap: Roadmap | null
  isPro: boolean
  resilienceScore: number | null
  // 'career' = resilience + pivot roles; 'learning' = courses done + advised;
  // 'events' = recommended events; 'all' = everything
  view?: 'all' | 'career' | 'learning' | 'events'
}) {
  const showLearning = view === 'all' || view === 'learning'
  const showCareer = view === 'all' || view === 'career'
  const showEvents = view === 'all' || view === 'events'
  const [generating, setGenerating] = useState(false)
  const [localRoadmap, setLocalRoadmap] = useState<Roadmap | null>(roadmap)
  const [error, setError] = useState('')
  // Tracked courses (from /upskill) with verification status — shown on profile
  type TrackedCourse = { id: string; course_name: string; platform: string | null; status: string; verification_status: string; credential_url: string | null; sponsored_by?: string | null }
  const [trackedCourses, setTrackedCourses] = useState<TrackedCourse[]>([])
  // Per-event tracked status (booked/attended/not_attended), keyed by lowercased event name.
  const [eventState, setEventState] = useState<Record<string, { status: string; event_url: string | null }>>({})
  // Events the candidate added themselves (attended, with optional proof photo).
  type CustomEvent = { name: string; when?: string | null; where?: string | null; photo_url?: string | null }
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([])
  const [addEventOpen, setAddEventOpen] = useState(false)

  // Load tracked courses + event statuses + self-added events so the profile reflects them inline.
  const loadUpskill = () => {
    fetch('/api/upskill')
      .then(r => r.json())
      .then(d => {
        setTrackedCourses(Array.isArray(d.courses) ? d.courses : [])
        const evMap: Record<string, { status: string; event_url: string | null }> = {}
        ;(Array.isArray(d.events) ? d.events : []).forEach((e: { name?: string; status?: string; event_url?: string | null }) => {
          if (e.name) evMap[e.name.toLowerCase()] = { status: e.status || 'interested', event_url: e.event_url ?? null }
        })
        setEventState(evMap)
        setCustomEvents(Array.isArray(d.custom_events) ? d.custom_events : [])
      })
      .catch(() => {})
  }
  useEffect(() => { loadUpskill() }, [])

  const deleteCustomEvent = async (name: string) => {
    setCustomEvents(prev => prev.filter(e => e.name !== name))
    try {
      await fetch('/api/upskill/event', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_name: name }),
      })
    } catch {}
  }

  const updateEventStatus = async (e: EventRec, status: string) => {
    const key = e.name.toLowerCase()
    const event_url = eventState[key]?.event_url || e.official_url || null
    setEventState(prev => ({ ...prev, [key]: { status, event_url } }))
    try {
      await fetch('/api/upskill/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_name: e.name, event_when: e.when, event_where: e.where, event_url, status }),
      })
    } catch {}
  }

  const generateRoadmap = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/career/roadmap', { method: 'POST' })
      // Parse defensively — a Vercel timeout / gateway error returns an HTML
      // page, not JSON, and res.json() would throw a misleading "Network error".
      const txt = await res.text()
      let d: { success?: boolean; roadmap?: Roadmap; error?: string }
      try {
        d = JSON.parse(txt)
      } catch {
        if (res.status === 504 || /timeout|gateway/i.test(txt)) {
          setError('That took too long and timed out — tap Generate once more, it usually works on the second try.')
        } else {
          setError(`Server returned ${res.status}. Try again in a moment.`)
        }
        return
      }
      if (d.success && d.roadmap) {
        setLocalRoadmap(d.roadmap)
      } else {
        setError(d.error || 'Could not generate roadmap')
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setGenerating(false)
    }
  }

  const hasAny = (data?.certifications?.length || 0) + (data?.events?.length || 0)
    + (data?.talks?.length || 0) + (data?.oss?.length || 0) + (data?.courses?.length || 0) > 0

  const rm = localRoadmap

  // SHIELD = resilient trade/role: celebrate + level up within the trade, never "pivot out".
  // Trust the model's explicit track; fall back to the score (>=7 = AI-proof) if absent.
  const effectiveScore = rm?.ai_resilience_score ?? resilienceScore
  const isShield = rm?.track === 'shield' || (rm?.track == null && (effectiveScore ?? 0) >= 7)

  const resilienceColor = (score: number | null) => {
    if (score === null) return { color: '#A6A6B4', label: '—', bg: 'rgba(255,255,255,0.05)' }
    if (score >= 7) return { color: '#9D8CFF', label: 'Low risk', bg: 'rgba(157, 140, 255, 0.10)' }
    if (score >= 4) return { color: '#9D8CFF', label: 'Medium risk', bg: 'rgba(157, 140, 255, 0.10)' }
    return { color: '#FB7185', label: 'High risk', bg: 'rgba(251, 113, 133, 0.10)' }
  }
  // Use the freshest score available: a just-generated roadmap's score (rm)
  // overrides the (possibly stale/null) prop from the last page load, so the
  // colour + risk label match the number shown after the first generation.
  const r = resilienceColor(effectiveScore ?? null)

  const priorityChip = (p: string) => {
    const map: Record<string, { color: string; bg: string }> = {
      high: { color: '#FB7185', bg: 'rgba(251, 113, 133, 0.12)' },
      medium: { color: '#9D8CFF', bg: 'rgba(157, 140, 255, 0.10)' },
      low: { color: '#A6A6B4', bg: 'rgba(255,255,255,0.05)' },
    }
    const c = map[p] || map.low
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ color: c.color, background: c.bg }}>{p}</span>
  }

  // "What you've already done" — certs, courses, talks, OSS, past events.
  // Inline for the combined view; collapsed at the bottom for the Learning view, so the
  // candidate's profile leads with what to improve, not a recap of what they already know.
  const passiveContent = (
    <>
      {!hasAny && trackedCourses.length === 0 && (
        <p className="text-[#7E7E8E] text-sm mb-2">No certifications, events, talks, OSS, or courses detected on your CV yet. Add them via your profile to strengthen credibility.</p>
      )}
      {trackedCourses.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Courses & Learning</p>
            <Link href="/course-wallet" className="text-[#9D8CFF] text-xs font-bold hover:underline">Manage →</Link>
          </div>
          <div className="space-y-1.5">
            {trackedCourses.map(c => {
              const verified = c.verification_status === 'verified'
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 bg-white/[0.05] rounded-lg px-3 py-2">
                  <span className="text-[#F4F4F7] text-xs">
                    {c.course_name}{c.platform ? <span className="text-[#7E7E8E]"> · {c.platform}</span> : null}
                    {c.status === 'completed' ? <span className="text-[#7E7E8E]"> · done</span> : c.status === 'in_progress' ? <span className="text-[#7E7E8E]"> · in progress</span> : null}
                  </span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {c.sponsored_by && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.15)', color: '#9D8CFF' }}>🏢 {c.sponsored_by}</span>}
                    {verified
                      ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.15)', color: '#9D8CFF' }}>✓ Verified</span>
                      : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#A6A6B4' }}>○ Self-reported</span>}
                    {c.credential_url && <a href={c.credential_url} target="_blank" rel="noopener noreferrer" className="text-[#9D8CFF] text-[10px] font-bold">cert ↗</a>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {(data?.certifications?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-2">Certifications</p>
          <div className="flex flex-wrap gap-2">
            {data!.certifications!.map((c, i) => (
              <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.12)', color: '#9D8CFF', border: '1px solid rgba(157, 140, 255, 0.15)' }}>
                🎖 {c.name}{c.issuer ? ` · ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {(data?.events?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-2">Events attended</p>
          <div className="flex flex-wrap gap-2">
            {data!.events!.map((e, i) => (
              <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.12)', color: '#9D8CFF', border: '1px solid rgba(157, 140, 255, 0.15)' }}>
                {e.role === 'speaker' ? '🎤' : e.role === 'organizer' ? '🎟' : '📍'} {e.name}{e.year ? ` (${e.year})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {(data?.talks?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-2">Talks given</p>
          {data!.talks!.map((t, i) => (
            <p key={i} className="text-[#C7C7D1] text-sm mb-1">🎤 <strong>{t.title}</strong> · {t.venue}{t.year ? ` (${t.year})` : ''}</p>
          ))}
        </div>
      )}
      {(data?.courses?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-2">Courses</p>
          <div className="flex flex-wrap gap-2">
            {data!.courses!.map((c, i) => (
              <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#C7C7D1' }}>
                📚 {c.name}{c.platform ? ` · ${c.platform}` : ''}{c.year ? ` (${c.year})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {(data?.oss?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-2">Open source</p>
          {data!.oss!.map((o, i) => (
            <p key={i} className="text-[#C7C7D1] text-sm">💻 <a href={o.repo_url} target="_blank" rel="noreferrer" className="text-[#9D8CFF] hover:underline">{o.repo_url}</a>{o.role ? ` · ${o.role}` : ''}{o.stars ? ` · ⭐ ${o.stars}` : ''}</p>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="gradient-border-card rounded-2xl p-6">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#9D8CFF, #34D399)' }} />
          <h2 className="text-[#F4F4F7] font-black text-xl tracking-tight">{view === 'career' ? 'Career roadmap' : view === 'learning' ? 'Learning' : view === 'events' ? 'Events' : 'Continuous Learning'}</h2>
        </div>
        {isPro && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.12)', color: '#9D8CFF' }}>Pro ✓</span>
        )}
      </div>
      <p className="text-[#7E7E8E] text-xs mb-5 ml-4">{view === 'career' ? 'Where you’re headed — resilience and pivot paths.' : view === 'learning' ? 'Sharpen your current field — and learn for your pivot.' : view === 'events' ? 'Industry events worth attending.' : 'What you’ve done — and where to grow next.'}</p>

      {/* ─── HALF 1: "what you've done" — inline only for the combined view.
           In the dedicated Learning view it moves to a collapsed section at the bottom. ─── */}
      {view === 'all' && passiveContent}

      {/* ─── HALF 2: CAREER ROADMAP (Pro only) ─── */}
      <div className={view === 'all' ? 'mt-8 pt-6 border-t border-white/[0.08]' : ''}>
        {!isPro && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(157, 140, 255, 0.10)', border: '1px solid rgba(157, 140, 255, 0.2)' }}>
            <p className="text-[#9D8CFF] text-xs font-bold uppercase tracking-wider mb-2">🔒 Career Roadmap — Pro feature</p>
            <p className="text-[#C7C7D1] text-sm mb-1">Get a personalised AI-resilience score for your current role + 3-5 skills to learn next + 2-3 pivot paths + relevant events to attend.</p>
            <p className="text-[#7E7E8E] text-xs mb-4">Built from your work history, AI-displacement trends, and your target industries.</p>
            <Link href="/pay" className="inline-block px-5 py-2.5 rounded-full font-black text-sm" style={{ background: 'linear-gradient(135deg,#9D8CFF, #34D399)', color: '#fff' }}>
              Upgrade to Pro →
            </Link>
          </div>
        )}

        {isPro && !rm && (
          <div>
            <p className="text-[#A6A6B4] text-sm mb-3">Generate your personalised Career Roadmap — Shapi analyses your work history + AI-displacement trends to recommend exactly what to learn next.</p>
            <button onClick={generateRoadmap} disabled={generating} className="px-5 py-2.5 rounded-full font-black text-sm transition-opacity disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#9D8CFF, #34D399)', color: '#fff' }}>
              {generating ? 'Generating…' : '✨ Generate my roadmap'}
            </button>
            {error && <p className="text-[#FB7185] text-xs mt-3">{error}</p>}
          </div>
        )}

        {isPro && rm && (
          <div>
            {/* AI Resilience Score — Career */}
            {showCareer && (
            <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl" style={{ background: r.bg, border: `1px solid ${r.color}33` }}>
              <div className="text-4xl font-black" style={{ color: r.color }}>{effectiveScore ?? rm.ai_resilience_score}</div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: r.color }}>AI resilience · {r.label}</p>
                <p className="text-[#A6A6B4] text-xs leading-relaxed mt-1">{rm.resilience_reasoning}</p>
              </div>
            </div>
            )}

            {/* SHIELD — AI-proof trade. Lead with celebration, then "grow your earning power". */}
            {showCareer && isShield && (
              <div className="mb-6 p-5 rounded-2xl" style={{ background: 'rgba(157, 140, 255, 0.10)', border: '1px solid rgba(157, 140, 255, 0.25)' }}>
                <p className="text-[#9D8CFF] text-xs font-bold uppercase tracking-wider mb-1">🛡️ AI-Proof — your trade is the backbone</p>
                <p className="text-[#C7C7D1] text-sm leading-relaxed">Your work needs hands, judgement, and presence — the things AI can’t replace. You’re not pivoting out; you’re levelling up. Here’s how to grow your earning power within your field.</p>
              </div>
            )}

            {/* What AI can't replace — verified human strengths (all tracks) */}
            {showCareer && (rm.verified_human_skills?.length ?? 0) > 0 && (
              <div className="mb-6">
                <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-2">🤝 What AI can’t replace</p>
                <div className="flex flex-wrap gap-2">
                  {rm.verified_human_skills!.map((s, i) => (
                    <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.12)', color: '#9D8CFF', border: '1px solid rgba(157, 140, 255, 0.15)' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Grow your earning power — shield level-up moves (shield track only) */}
            {showCareer && isShield && (rm.shield_growth?.length ?? 0) > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#9D8CFF, #34D399)' }} />
                  <h3 className="text-[#F4F4F7] text-base font-black">💪 Grow your earning power</h3>
                </div>
                <div className="space-y-2.5">
                  {rm.shield_growth!.map((g, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-[#F4F4F7] font-bold text-sm">{g.title}</p>
                        {g.uplift && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(157, 140, 255, 0.15)', color: '#9D8CFF' }}>{g.uplift}</span>}
                      </div>
                      <p className="text-[#A6A6B4] text-xs leading-relaxed">{g.why}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills gaps — Learning */}
            {showLearning && rm.skills_gaps?.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#9D8CFF, #9D8CFF)' }} />
                    <h3 className="text-[#F4F4F7] text-base font-black">🎯 Sharpen your current field</h3>
                  </div>
                  <Link href="/course-wallet" className="text-[#9D8CFF] text-xs font-bold hover:underline flex-shrink-0">Browse courses →</Link>
                </div>
                <p className="text-[#7E7E8E] text-xs mb-3">Skills that strengthen the experience you already have.</p>
                <div className="space-y-2">
                  {rm.skills_gaps.map((g, i) => (
                    <details key={i} className="group rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <summary className="flex items-center justify-between cursor-pointer list-none p-3">
                        <div className="flex items-center gap-2">
                          <p className="text-[#F4F4F7] font-bold text-sm">{g.skill}</p>
                          {priorityChip(g.priority)}
                        </div>
                        <span className="text-[#7E7E8E] text-xs transition-transform group-open:rotate-180">▾</span>
                      </summary>
                      <div className="px-3 pb-3">
                        <p className="text-[#A6A6B4] text-xs mb-2">{g.why}</p>
                        {(() => {
                          const recs = (g.suggested_courses && g.suggested_courses.length > 0)
                            ? g.suggested_courses
                            : [{ name: g.skill, platform: 'Coursera' }]
                          return (
                            <>
                              <p className="text-[#9D8CFF] text-[10px] font-bold uppercase tracking-wider mb-1.5">⭐ Shapi recommends</p>
                              <div className="space-y-1.5 mb-2">
                                {recs.map((c, j) => (
                                  <a key={j} href={courseSearchUrl(c.platform, c.name)} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors hover:opacity-90" style={{ background: 'rgba(157, 140, 255, 0.10)' }}>
                                    <span className="text-[#F4F4F7] text-xs font-bold">{c.name}{c.platform ? <span className="text-[#7E7E8E] font-normal"> · {c.platform}</span> : null}</span>
                                    <span className="text-[#9D8CFF] text-xs font-bold flex-shrink-0">Open ↗</span>
                                  </a>
                                ))}
                              </div>
                            </>
                          )
                        })()}
                        <Link href={`/course-wallet?skill=${encodeURIComponent(g.skill)}#financing`} className="text-[#9D8CFF] text-xs font-bold hover:underline">
                          More courses · free / paid / financing →
                        </Link>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {/* Learn for your pivot — Learning */}
            {showLearning && rm.pivot_paths?.some(p => p.gaps_to_close?.length > 0) && (
              <div className="mb-6">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#9D8CFF, #34D399)' }} />
                    <h3 className="text-[#F4F4F7] text-base font-black">↗️ Learn for your pivot</h3>
                  </div>
                  <Link href="/course-wallet" className="text-[#9D8CFF] text-xs font-bold hover:underline flex-shrink-0">Browse courses →</Link>
                </div>
                <p className="text-[#7E7E8E] text-xs mb-3 ml-3">What to learn to move into a new field.</p>
                <div className="space-y-2">
                  {rm.pivot_paths.filter(p => p.gaps_to_close?.length > 0).map((p, i) => (
                    <details key={i} className="group rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <summary className="flex items-center justify-between cursor-pointer list-none p-3">
                        <p className="text-[#F4F4F7] font-bold text-sm">To move into {p.to_role}{p.to_industry ? <span className="text-[#7E7E8E] font-normal"> · {p.to_industry}</span> : null}</p>
                        <span className="text-[#7E7E8E] text-xs transition-transform group-open:rotate-180">▾</span>
                      </summary>
                      <div className="px-3 pb-3">
                        <p className="text-[#9D8CFF] text-[10px] font-bold uppercase tracking-wider mb-1.5">⭐ Shapi recommends</p>
                        <div className="space-y-1.5 mb-2">
                          {p.gaps_to_close.map((g, j) => (
                            <a key={j} href={courseSearchUrl('Coursera', g)} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:opacity-90" style={{ background: 'rgba(157, 140, 255, 0.10)' }}>
                              <span className="text-[#F4F4F7] text-xs font-bold">{g}<span className="text-[#7E7E8E] font-normal"> · Coursera</span></span>
                              <span className="text-[#9D8CFF] text-xs font-bold flex-shrink-0">Open ↗</span>
                            </a>
                          ))}
                        </div>
                        <Link href={`/course-wallet?skill=${encodeURIComponent(p.gaps_to_close[0])}#financing`} className="text-[#9D8CFF] text-xs font-bold hover:underline">
                          More courses · free / paid / financing →
                        </Link>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {/* Pivot paths — Career. For shield trades these are OPTIONAL adjacent moves, not an exit. */}
            {showCareer && rm.pivot_paths?.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#9D8CFF, #34D399)' }} />
                  <h3 className="text-[#F4F4F7] text-base font-black">{isShield ? '🧭 Optional adjacent moves' : '↗️ Pivot paths to consider'}</h3>
                </div>
                {isShield && <p className="text-[#7E7E8E] text-xs mb-3 ml-3">Only if you ever fancy a change — your trade is solid as-is.</p>}
                {!isShield && <div className="mb-2" />}
                <div className="space-y-3">
                  {rm.pivot_paths.map((p, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-[#F4F4F7] font-bold text-sm mb-1">{p.to_role} <span className="text-[#7E7E8E] text-xs font-normal">· {p.to_industry}</span></p>
                      <p className="text-[#A6A6B4] text-xs mb-3 leading-relaxed">{p.why}</p>
                      <div className="text-xs">
                        <p className="text-[#9D8CFF] font-bold mb-1">✓ Transferable strengths</p>
                        <p className="text-[#A6A6B4]">{(p.transferable_skills ?? []).join(' · ')}</p>
                        {p.gaps_to_close?.length > 0 && <p className="text-[#7E7E8E] text-[10px] mt-2">What to learn for this pivot → <Link href="/profile?tab=Learning" className="font-bold text-[#9D8CFF] hover:underline">open the Learning tab</Link>.</p>}
                      </div>
                      {p.first_actions?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/[0.08]">
                          <p className="text-[#9D8CFF] text-xs font-bold mb-1">First steps</p>
                          <ol className="text-[#A6A6B4] text-xs space-y-1.5 list-decimal list-inside">
                            {p.first_actions.map((a, j) => {
                              const link = stepLink(a)
                              return (
                                <li key={j}>
                                  {a}
                                  {link && <Link href={link.href} className="text-[#9D8CFF] font-bold hover:underline ml-1.5 whitespace-nowrap">{link.label}</Link>}
                                </li>
                              )
                            })}
                          </ol>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events to attend — buy tickets + track status inline (no detour to /upskill) */}
            {showEvents && rm.events_to_attend?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#9D8CFF, #34D399)' }} />
                  <h3 className="text-[#F4F4F7] text-base font-black">📅 Recommended events</h3>
                </div>
                <p className="text-[#7E7E8E] text-xs mb-2 ml-3">Buy tickets, then mark whether you purchased + attended.</p>
                {rm.events_to_attend.map((e, i) => {
                  const key = e.name.toLowerCase()
                  const cur = eventState[key]?.status || 'interested'
                  const ticketUrl = e.official_url || eventState[key]?.event_url || `https://www.google.com/search?q=${encodeURIComponent(`${e.name} ${e.where || ''} tickets`)}`
                  const opts = [
                    { key: 'booked', label: '🎟 Purchased', on: 'rgba(157, 140, 255, 0.15)', onText: '#9D8CFF' },
                    { key: 'attended', label: '✓ Attended', on: 'rgba(157, 140, 255, 0.15)', onText: '#9D8CFF' },
                    { key: 'not_attended', label: 'Didn’t attend', on: 'rgba(255,255,255,0.08)', onText: '#A6A6B4' },
                  ]
                  return (
                    <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[#F4F4F7] font-bold text-sm">{e.name}</p>
                        {priorityChip(e.priority)}
                      </div>
                      <p className="text-[#A6A6B4] text-xs">{[e.when, e.where].filter(Boolean).join(' · ')}</p>
                      {e.why && <p className="text-[#7E7E8E] text-[11px] mt-1 leading-relaxed">{e.why}</p>}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-black px-3 py-1.5 rounded-full" style={{ background: 'linear-gradient(135deg,#9D8CFF, #34D399)', color: '#fff' }}>Buy tickets ↗</a>
                        {opts.map(opt => {
                          const active = cur === opt.key
                          return (
                            <button key={opt.key} onClick={() => updateEventStatus(e, active ? 'interested' : opt.key)}
                              className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-colors"
                              style={{
                                background: active ? opt.on : 'rgba(255,255,255,0.05)',
                                color: active ? opt.onText : '#7E7E8E',
                                border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                              }}>
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {showEvents && !rm.events_to_attend?.length && (
              <p className="text-[#7E7E8E] text-sm">No events recommended yet — generate your roadmap to get tailored event suggestions.</p>
            )}

            <button onClick={generateRoadmap} disabled={generating} className="mt-4 text-xs text-[#7E7E8E] hover:text-[#C7C7D1] transition-colors">
              {generating ? 'Regenerating…' : '↻ Regenerate roadmap'}
            </button>
          </div>
        )}
      </div>

      {/* Events view: events the candidate attended (with proof photos) — for everyone, Pro or not */}
      {showEvents && (
        <div className={view === 'events' ? 'mt-6' : 'mt-6 pt-6 border-t border-white/[0.08]'}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#9D8CFF, #9D8CFF)' }} />
              <h3 className="text-[#F4F4F7] text-base font-black">📸 Events you’ve attended</h3>
            </div>
            <button onClick={() => setAddEventOpen(o => !o)} className="text-[#9D8CFF] text-xs font-bold hover:underline">{addEventOpen ? 'Close' : '+ Add an event'}</button>
          </div>
          {addEventOpen && <AddAttendedEvent onDone={() => { setAddEventOpen(false); loadUpskill() }} />}
          {customEvents.length > 0 ? (
            <div className="space-y-2">
              {customEvents.map((ev, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {ev.photo_url && <img src={ev.photo_url} alt={ev.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[#F4F4F7] font-bold text-sm truncate">{ev.name}</p>
                    {(ev.when || ev.where) && <p className="text-[#A6A6B4] text-xs">{[ev.when, ev.where].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(157, 140, 255, 0.15)', color: '#9D8CFF' }}>✓ Attended</span>
                  <button onClick={() => deleteCustomEvent(ev.name)} className="text-[#7E7E8E] hover:text-[#FB7185] text-xs flex-shrink-0" aria-label="Remove">✕</button>
                </div>
              ))}
            </div>
          ) : !addEventOpen && (
            <p className="text-[#7E7E8E] text-xs">Add conferences, meetups or talks you’ve attended — with a photo of you there as proof.</p>
          )}
        </div>
      )}

      {/* Learning view: "what you've done" lives here, collapsed — focus stays on what to improve */}
      {view === 'learning' && (
        <details className="group mt-6 pt-6 border-t border-white/[0.08]">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <span className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">What you’ve already done</span>
            <span className="text-[#7E7E8E] text-xs transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-4">{passiveContent}</div>
        </details>
      )}
    </div>
  )
}

// Form to log an event the candidate personally attended, with an optional proof
// photo (uploaded to the public event-photos bucket, then saved as a custom event).
function AddAttendedEvent({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [where, setWhere] = useState('')
  const [when, setWhen] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const inputCls = 'w-full rounded-lg px-3 py-2 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#9D8CFF]/40'
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true); setErr('')
    try {
      let photo_url: string | null = null
      if (file) {
        const fd = new FormData(); fd.append('file', file)
        const up = await fetch('/api/upskill/event/photo', { method: 'POST', body: fd })
        const ud = await up.json().catch(() => ({}))
        if (!up.ok) { setErr(ud.error || 'Photo upload failed'); setSaving(false); return }
        photo_url = ud.url
      }
      const res = await fetch('/api/upskill/event', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_name: name.trim(), event_when: when.trim(), event_where: where.trim(), status: 'attended', is_custom: true, photo_url }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || 'Could not save'); setSaving(false); return }
      onDone()
    } catch {
      setErr('Something went wrong — try again'); setSaving(false)
    }
  }

  return (
    <div className="rounded-xl p-4 mb-3 space-y-3" style={inputStyle}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Event name (e.g. GITEX Global 2026)" className={inputCls} style={inputStyle} />
      <div className="grid grid-cols-2 gap-2">
        <input value={where} onChange={e => setWhere(e.target.value)} placeholder="Where (Dubai)" className={inputCls} style={inputStyle} />
        <input value={when} onChange={e => setWhen(e.target.value)} placeholder="When (May 2026)" className={inputCls} style={inputStyle} />
      </div>
      <div>
        <p className="text-[#A6A6B4] text-xs font-bold mb-1">Photo of you there (optional — adds proof)</p>
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-[#A6A6B4] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#9D8CFF]/15 file:text-[#9D8CFF]" />
      </div>
      {err && <p className="text-[#FB7185] text-xs">{err}</p>}
      <button onClick={submit} disabled={saving || !name.trim()} className="w-full py-2.5 rounded-lg font-black text-sm disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#9D8CFF, #34D399)', color: '#fff' }}>
        {saving ? 'Saving…' : 'Add attended event'}
      </button>
    </div>
  )
}
