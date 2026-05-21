'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { providersByTier, courseSearchUrl, FINANCING_OPTIONS } from '@/lib/upskill'

type SkillGap = { skill: string; priority?: string; why?: string; suggested_courses?: Array<{ name: string; platform?: string }> }
type RoadmapEvent = { name: string; when?: string; where?: string; why?: string; priority?: string; status?: string; official_url?: string | null }
type Course = {
  id: string
  skill: string | null
  course_name: string
  platform: string | null
  course_url: string | null
  tier: string
  status: string
  verification_status: string
  credential_url: string | null
  completed_at: string | null
  sponsored_by?: string | null
}

function UpskillContent() {
  const router = useRouter()
  const params = useSearchParams()
  const focusSkill = params.get('skill')

  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [gaps, setGaps] = useState<SkillGap[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [events, setEvents] = useState<RoadmapEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const load = () => {
    fetch('/api/upskill')
      .then(r => r.json())
      .then(d => {
        setIsPro(!!d.isPro)
        setGaps(d.skill_gaps || [])
        setCourses(d.courses || [])
        setEvents(d.events || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // Prefer the official event site (stable root domain); fall back to a search.
  const eventLink = (ev: RoadmapEvent) =>
    (ev.official_url && /^https?:\/\//i.test(ev.official_url))
      ? ev.official_url
      : `https://www.google.com/search?q=${encodeURIComponent(ev.name + ' ' + (ev.where || '') + ' official site')}`

  const setEventStatus = async (ev: RoadmapEvent, status: string) => {
    const event_url = eventLink(ev)
    // optimistic
    setEvents(prev => prev.map(e => e.name === ev.name ? { ...e, status } : e))
    await fetch('/api/upskill/event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: ev.name, event_when: ev.when, event_where: ev.where, event_url, status }),
    })
  }

  const trackCourse = async (payload: Record<string, unknown>) => {
    await fetch('/api/upskill/course', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    load()
  }
  const removeCourse = async (id: string) => {
    await fetch('/api/upskill/course', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-[#5A5A6E] text-sm">Loading…</div>
  }

  // If arrived via ?skill=X and X isn't already a roadmap gap, prepend a
  // synthetic gap so the link shows real course options for that exact skill.
  const focusInGaps = focusSkill && gaps.some(g => g.skill.toLowerCase() === focusSkill.toLowerCase())
  const displayGaps: SkillGap[] = focusSkill && !focusInGaps
    ? [{
        skill: focusSkill,
        why: 'A gap to close for your target pivot — here are courses for it.',
        // Synthesise a "Shapi recommends" pick so the link isn't a dead-end:
        // the exact skill on Coursera (strong, certificate-bearing platform).
        suggested_courses: [{ name: focusSkill, platform: 'Coursera' }],
      }, ...gaps]
    : gaps

  return (
    <div className="min-h-screen bg-white text-[#0E0E1A]">
      <style>{`
        .gradient-border-card { background: linear-gradient(#ffffff,#ffffff) padding-box, linear-gradient(135deg, rgba(34,211,238,0.12), rgba(139,92,246,0.12)) border-box; border: 1px solid transparent; box-shadow: 0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05); }
      `}</style>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-4 border-b border-[#0E0E1A]/[0.08] flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#A78BFA,#22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/profile" className="text-[#8A8A99] text-sm hover:text-[#3F3F4E]">Profile</Link>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-6">
          <h1 className="text-3xl font-black mb-2">Upskill</h1>
          <p className="text-[#5A5A6E] text-sm">Close the gaps from your Career Roadmap. Pick free, paid, or financed options — then verify what you complete so it counts on your profile.</p>
        </div>

        {/* Trust note */}
        <div className="gradient-border-card rounded-2xl p-4 mb-6">
          <p className="text-[#3F3F4E] text-xs leading-relaxed">
            <span className="text-[#059669] font-bold">✓ Verified</span> = you added a checkable certificate link, or completed it through Shapi · <span className="text-[#5A5A6E] font-bold">○ Self-reported</span> = your claim, not yet checked. Verified learning shows companies real, provable growth.
          </p>
        </div>

        {/* Skill gaps from roadmap. If arrived via ?skill=X (e.g. a pivot gap)
            and X isn't already a roadmap gap, prepend a synthetic card so the
            link lands on real course options for that exact gap. */}
        {displayGaps.length === 0 ? (
          <div className="gradient-border-card rounded-2xl p-8 text-center mb-6">
            <p className="text-[#5A5A6E] font-bold mb-1">No skill gaps yet</p>
            <p className="text-[#8A8A99] text-sm mb-4">Generate your Career Roadmap first — it identifies exactly what to learn next.</p>
            <Link href="/profile" className="inline-block px-5 py-2.5 rounded-full font-black text-sm" style={{ background: 'linear-gradient(135deg,#A78BFA,#22D3EE)', color: '#060609' }}>
              Go to Career Roadmap →
            </Link>
          </div>
        ) : (
          <div className="space-y-4 mb-8">
            {displayGaps.map((gap, i) => {
              const opts = providersByTier(gap.skill)
              const highlighted = focusSkill && gap.skill.toLowerCase() === focusSkill.toLowerCase()
              return (
                <div key={i} className="gradient-border-card rounded-2xl p-5" style={highlighted ? { borderColor: 'rgba(34,211,238,0.4)' } : undefined}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-black text-[#0E0E1A]">{gap.skill}</h3>
                    {gap.priority && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                        background: gap.priority === 'high' ? 'rgba(251,113,133,0.12)' : gap.priority === 'medium' ? 'rgba(251,191,36,0.12)' : 'rgba(14,14,26,0.04)',
                        color: gap.priority === 'high' ? '#E11D48' : gap.priority === 'medium' ? '#D97706' : '#5A5A6E',
                      }}>{gap.priority} priority</span>
                    )}
                  </div>
                  {gap.why && <p className="text-[#5A5A6E] text-xs mb-3">{gap.why}</p>}

                  {/* Shapi's specific recommendation — lands on the exact course via name search */}
                  {gap.suggested_courses && gap.suggested_courses.length > 0 && (
                    <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                      <p className="text-[#7C3AED] text-[10px] font-bold uppercase tracking-wider mb-2">⭐ Shapi recommends</p>
                      <div className="space-y-1.5">
                        {gap.suggested_courses.map((c, k) => (
                          <a key={k} href={courseSearchUrl(c.platform, c.name)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-between gap-2 bg-[#0E0E1A]/[0.04] hover:bg-[#0E0E1A]/[0.04] rounded-lg px-3 py-2 transition-colors">
                            <span className="text-[#0E0E1A] text-xs font-bold">{c.name}{c.platform ? <span className="text-[#5A5A6E] font-normal"> · {c.platform}</span> : null}</span>
                            <span className="text-[#7C3AED] text-xs font-bold flex-shrink-0">Open ↗</span>
                          </a>
                        ))}
                      </div>
                      <p className="text-[#8A8A99] text-[10px] mt-2">Different level or budget? Browse alternatives below.</p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Free */}
                    <div>
                      <p className="text-[#059669] text-[10px] font-bold uppercase tracking-wider mb-2">Free</p>
                      <div className="space-y-1.5">
                        {opts.free.map((o, j) => (
                          <a key={j} href={o.url} target="_blank" rel="noopener noreferrer"
                            className="block bg-[#0E0E1A]/[0.04] hover:bg-[#0E0E1A]/[0.04] rounded-lg px-3 py-2 transition-colors">
                            <span className="text-[#0E0E1A] text-xs font-bold">{o.name} ↗</span>
                            {o.note && <span className="block text-[#8A8A99] text-[10px] mt-0.5">{o.note}</span>}
                          </a>
                        ))}
                      </div>
                    </div>
                    {/* Paid */}
                    <div>
                      <p className="text-[#0891B2] text-[10px] font-bold uppercase tracking-wider mb-2">Paid (verifiable certificate)</p>
                      <div className="space-y-1.5">
                        {opts.paid.map((o, j) => (
                          <a key={j} href={o.url} target="_blank" rel="noopener noreferrer"
                            className="block bg-[#0E0E1A]/[0.04] hover:bg-[#0E0E1A]/[0.04] rounded-lg px-3 py-2 transition-colors">
                            <span className="text-[#0E0E1A] text-xs font-bold">{o.name} ↗</span>
                            {o.note && <span className="block text-[#8A8A99] text-[10px] mt-0.5">{o.note}</span>}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => trackCourse({ skill: gap.skill, course_name: `${gap.skill} course`, tier: 'free', status: 'in_progress' })}
                      className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#0E0E1A]/[0.04] text-[#3F3F4E] hover:bg-[#0E0E1A]/[0.04] transition-colors">
                      I&apos;m learning this
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Financing */}
        <div className="gradient-border-card rounded-2xl p-5 mb-8">
          <p className="text-[#D97706] text-xs font-bold uppercase tracking-wider mb-1">💳 Financing — don&apos;t let cost stop you</p>
          <p className="text-[#5A5A6E] text-xs mb-4">Routes to take a paid course without paying upfront.</p>
          <div className="grid md:grid-cols-2 gap-3">
            {FINANCING_OPTIONS.map((f, i) => (
              <div key={i} className="bg-[#0E0E1A]/[0.04] rounded-xl p-3">
                <p className="text-[#0E0E1A] text-sm font-bold mb-1">{f.title}</p>
                <p className="text-[#5A5A6E] text-xs leading-relaxed">{f.detail}</p>
                {f.href && <a href={f.href} target="_blank" rel="noopener noreferrer" className="text-[#0891B2] text-xs font-bold mt-1 inline-block">Learn more ↗</a>}
              </div>
            ))}
          </div>
        </div>

        {/* Events to attend */}
        {events.length > 0 && (
          <div className="gradient-border-card rounded-2xl p-5 mb-8">
            <p className="text-[#7C3AED] text-xs font-bold uppercase tracking-wider mb-1">📅 Events to attend</p>
            <p className="text-[#5A5A6E] text-xs mb-4">Recommended for your field. Find tickets, then track whether you booked + attended.</p>
            <div className="space-y-2.5">
              {events.map((ev, i) => {
                const ticketUrl = eventLink(ev)
                const isOfficial = !!(ev.official_url && /^https?:\/\//i.test(ev.official_url))
                const st = ev.status || 'interested'
                return (
                  <div key={i} className="bg-[#0E0E1A]/[0.04] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0">
                        <p className="text-[#0E0E1A] text-sm font-bold">{ev.name}</p>
                        <p className="text-[#5A5A6E] text-xs">{[ev.when, ev.where].filter(Boolean).join(' · ')}</p>
                      </div>
                      <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="text-[#0891B2] text-xs font-bold flex-shrink-0 hover:underline">{isOfficial ? 'Official site ↗' : 'Find event ↗'}</a>
                    </div>
                    {ev.why && <p className="text-[#8A8A99] text-[11px] mb-2">{ev.why}</p>}
                    <div className="flex gap-1.5 flex-wrap">
                      {([
                        { key: 'booked', label: '🎟 Booked' },
                        { key: 'attended', label: '✓ Attended' },
                        { key: 'not_attended', label: 'Didn’t attend' },
                      ] as const).map(opt => {
                        const active = st === opt.key
                        return (
                          <button key={opt.key} onClick={() => setEventStatus(ev, active ? 'interested' : opt.key)}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
                            style={{
                              background: active
                                ? (opt.key === 'attended' ? 'rgba(52,211,153,0.15)' : opt.key === 'booked' ? 'rgba(34,211,238,0.12)' : 'rgba(14,14,26,0.04)')
                                : 'rgba(14,14,26,0.04)',
                              color: active
                                ? (opt.key === 'attended' ? '#059669' : opt.key === 'booked' ? '#0891B2' : '#3F3F4E')
                                : '#5A5A6E',
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
          </div>
        )}

        {/* My courses */}
        <div className="gradient-border-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[#5A5A6E] text-xs font-bold uppercase tracking-wider">My courses</p>
            <button onClick={() => setAddOpen(o => !o)} className="text-[#0891B2] text-xs font-bold border border-[#22D3EE]/30 hover:border-[#22D3EE]/60 px-3 py-1.5 rounded-full transition-colors">
              {addOpen ? 'Close' : '+ Add a course'}
            </button>
          </div>

          {addOpen && <AddCourseForm onAdd={trackCourse} onDone={() => setAddOpen(false)} />}

          {courses.length === 0 ? (
            <p className="text-[#8A8A99] text-xs text-center py-4">Nothing tracked yet. Start a course above, or add one you&apos;ve already done.</p>
          ) : (
            <div className="space-y-2 mt-3">
              {courses.map(c => (
                <CourseRow key={c.id} course={c} onUpdate={trackCourse} onRemove={removeCourse} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AddCourseForm({ onAdd, onDone }: { onAdd: (p: Record<string, unknown>) => Promise<void>; onDone: () => void }) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('completed')
  const [credUrl, setCredUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onAdd({ course_name: name, platform, status, credential_url: credUrl, tier: 'paid' })
    setSaving(false)
    onDone()
  }

  return (
    <div className="bg-[#0E0E1A]/[0.04] rounded-xl p-4 mb-3 space-y-3">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Course name (e.g. AI for Everyone)"
        className="w-full bg-[#0E0E1A]/[0.04] border border-[#0E0E1A]/[0.08] rounded-lg px-3 py-2 text-sm text-[#0E0E1A] placeholder-[#9A9AA8] outline-none focus:border-[#22D3EE]/40" />
      <input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="Platform (Coursera, Udemy, …)"
        className="w-full bg-[#0E0E1A]/[0.04] border border-[#0E0E1A]/[0.08] rounded-lg px-3 py-2 text-sm text-[#0E0E1A] placeholder-[#9A9AA8] outline-none focus:border-[#22D3EE]/40" />
      <div className="flex gap-2">
        {['in_progress', 'completed'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ background: status === s ? 'rgba(34,211,238,0.12)' : 'rgba(14,14,26,0.04)', color: status === s ? '#0891B2' : '#5A5A6E' }}>
            {s === 'in_progress' ? 'In progress' : 'Completed'}
          </button>
        ))}
      </div>
      {status === 'completed' && (
        <div>
          <input value={credUrl} onChange={e => setCredUrl(e.target.value)} placeholder="Certificate verification link (makes it ✓ Verified)"
            className="w-full bg-[#0E0E1A]/[0.04] border border-[#0E0E1A]/[0.08] rounded-lg px-3 py-2 text-sm text-[#0E0E1A] placeholder-[#9A9AA8] outline-none focus:border-[#34D399]/40" />
          <p className="text-[#8A8A99] text-[10px] mt-1">Paste the public certificate URL from Coursera/Udemy/Credly etc. Leave blank to keep it self-reported.</p>
        </div>
      )}
      <button onClick={submit} disabled={saving || !name.trim()}
        className="w-full py-2.5 rounded-lg font-black text-sm disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg,#22D3EE,#A78BFA)', color: '#060609' }}>
        {saving ? 'Saving…' : 'Add course'}
      </button>
    </div>
  )
}

function CourseRow({ course, onUpdate, onRemove }: { course: Course; onUpdate: (p: Record<string, unknown>) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const verified = course.verification_status === 'verified'
  return (
    <div className="bg-[#0E0E1A]/[0.04] rounded-xl p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#0E0E1A] text-sm font-bold truncate">{course.course_name}</span>
          {verified ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#059669' }}>✓ Verified</span>
          ) : (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(14,14,26,0.04)', color: '#5A5A6E' }}>○ Self-reported</span>
          )}
          {course.sponsored_by && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#D97706' }}>🏢 Sponsored by {course.sponsored_by}</span>
          )}
        </div>
        <p className="text-[#5A5A6E] text-xs">{course.platform || '—'} · {course.status === 'completed' ? 'Completed' : course.status === 'in_progress' ? 'In progress' : 'Interested'}{course.credential_url ? ' · ' : ''}{course.credential_url && <a href={course.credential_url} target="_blank" rel="noopener noreferrer" className="text-[#0891B2]">view cert ↗</a>}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {course.status !== 'completed' && (
          <button onClick={() => onUpdate({ id: course.id, course_name: course.course_name, status: 'completed', credential_url: course.credential_url, platform: course.platform, tier: course.tier })}
            className="text-[#059669] text-xs font-bold">Mark done</button>
        )}
        <button onClick={() => onRemove(course.id)} className="text-[#8A8A99] hover:text-[#E11D48] text-xs">✕</button>
      </div>
    </div>
  )
}

export default function UpskillPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <UpskillContent />
    </Suspense>
  )
}
