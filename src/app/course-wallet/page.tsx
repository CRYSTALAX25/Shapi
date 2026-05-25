'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { courseSearchUrl, FINANCING_OPTIONS } from '@/lib/upskill'

type SuggestedCourse = { name: string; platform?: string; popular?: boolean; cost?: 'free' | 'free_audit' | 'paid'; rating?: number | null; price_band?: string; learners?: string | null }
type SkillGap = { skill: string; priority?: string; why?: string; suggested_courses?: SuggestedCourse[] }

// Plain-language cost line for a recommended course (no jargon like "audit").
function recCost(cost?: string): { label: string; tier: 'free' | 'paid' } {
  if (cost === 'paid') return { label: 'Paid', tier: 'paid' }
  if (cost === 'free_audit') return { label: 'Free to learn · paid certificate', tier: 'free' }
  if (cost === 'free') return { label: 'Free', tier: 'free' }
  return { label: '', tier: 'free' }
}
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
  liked?: boolean | null
  subsidy_type?: 'government' | 'employer' | null
  subsidy_detail?: string | null
  duration_hours?: number | null
}

type CourseFilter = 'all' | 'saved' | 'verified'

// Cost/subsidy label driven by subsidy_type + tier.
function costLabel(c: Pick<Course, 'tier' | 'subsidy_type' | 'subsidy_detail'>) {
  if (c.subsidy_type === 'government') {
    return { icon: '🏛', text: c.subsidy_detail ? `Government-subsidised · ${c.subsidy_detail}` : 'Government-subsidised', color: '#6AA8F5', bg: 'rgba(106,168,245,0.15)' }
  }
  if (c.subsidy_type === 'employer') {
    return { icon: '🏢', text: c.subsidy_detail ? `Employer-sponsored · ${c.subsidy_detail}` : 'Employer-sponsored', color: '#F08CAE', bg: 'rgba(240,140,174,0.15)' }
  }
  if (c.tier === 'paid') {
    return { icon: '🔵', text: 'Paid', color: '#F08CAE', bg: 'rgba(240,140,174,0.12)' }
  }
  return { icon: '⚪', text: 'Free', color: '#A6A6B4', bg: 'rgba(255,255,255,0.05)' }
}

