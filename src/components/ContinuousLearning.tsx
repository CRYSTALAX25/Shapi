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
    return { href: '/upskill', label: 'find courses →' }
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
type Roadmap = {
  ai_resilience_score: number
  resilience_reasoning: string
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
}: {
  data: ContinuousLearningData | null
  roadmap: Roadmap | null
  isPro: boolean
  resilienceScore: number | null
}) {
  const [generating, setGenerating] = useState(false)
  const [localRoadmap, setLocalRoadmap] = useState<Roadmap | null>(roadmap)
  const [error, setError] = useState('')
  // Tracked courses (from /upskill) with verification status — shown on profile
  type TrackedCourse = { id: string; course_name: string; platform: string | null; status: string; verification_status: string; credential_url: string | null; sponsored_by?: string | null }
  const [trackedCourses, setTrackedCourses] = useState<TrackedCourse[]>([])

  // Load tracked courses so the profile reflects verified learning.
  // (Event tracking lives on /upskill — single source — so we don't pull it here.)
  useEffect(() => {
    fetch('/api/upskill')
      .then(r => r.json())
      .then(d => {
        setTrackedCourses(Array.isArray(d.courses) ? d.courses : [])
      })
      .catch(() => {})
  }, [])

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

  const resilienceColor = (score: number | null) => {
    if (score === null) return { color: 'rgba(255,255,255,0.5)', label: '—', bg: 'rgba(255,255,255,0.04)' }
    if (score >= 7) return { color: '#34D399', label: 'Low risk', bg: 'rgba(52,211,153,0.10)' }
    if (score >= 4) return { color: '#FBBF24', label: 'Medium risk', bg: 'rgba(251,191,36,0.10)' }
    return { color: '#FB7185', label: 'High risk', bg: 'rgba(251,113,133,0.10)' }
  }
  const r = resilienceColor(resilienceScore)

  const priorityChip = (p: string) => {
    const map: Record<string, { color: string; bg: string }> = {
      high: { color: '#FB7185', bg: 'rgba(251,113,133,0.12)' },
      medium: { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
      low: { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)' },
    }
    const c = map[p] || map.low
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ color: c.color, background: c.bg }}>{p}</span>
  }

  return (
    <div className="gradient-border-card rounded-2xl p-6">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#22D3EE,#A78BFA)' }} />
          <h2 className="text-white font-black text-xl tracking-tight">Continuous Learning</h2>
        </div>
        {isPro && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.10)', color: '#A78BFA' }}>Pro ✓</span>
        )}
      </div>
      <p className="text-white/35 text-xs mb-5 ml-4">What you&apos;ve done — and where to grow next.</p>

      {/* ─── HALF 1: PASSIVE ─── */}
      {!hasAny && trackedCourses.length === 0 && (
        <p className="text-white/30 text-sm mb-6">No certifications, events, talks, OSS, or courses detected on your CV yet. Add them via your profile to strengthen credibility.</p>
      )}

      {/* Tracked courses from /upskill — with verification marks */}
      {trackedCourses.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/45 text-xs font-bold uppercase tracking-wider">Courses & Learning</p>
            <Link href="/upskill" className="text-[#22D3EE] text-xs font-bold hover:underline">Manage →</Link>
          </div>
          <div className="space-y-1.5">
            {trackedCourses.map(c => {
              const verified = c.verification_status === 'verified'
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                  <span className="text-white/80 text-xs">
                    {c.course_name}{c.platform ? <span className="text-white/35"> · {c.platform}</span> : null}
                    {c.status === 'completed' ? <span className="text-white/35"> · done</span> : c.status === 'in_progress' ? <span className="text-white/35"> · in progress</span> : null}
                  </span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {c.sponsored_by && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>🏢 {c.sponsored_by}</span>}
                    {verified
                      ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>✓ Verified</span>
                      : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>○ Self-reported</span>}
                    {c.credential_url && <a href={c.credential_url} target="_blank" rel="noopener noreferrer" className="text-[#22D3EE] text-[10px] font-bold">cert ↗</a>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(data?.certifications?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-white/45 text-xs font-bold uppercase tracking-wider mb-2">Certifications</p>
          <div className="flex flex-wrap gap-2">
            {data!.certifications!.map((c, i) => (
              <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(34,211,238,0.08)', color: '#67E8F9', border: '1px solid rgba(34,211,238,0.15)' }}>
                🎖 {c.name}{c.issuer ? ` · ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {(data?.events?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-white/45 text-xs font-bold uppercase tracking-wider mb-2">Events attended</p>
          <div className="flex flex-wrap gap-2">
            {data!.events!.map((e, i) => (
              <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(167,139,250,0.08)', color: '#C4B5FD', border: '1px solid rgba(167,139,250,0.15)' }}>
                {e.role === 'speaker' ? '🎤' : e.role === 'organizer' ? '🎟' : '📍'} {e.name}{e.year ? ` (${e.year})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {(data?.talks?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-white/45 text-xs font-bold uppercase tracking-wider mb-2">Talks given</p>
          {data!.talks!.map((t, i) => (
            <p key={i} className="text-white/60 text-sm mb-1">🎤 <strong>{t.title}</strong> · {t.venue}{t.year ? ` (${t.year})` : ''}</p>
          ))}
        </div>
      )}

      {(data?.courses?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-white/45 text-xs font-bold uppercase tracking-wider mb-2">Courses</p>
          <div className="flex flex-wrap gap-2">
            {data!.courses!.map((c, i) => (
              <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)' }}>
                📚 {c.name}{c.platform ? ` · ${c.platform}` : ''}{c.year ? ` (${c.year})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {(data?.oss?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-white/45 text-xs font-bold uppercase tracking-wider mb-2">Open source</p>
          {data!.oss!.map((o, i) => (
            <p key={i} className="text-white/60 text-sm">💻 <a href={o.repo_url} target="_blank" rel="noreferrer" className="text-[#22D3EE] hover:underline">{o.repo_url}</a>{o.role ? ` · ${o.role}` : ''}{o.stars ? ` · ⭐ ${o.stars}` : ''}</p>
          ))}
        </div>
      )}

      {/* ─── HALF 2: CAREER ROADMAP (Pro only) ─── */}
      <div className="mt-8 pt-6 border-t border-white/[0.08]">
        {!isPro && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <p className="text-[#A78BFA] text-xs font-bold uppercase tracking-wider mb-2">🔒 Career Roadmap — Pro feature</p>
            <p className="text-white/65 text-sm mb-1">Get a personalised AI-resilience score for your current role + 3-5 skills to learn next + 2-3 pivot paths + relevant events to attend.</p>
            <p className="text-white/35 text-xs mb-4">Built from your work history, AI-displacement trends, and your target industries.</p>
            <Link href="/pay" className="inline-block px-5 py-2.5 rounded-full font-black text-sm" style={{ background: 'linear-gradient(135deg,#A78BFA,#22D3EE)', color: '#060609' }}>
              Upgrade to Pro →
            </Link>
          </div>
        )}

        {isPro && !rm && (
          <div>
            <p className="text-white/55 text-sm mb-3">Generate your personalised Career Roadmap — Shapi analyses your work history + AI-displacement trends to recommend exactly what to learn next.</p>
            <button onClick={generateRoadmap} disabled={generating} className="px-5 py-2.5 rounded-full font-black text-sm transition-opacity disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#A78BFA,#22D3EE)', color: '#060609' }}>
              {generating ? 'Generating…' : '✨ Generate my roadmap'}
            </button>
            {error && <p className="text-[#FB7185] text-xs mt-3">{error}</p>}
          </div>
        )}

        {isPro && rm && (
          <div>
            {/* AI Resilience Score */}
            <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl" style={{ background: r.bg, border: `1px solid ${r.color}33` }}>
              <div className="text-4xl font-black" style={{ color: r.color }}>{resilienceScore ?? rm.ai_resilience_score}</div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: r.color }}>AI resilience · {r.label}</p>
                <p className="text-white/55 text-xs leading-relaxed mt-1">{rm.resilience_reasoning}</p>
              </div>
            </div>

            {/* Skills gaps */}
            {rm.skills_gaps?.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#22D3EE,#34D399)' }} />
                    <h3 className="text-white text-base font-black">🎯 Skills to learn next</h3>
                  </div>
                  <Link href="/upskill" className="text-[#22D3EE] text-xs font-bold hover:underline">Browse courses →</Link>
                </div>
                <div className="space-y-2">
                  {rm.skills_gaps.map((g, i) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white font-bold text-sm">{g.skill}</p>
                        {priorityChip(g.priority)}
                      </div>
                      <p className="text-white/40 text-xs mb-2">{g.why}</p>
                      {g.suggested_courses && g.suggested_courses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {g.suggested_courses.map((c, j) => (
                            <span key={j} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,211,238,0.06)', color: '#67E8F9' }}>{c.name} · {c.platform}</span>
                          ))}
                        </div>
                      )}
                      <Link href={`/upskill?skill=${encodeURIComponent(g.skill)}`} className="text-[#A78BFA] text-xs font-bold hover:underline">
                        Free / paid / financing options →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pivot paths */}
            {rm.pivot_paths?.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#A78BFA,#FB7185)' }} />
                  <h3 className="text-white text-base font-black">↗️ Pivot paths to consider</h3>
                </div>
                <div className="space-y-3">
                  {rm.pivot_paths.map((p, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
                      <p className="text-white font-bold text-sm mb-1">{p.to_role} <span className="text-white/35 text-xs font-normal">· {p.to_industry}</span></p>
                      <p className="text-white/55 text-xs mb-3 leading-relaxed">{p.why}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-emerald-400 font-bold mb-1">✓ Transferable</p>
                          <p className="text-white/55">{p.transferable_skills.join(' · ')}</p>
                        </div>
                        <div>
                          <p className="text-[#FBBF24] font-bold mb-1">⌛ Gaps to close</p>
                          <div className="flex flex-wrap gap-1.5">
                            {p.gaps_to_close.map((g, j) => (
                              <a key={j} href={courseSearchUrl('Coursera', g)} target="_blank" rel="noopener noreferrer"
                                className="text-white/65 hover:text-[#22D3EE] underline decoration-dotted underline-offset-2 transition-colors">
                                {g}
                              </a>
                            ))}
                          </div>
                          <p className="text-white/25 text-[10px] mt-1">tap a gap → courses for it ↗</p>
                        </div>
                      </div>
                      {p.first_actions?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06]">
                          <p className="text-[#22D3EE] text-xs font-bold mb-1">First steps</p>
                          <ol className="text-white/55 text-xs space-y-1.5 list-decimal list-inside">
                            {p.first_actions.map((a, j) => {
                              const link = stepLink(a)
                              return (
                                <li key={j}>
                                  {a}
                                  {link && <Link href={link.href} className="text-[#A78BFA] font-bold hover:underline ml-1.5 whitespace-nowrap">{link.label}</Link>}
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

            {/* Events to attend — full tracking lives on /upskill (single source).
                Here we just show a compact pointer so the roadmap stays clean. */}
            {rm.events_to_attend?.length > 0 && (
              <div className="mb-2 p-3 rounded-xl flex items-center justify-between gap-3" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <div>
                  <p className="text-white font-bold text-sm">📅 {rm.events_to_attend.length} events recommended for you</p>
                  <p className="text-white/40 text-xs mt-0.5">Find tickets + track Booked / Attended on Upskill.</p>
                </div>
                <Link href="/upskill" className="text-[#FBBF24] text-xs font-bold flex-shrink-0 hover:underline">Manage →</Link>
              </div>
            )}

            <button onClick={generateRoadmap} disabled={generating} className="mt-4 text-xs text-white/30 hover:text-white/60 transition-colors">
              {generating ? 'Regenerating…' : '↻ Regenerate roadmap'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