function UpskillContent() {
  const router = useRouter()
  const params = useSearchParams()
  const focusSkill = params.get('skill')
  const backTab = params.get('back') || 'learning'

  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [gaps, setGaps] = useState<SkillGap[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [filter, setFilter] = useState<CourseFilter>('all')

  const load = () => {
    fetch('/api/upskill')
      .then(r => r.json())
      .then(d => {
        setIsPro(!!d.isPro)
        setGaps(d.skill_gaps || [])
        setCourses(d.courses || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

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
    return <div className="min-h-screen bg-[#0E0E13] flex items-center justify-center text-[#A6A6B4] text-sm">Loading…</div>
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
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <style>{`
        .gradient-border-card { background: linear-gradient(#16161F,#16161F) padding-box, linear-gradient(135deg, rgba(106,168,245,0.15), rgba(240,140,174,0.15)) border-box; border: 1px solid transparent; box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35); }
      `}</style>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href={`/profile?tab=${backTab}`} className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1]">← Profile</Link>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-6">
          <h1 className="text-3xl font-black mb-2" style={{ color: '#FB7185' }}>Course Wallet</h1>
          <p className="text-[#A6A6B4] text-sm">Save courses you like, track your progress, and verify what you finish so it counts on your profile. Roadmap recommendations are below.</p>
        </div>

        {/* My courses — the wallet (saved + tracked), front and centre */}
        <div id="my-courses" className="gradient-border-card rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">My courses</p>
            <button onClick={() => setAddOpen(o => !o)} className="text-[#6AA8F5] text-xs font-bold border border-[#6AA8F5]/30 hover:border-[#6AA8F5]/60 px-3 py-1.5 rounded-full transition-colors">
              {addOpen ? 'Close' : '+ Add a course'}
            </button>
          </div>

          {addOpen && <AddCourseForm onAdd={trackCourse} onDone={() => setAddOpen(false)} />}

          {/* Filter row */}
          {courses.length > 0 && (
            <div className="flex gap-2 mb-1">
              {([
                ['all', 'All'],
                ['saved', '❤️ Saved'],
                ['verified', '✓ Verified'],
              ] as Array<[CourseFilter, string]>).map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)}
                  className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    background: filter === key ? 'rgba(106,168,245,0.12)' : 'rgba(255,255,255,0.05)',
                    color: filter === key ? '#6AA8F5' : '#A6A6B4',
                  }}>{label}</button>
              ))}
            </div>
          )}

          {courses.length === 0 ? (
            <p className="text-[#7E7E8E] text-xs text-center py-4">Nothing tracked yet. Add a course you&apos;re taking or have done, or save one from the recommendations below.</p>
          ) : (() => {
            const shown = courses.filter(c =>
              filter === 'saved' ? !!c.liked :
              filter === 'verified' ? c.verification_status === 'verified' :
              true
            )
            if (shown.length === 0) {
              return <p className="text-[#7E7E8E] text-xs text-center py-4">No courses match this filter.</p>
            }
            return (
              <div className="space-y-2 mt-3">
                {shown.map(c => (
                  <CourseRow key={c.id} course={c} onUpdate={trackCourse} onRemove={removeCourse} />
                ))}
              </div>
            )
          })()}
        </div>

        {/* Trust note */}
        <div className="gradient-border-card rounded-2xl p-4 mb-6">
          <p className="text-[#C7C7D1] text-xs leading-relaxed">
            <span className="text-[#6AA8F5] font-bold">✓ Verified</span> = you added a checkable certificate link, or completed it through Shapi · <span className="text-[#A6A6B4] font-bold">○ Self-reported</span> = your claim, not yet checked. Verified learning shows companies real, provable growth.
          </p>
        </div>

        {/* Skill gaps from roadmap. If arrived via ?skill=X (e.g. a pivot gap)
            and X isn't already a roadmap gap, prepend a synthetic card so the
            link lands on real course options for that exact gap. */}
        {displayGaps.length === 0 ? (
          <div className="gradient-border-card rounded-2xl p-8 text-center mb-6">
            <p className="text-[#A6A6B4] font-bold mb-1">No skill gaps yet</p>
            <p className="text-[#7E7E8E] text-sm mb-4">Generate your Career Roadmap first — it identifies exactly what to learn next.</p>
            <Link href="/profile" className="inline-block px-5 py-2.5 rounded-full font-black text-sm" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', color: '#fff' }}>
              Go to Career Roadmap →
            </Link>
          </div>
        ) : (
          <div className="space-y-4 mb-8">
            {displayGaps.map((gap, i) => {
              const recs = gap.suggested_courses || []
              const byRank = (a: SuggestedCourse, b: SuggestedCourse) =>
                (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || ((b.rating || 0) - (a.rating || 0))
              const freeFromAI = recs.filter(c => c.cost !== 'paid').sort(byRank)
              const paidFromAI = recs.filter(c => c.cost === 'paid').sort(byRank)
              // Old roadmaps have no cost tag, so everything reads as "free" and the
              // Paid group would be empty. Guarantee 2 in each group with sensible
              // platform fallbacks (named picks arrive when the roadmap is regenerated).
              const freeFallback: SuggestedCourse[] = [
                { name: gap.skill, platform: 'Coursera', cost: 'free_audit' },
                { name: gap.skill, platform: 'YouTube', cost: 'free' },
              ]
              const paidFallback: SuggestedCourse[] = [
                { name: gap.skill, platform: 'Udemy', cost: 'paid' },
                { name: gap.skill, platform: 'LinkedIn Learning', cost: 'paid' },
              ]
              const freeRecs = (freeFromAI.length ? freeFromAI : freeFallback).slice(0, 2)
              const paidRecs = (paidFromAI.length ? paidFromAI : paidFallback).slice(0, 2)
              const isSaved = (name: string) => courses.some(x => (x.course_name || '').toLowerCase() === name.toLowerCase())
              const saveRec = (c: SuggestedCourse) => trackCourse({
                course_name: c.name, platform: c.platform || null, course_url: courseSearchUrl(c.platform, c.name),
                skill: gap.skill, status: 'interested', tier: recCost(c.cost).tier, liked: true,
              })
              const highlighted = focusSkill && gap.skill.toLowerCase() === focusSkill.toLowerCase()
              return (
                <div key={i} className="gradient-border-card rounded-2xl p-5" style={highlighted ? { borderColor: 'rgba(106,168,245,0.4)' } : undefined}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-black text-[#F4F4F7]">{gap.skill}</h3>
                    {gap.priority && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                        background: gap.priority === 'high' ? 'rgba(245,142,154,0.12)' : gap.priority === 'medium' ? 'rgba(240,140,174,0.12)' : 'rgba(255,255,255,0.05)',
                        color: gap.priority === 'high' ? '#F58E9A' : gap.priority === 'medium' ? '#F08CAE' : '#A6A6B4',
                      }}>{gap.priority} priority</span>
                    )}
                  </div>
                  {gap.why && <p className="text-[#A6A6B4] text-xs mb-3">{gap.why}</p>}

                  {/* Shapi's picks — 2 best free + 2 best paid, by rating & price */}
                  {(freeRecs.length > 0 || paidRecs.length > 0) && (
                    <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(240,140,174,0.08)', border: '1px solid rgba(240,140,174,0.2)' }}>
                      <p className="text-[#F08CAE] text-[10px] font-bold uppercase tracking-wider mb-2">⭐ Shapi recommends — best by rating &amp; price</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Free group */}
                        <div>
                          <p className="text-[#6AA8F5] text-[10px] font-bold uppercase tracking-wider mb-2">Free</p>
                          <div className="space-y-1.5">
                            {freeRecs.length > 0
                              ? freeRecs.map((c, k) => <RecRow key={k} c={c} saved={isSaved(c.name)} onSave={() => saveRec(c)} />)
                              : <p className="text-[#7E7E8E] text-[10px]">No standout free pick — search below.</p>}
                          </div>
                        </div>
                        {/* Paid group */}
                        <div>
                          <p className="text-[#F08CAE] text-[10px] font-bold uppercase tracking-wider mb-2">Paid</p>
                          <div className="space-y-1.5">
                            {paidRecs.length > 0
                              ? paidRecs.map((c, k) => <RecRow key={k} c={c} saved={isSaved(c.name)} onSave={() => saveRec(c)} />)
                              : <p className="text-[#7E7E8E] text-[10px]">No standout paid pick — search below.</p>}
                          </div>
                        </div>
                      </div>
                      <p className="text-[#7E7E8E] text-[10px] mt-2">Ratings, learner counts &amp; prices are approximate — tap <strong className="text-[#A6A6B4]">Open ↗</strong> for the live figures on the course page. Tap 🤍 to save a course to <strong className="text-[#A6A6B4]">My courses</strong> ↑.</p>
                    </div>
                  )}

                  {/* Search for more + add-your-own */}
                  <div className="rounded-xl p-3 bg-white/[0.03]">
                    <p className="text-[#A6A6B4] text-[10px] mb-2">Want something else? Search more courses for <strong className="text-[#C7C7D1]">{gap.skill}</strong>:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Coursera', 'Udemy', 'edX', 'YouTube', 'LinkedIn'].map(p => (
                        <a key={p} href={courseSearchUrl(p, gap.skill)} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/[0.05] text-[#6AA8F5] hover:bg-white/[0.08] transition-colors">{p} ↗</a>
                      ))}
                    </div>
                    <p className="text-[#7E7E8E] text-[10px] mt-2">Found one you like? Add it with its link using <strong className="text-[#A6A6B4]">+ Add a course</strong> at the top.</p>
                  </div>

                </div>
              )
            })}
          </div>
        )}

        {/* Financing */}
        <div id="financing" className="gradient-border-card rounded-2xl p-5 mb-8 scroll-mt-24">
          <p className="text-[#F08CAE] text-xs font-bold uppercase tracking-wider mb-1">💳 Financing — don&apos;t let cost stop you</p>
          <p className="text-[#A6A6B4] text-xs mb-4">Routes to take a paid course without paying upfront.</p>
          <div className="grid md:grid-cols-2 gap-3">
            {FINANCING_OPTIONS.map((f, i) => (
              <div key={i} className="bg-white/[0.05] rounded-xl p-3">
                <p className="text-[#F4F4F7] text-sm font-bold mb-1">{f.title}</p>
                <p className="text-[#A6A6B4] text-xs leading-relaxed">{f.detail}</p>
                {f.href && <a href={f.href} target="_blank" rel="noopener noreferrer" className="text-[#6AA8F5] text-xs font-bold mt-1 inline-block">Learn more ↗</a>}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function AddCourseForm({ onAdd, onDone }: { onAdd: (p: Record<string, unknown>) => Promise<void>; onDone: () => void }) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('')
  const [courseUrl, setCourseUrl] = useState('')
  const [status, setStatus] = useState('completed')
  const [credUrl, setCredUrl] = useState('')
  const [liked, setLiked] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async (saveToWallet = false) => {
    if (!name.trim()) return
    setSaving(true)
    await onAdd({ course_name: name, platform, course_url: courseUrl, status, credential_url: credUrl, tier: 'paid', liked: saveToWallet || liked })
    setSaving(false)
    onDone()
  }

  return (
    <div className="bg-white/[0.05] rounded-xl p-4 mb-3 space-y-3">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Course name (e.g. AI for Everyone)"
        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/40" />
      <input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="Platform (Coursera, Udemy, …)"
        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/40" />
      <input value={courseUrl} onChange={e => setCourseUrl(e.target.value)} placeholder="Direct course link (paste the URL so you can jump back to it)"
        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/40" />
      <div className="flex gap-2">
        {['in_progress', 'completed'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ background: status === s ? 'rgba(106,168,245,0.12)' : 'rgba(255,255,255,0.05)', color: status === s ? '#6AA8F5' : '#A6A6B4' }}>
            {s === 'in_progress' ? 'In progress' : 'Completed'}
          </button>
        ))}
      </div>
      {status === 'completed' && (
        <div>
          <input value={credUrl} onChange={e => setCredUrl(e.target.value)} placeholder="Certificate verification link (makes it ✓ Verified)"
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/40" />
          <p className="text-[#7E7E8E] text-[10px] mt-1">Paste the public certificate URL from Coursera/Udemy/Credly etc. Leave blank to keep it self-reported.</p>
        </div>
      )}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={liked} onChange={e => setLiked(e.target.checked)} className="accent-[#6AA8F5]" />
        <span className="text-[#C7C7D1] text-xs">{liked ? '❤️' : '🤍'} Save to my wallet</span>
      </label>
      <div className="flex gap-2">
        <button onClick={() => submit(false)} disabled={saving || !name.trim()}
          className="flex-1 py-2.5 rounded-lg font-black text-sm disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', color: '#fff' }}>
          {saving ? 'Saving…' : 'Add course'}
        </button>
        <button onClick={() => submit(true)} disabled={saving || !name.trim()}
          className="px-4 py-2.5 rounded-lg font-bold text-sm border border-[#6AA8F5]/30 text-[#6AA8F5] hover:border-[#6AA8F5]/60 disabled:opacity-40 transition-colors">
          ❤️ Save
        </button>
      </div>
    </div>
  )
}

// A single recommended-course row: heart-save · name/platform · Open · rating/cost tags.
function RecRow({ c, saved, onSave }: { c: SuggestedCourse; saved: boolean; onSave: () => void }) {
  const url = courseSearchUrl(c.platform, c.name)
  const cost = recCost(c.cost)
  const showBand = c.price_band && c.price_band.trim().toLowerCase() !== 'free'
  return (
    <div className="bg-white/[0.05] rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <button onClick={() => { if (!saved) onSave() }}
          title={saved ? 'Saved to My courses' : 'Save to My courses'}
          className="flex-shrink-0 text-sm leading-none transition-transform hover:scale-110">{saved ? '❤️' : '🤍'}</button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 flex items-center justify-between gap-2 hover:opacity-90">
          <span className="text-[#F4F4F7] text-xs font-bold truncate">{c.name}{c.platform ? <span className="text-[#A6A6B4] font-normal"> · {c.platform}</span> : null}</span>
          <span className="text-[#F08CAE] text-xs font-bold flex-shrink-0">Open ↗</span>
        </a>
      </div>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap pl-7">
        {typeof c.rating === 'number' && c.rating > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#C7C7D1' }}>{c.rating.toFixed(1)}★</span>
        )}
        {c.learners && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#A6A6B4' }}>≈{c.learners} learners</span>
        )}
        {c.popular && !c.learners && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>⭐ Most-taken</span>
        )}
        {cost.label && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cost.tier === 'paid' ? 'rgba(240,140,174,0.12)' : 'rgba(106,168,245,0.12)', color: cost.tier === 'paid' ? '#F08CAE' : '#6AA8F5' }}>{cost.label}</span>
        )}
        {showBand && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#A6A6B4' }}>{c.price_band}</span>
        )}
      </div>
    </div>
  )
}

function CourseRow({ course, onUpdate, onRemove }: { course: Course; onUpdate: (p: Record<string, unknown>) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const verified = course.verification_status === 'verified'
  const liked = !!course.liked
  const cost = costLabel(course)
  // Carry the course's current context so a partial toggle never clobbers it.
  const ctx = {
    id: course.id,
    course_name: course.course_name,
    platform: course.platform,
    course_url: course.course_url,
    status: course.status,
    tier: course.tier,
    credential_url: course.credential_url,
  }
  return (
    <div className="bg-white/[0.05] rounded-xl p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#F4F4F7] text-sm font-bold truncate">{course.course_name}</span>
          {verified ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(106,168,245,0.15)', color: '#6AA8F5' }}>✓ Verified</span>
          ) : (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#A6A6B4' }}>○ Self-reported</span>
          )}
          {/* Cost / subsidy label */}
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cost.bg, color: cost.color }}>{cost.icon} {cost.text}</span>
          {typeof course.duration_hours === 'number' && course.duration_hours > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#A6A6B4' }}>⏱️ {course.duration_hours}h</span>
          )}
          {course.sponsored_by && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(240,140,174,0.15)', color: '#F08CAE' }}>🏢 Sponsored by {course.sponsored_by}</span>
          )}
        </div>
        <p className="text-[#A6A6B4] text-xs">{course.platform || '—'} · {course.status === 'completed' ? 'Completed' : course.status === 'in_progress' ? 'In progress' : 'Interested'}{course.course_url ? ' · ' : ''}{course.course_url && <a href={course.course_url} target="_blank" rel="noopener noreferrer" className="text-[#6AA8F5]">open course ↗</a>}{course.credential_url ? ' · ' : ''}{course.credential_url && <a href={course.credential_url} target="_blank" rel="noopener noreferrer" className="text-[#6AA8F5]">view cert ↗</a>}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onUpdate({ ...ctx, liked: !liked })}
          aria-label={liked ? 'Unsave course' : 'Save course'}
          title={liked ? 'Saved' : 'Save'}
          className="text-base leading-none transition-transform hover:scale-110">
          {liked ? '❤️' : '🤍'}
        </button>
        {course.status !== 'completed' && (
          <button onClick={() => onUpdate({ ...ctx, status: 'completed' })}
            className="text-[#6AA8F5] text-xs font-bold">Mark done</button>
        )}
        <button onClick={() => onRemove(course.id)} className="text-[#7E7E8E] hover:text-[#F58E9A] text-xs">✕</button>
      </div>
    </div>
  )
}

export default function UpskillPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0E0E13]" />}>
      <UpskillContent />
    </Suspense>
  )
}
