'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Job = {
  title: string
  company: string
  location: string
  url: string
  description: string
  match_score: number
  salary?: string
  posted?: string
}

type Application = {
  id: string
  company_name: string
  job_title: string
  stage: string
  company_website?: string
  job_url?: string
  key_requirements?: string[]
  hiring_manager_name?: string
  notes?: string
  created_at: string
  updated_at: string
}

type PrepGuide = {
  company_snapshot: {
    what_they_do: string
    size_and_stage: string
    recent_news: string[]
    culture_themes: string[]
    known_challenges: string[]
  }
  social_intel: {
    linkedin_posts: Array<{
      summary: string
      posted: string
      how_to_use: string
    }>
    social_themes: string[]
    leadership_voice: string
    conversation_starters: string[]
  }
  why_they_will_love_you: string[]
  your_stories: Array<{
    situation: string
    task: string
    action: string
    result: string
    use_for_question: string
  }>
  likely_questions: Array<{
    question: string
    your_answer_angle: string
    watch_out_for: string
  }>
  questions_to_ask_them: string[]
  red_flags_to_probe: string[]
  salary_intel: string
}

const STAGES = ['researching', 'outreach_sent', 'interview', 'offer', 'archived']
const STAGE_LABELS: Record<string, string> = {
  researching: 'Researching',
  outreach_sent: 'Outreach sent',
  interview: 'Interview',
  offer: 'Offer',
  archived: 'Archived',
}
const STAGE_COLORS: Record<string, string> = {
  researching: 'rgba(240,140,174,0.15)',
  outreach_sent: 'rgba(106,168,245,0.15)',
  interview: 'rgba(245,142,154,0.15)',
  offer: 'rgba(106,168,245,0.15)',
  archived: 'rgba(255,255,255,0.05)',
}
const STAGE_TEXT: Record<string, string> = {
  researching: '#F08CAE',
  outreach_sent: '#6AA8F5',
  interview: '#F58E9A',
  offer: '#6AA8F5',
  archived: '#7E7E8E',
}

export default function ActivePage() {
  const [tab, setTab] = useState<'scan' | 'applications' | 'prep'>('scan')

  // Scanner state
  const [targetRole, setTargetRole] = useState('')
  const [location, setLocation] = useState('')
  const [keywords, setKeywords] = useState('')
  const [scanning, setScanning] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [scanError, setScanError] = useState('')

  // Draft state
  const [draftJob, setDraftJob] = useState<Job | null>(null)
  const [draftMode, setDraftMode] = useState<'email' | 'linkedin' | 'follow_up'>('email')
  const [hiringManager, setHiringManager] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState<{ subject?: string; body?: string; message?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [savingApp, setSavingApp] = useState(false)

  // Applications state
  const [applications, setApplications] = useState<Application[]>([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [addingApp, setAddingApp] = useState(false)
  const [newApp, setNewApp] = useState({ company_name: '', job_title: '', company_website: '', job_url: '', stage: 'researching' })

  // Prep state
  const [prepApp, setPrepApp] = useState<Application | null>(null)
  const [prepping, setPrepping] = useState(false)
  const [prep, setPrep] = useState<PrepGuide | null>(null)
  const [prepSection, setPrepSection] = useState<'snapshot' | 'social' | 'stories' | 'questions' | 'ask' | 'salary'>('snapshot')

  const loadApplications = useCallback(async () => {
    setAppsLoading(true)
    try {
      const res = await fetch('/api/active/applications')
      const data = await res.json()
      setApplications(data.applications || [])
    } catch { /* silent */ } finally {
      setAppsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'applications') loadApplications()
  }, [tab, loadApplications])

  async function scan() {
    if (!targetRole.trim()) return
    setScanning(true)
    setJobs([])
    setScanError('')
    setDraft(null)
    setDraftJob(null)
    try {
      const res = await fetch('/api/active/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_role: targetRole, location, keywords }),
      })
      const data = await res.json()
      if (data.error) { setScanError(data.error); return }
      setJobs(data.jobs || [])
      if (!data.jobs?.length) setScanError('No jobs found — try a broader search.')
    } catch { setScanError('Search failed. Try again.') } finally { setScanning(false) }
  }

  async function generateDraft(job: Job) {
    setDraftJob(job)
    setDraft(null)
    setDrafting(true)
    setCopied(false)
    try {
      const res = await fetch('/api/active/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: job.title,
          company_name: job.company,
          company_website: job.url,
          job_url: job.url,
          key_requirements: job.description?.split('.').slice(0, 3),
          hiring_manager_name: hiringManager || undefined,
          mode: draftMode,
        }),
      })
      const data = await res.json()
      setDraft(data.draft || null)
    } catch { /* silent */ } finally { setDrafting(false) }
  }

  async function saveToTracker(job: Job) {
    setSavingApp(true)
    try {
      await fetch('/api/active/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: job.company,
          job_title: job.title,
          company_website: '',
          job_url: job.url,
          stage: 'outreach_sent',
          key_requirements: job.description?.split('.').slice(0, 3),
        }),
      })
    } catch { /* silent */ } finally { setSavingApp(false) }
  }

  async function addApplication() {
    if (!newApp.company_name || !newApp.job_title) return
    try {
      await fetch('/api/active/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApp),
      })
      setNewApp({ company_name: '', job_title: '', company_website: '', job_url: '', stage: 'researching' })
      setAddingApp(false)
      loadApplications()
    } catch { /* silent */ }
  }

  async function updateStage(id: string, stage: string) {
    await fetch('/api/active/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage }),
    })
    setApplications(prev => prev.map(a => a.id === id ? { ...a, stage } : a))
  }

  async function runPrep(app: Application) {
    setPrepApp(app)
    setPrep(null)
    setPrepping(true)
    setPrepSection('snapshot')
    setTab('prep')
    try {
      const res = await fetch('/api/active/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: app.company_name,
          job_title: app.job_title,
          company_website: app.company_website,
          key_requirements: app.key_requirements,
          application_id: app.id,
        }),
      })
      const data = await res.json()
      setPrep(data.prep || null)
    } catch { /* silent */ } finally { setPrepping(false) }
  }

  const matchColor = (score: number) =>
    score >= 70 ? '#6AA8F5' : score >= 50 ? '#6AA8F5' : '#F08CAE'

  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.10), rgba(240,140,174,0.10)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .card-hover:hover {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.22), rgba(240,140,174,0.22)) border-box;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .tab-active {
          background: linear-gradient(135deg, rgba(106,168,245,0.12), rgba(240,140,174,0.12));
          border-color: rgba(106,168,245,0.3);
          color: #6AA8F5;
        }
        textarea, input, select {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #F4F4F7;
          border-radius: 12px;
          padding: 10px 14px;
          width: 100%;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        textarea:focus, input:focus, select:focus {
          border-color: rgba(106,168,245,0.4);
        }
        select option { background: #16161F; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav */}
      <nav className="relative z-10 px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-black text-xl tracking-tighter" style={{
            background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>shapi</Link>
          <div className="flex items-center gap-4">
            <Link href="/roles" className="text-[#A6A6B4] text-sm hover:text-[#C7C7D1] transition-colors">Roles board</Link>
            <Link href="/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">Dashboard</Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-[#F4F4F7]">Shapi Active</h1>
            <span className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: 'rgba(245,142,154,0.15)', color: '#F58E9A' }}>
              Outbound pipeline
            </span>
          </div>
          <p className="text-[#A6A6B4] text-sm">
            Find roles, draft outreach, track applications, prep for interviews — your entire job hunt in one place.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(['scan', 'applications', 'prep'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all duration-200 ${
                tab === t ? 'tab-active' : 'border-[rgba(255,255,255,0.08)] text-[#A6A6B4] hover:text-[#C7C7D1]'
              }`}
            >
              {t === 'scan' && '🔍 Job scanner'}
              {t === 'applications' && `📋 Applications${applications.length > 0 ? ` (${applications.length})` : ''}`}
              {t === 'prep' && '🎯 Interview prep'}
            </button>
          ))}
        </div>

        {/* ─── JOB SCANNER ─── */}
        {tab === 'scan' && (
          <div className="space-y-6">
            {/* Search form */}
            <div className="gradient-border-card rounded-2xl p-6">
              <h2 className="text-[#F4F4F7] font-bold mb-4">Find roles</h2>
              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1.5 block">Target role *</label>
                  <input
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value)}
                    placeholder="e.g. Head of Operations"
                    onKeyDown={e => e.key === 'Enter' && scan()}
                  />
                </div>
                <div>
                  <label className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1.5 block">Location</label>
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Dubai, UAE"
                  />
                </div>
                <div>
                  <label className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1.5 block">Keywords</label>
                  <input
                    value={keywords}
                    onChange={e => setKeywords(e.target.value)}
                    placeholder="e.g. entertainment, hospitality"
                  />
                </div>
              </div>
              <button
                onClick={scan}
                disabled={scanning || !targetRole.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black text-white disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}
              >
                {scanning ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Scanning the web...
                  </>
                ) : '🔍 Scan for roles'}
              </button>
              {scanning && (
                <p className="text-[#7E7E8E] text-xs mt-3">Searching live job boards. This takes 20-40 seconds...</p>
              )}
              {scanError && <p className="text-[#F58E9A] text-sm mt-3">{scanError}</p>}
            </div>

            {/* Draft config (shown when jobs exist) */}
            {jobs.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-5">
                <h3 className="text-[#C7C7D1] text-xs font-bold uppercase tracking-wider mb-3">Outreach settings</h3>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-[#A6A6B4] text-xs mb-1 block">Mode</label>
                    <select value={draftMode} onChange={e => setDraftMode(e.target.value as typeof draftMode)} style={{ width: 'auto' }}>
                      <option value="email">Email</option>
                      <option value="linkedin">LinkedIn message</option>
                      <option value="follow_up">Follow-up email</option>
                    </select>
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <label className="text-[#A6A6B4] text-xs mb-1 block">Hiring manager name (optional)</label>
                    <input value={hiringManager} onChange={e => setHiringManager(e.target.value)} placeholder="e.g. Sarah Johnson" />
                  </div>
                </div>
              </div>
            )}

            {/* Job results */}
            {jobs.length > 0 && (
              <div className="space-y-3">
                <p className="text-[#A6A6B4] text-sm">{jobs.length} roles found · sorted by match</p>
                {jobs.map((job, i) => (
                  <div key={i} className="gradient-border-card card-hover rounded-2xl p-5 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-[#F4F4F7] font-black">{job.title}</h3>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${matchColor(job.match_score)}18`, color: matchColor(job.match_score) }}>
                            {job.match_score}% match
                          </span>
                        </div>
                        <p className="text-[#C7C7D1] text-sm">{job.company}</p>
                        <div className="flex gap-3 text-xs text-[#7E7E8E] mt-1 flex-wrap">
                          {job.location && <span>📍 {job.location}</span>}
                          {job.salary && <span>💰 {job.salary}</span>}
                          {job.posted && <span>🕒 {job.posted}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-black" style={{ color: matchColor(job.match_score) }}>{job.match_score}%</div>
                        <div className="text-[#5C5C6A] text-[10px]">match</div>
                      </div>
                    </div>
                    {job.description && (
                      <p className="text-[#A6A6B4] text-xs leading-relaxed mb-4 line-clamp-2">{job.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => generateDraft(job)}
                        disabled={drafting && draftJob?.url === job.url}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: draftJob?.url === job.url && draft ? 'rgba(106,168,245,0.15)' : 'rgba(255,255,255,0.05)',
                          border: draftJob?.url === job.url && draft ? '1px solid rgba(106,168,245,0.3)' : '1px solid rgba(255,255,255,0.08)',
                          color: draftJob?.url === job.url && draft ? '#6AA8F5' : '#A6A6B4',
                        }}
                      >
                        {drafting && draftJob?.url === job.url ? (
                          <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Drafting...</>
                        ) : '✉️ Draft outreach'}
                      </button>
                      {job.url && (
                        <a href={job.url} target="_blank" rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl text-xs font-bold text-[#A6A6B4] hover:text-[#C7C7D1] transition-colors"
                          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                          View job →
                        </a>
                      )}
                      <button
                        onClick={() => saveToTracker(job)}
                        disabled={savingApp}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-[#7E7E8E] hover:text-[#A6A6B4] transition-colors"
                        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        + Add to tracker
                      </button>
                    </div>

                    {/* Draft output */}
                    {draftJob?.url === job.url && draft && (
                      <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(106,168,245,0.06)', border: '1px solid rgba(106,168,245,0.15)' }}>
                        {draft.subject && (
                          <p className="text-[#A6A6B4] text-xs font-bold mb-1">Subject: <span className="text-[#C7C7D1]">{draft.subject}</span></p>
                        )}
                        <pre className="text-[#F4F4F7] text-xs leading-relaxed whitespace-pre-wrap font-sans">
                          {draft.body || draft.message}
                        </pre>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : (draft.message || ''))
                              setCopied(true)
                              setTimeout(() => setCopied(false), 1500)
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            style={{ background: 'rgba(106,168,245,0.15)', color: '#6AA8F5' }}
                          >
                            {copied ? '✓ Copied!' : 'Copy'}
                          </button>
                          <button
                            onClick={() => generateDraft(job)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#A6A6B4] hover:text-[#C7C7D1] transition-colors"
                          >
                            Regenerate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!scanning && jobs.length === 0 && !scanError && (
              <div className="gradient-border-card rounded-2xl p-16 text-center">
                <p className="text-4xl mb-4">🔍</p>
                <p className="text-[#A6A6B4] font-bold">Search for roles above</p>
                <p className="text-[#5C5C6A] text-sm mt-2">Claude will scan live job boards and score each role against your Shapi profile.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── APPLICATION TRACKER ─── */}
        {tab === 'applications' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[#F4F4F7] font-bold">Your pipeline</h2>
              <button
                onClick={() => setAddingApp(!addingApp)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: addingApp ? 'rgba(106,168,245,0.15)' : 'rgba(255,255,255,0.05)',
                  border: addingApp ? '1px solid rgba(106,168,245,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: addingApp ? '#6AA8F5' : '#A6A6B4',
                }}
              >
                {addingApp ? '✕ Cancel' : '+ Add application'}
              </button>
            </div>

            {/* Add form */}
            {addingApp && (
              <div className="gradient-border-card rounded-2xl p-5 space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#A6A6B4] text-xs mb-1 block">Company *</label>
                    <input value={newApp.company_name} onChange={e => setNewApp(p => ({ ...p, company_name: e.target.value }))} placeholder="e.g. Qiddiya" />
                  </div>
                  <div>
                    <label className="text-[#A6A6B4] text-xs mb-1 block">Role *</label>
                    <input value={newApp.job_title} onChange={e => setNewApp(p => ({ ...p, job_title: e.target.value }))} placeholder="e.g. Head of Operations" />
                  </div>
                  <div>
                    <label className="text-[#A6A6B4] text-xs mb-1 block">Company website</label>
                    <input value={newApp.company_website} onChange={e => setNewApp(p => ({ ...p, company_website: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-[#A6A6B4] text-xs mb-1 block">Job URL</label>
                    <input value={newApp.job_url} onChange={e => setNewApp(p => ({ ...p, job_url: e.target.value }))} placeholder="https://..." />
                  </div>
                </div>
                <div>
                  <label className="text-[#A6A6B4] text-xs mb-1 block">Stage</label>
                  <select value={newApp.stage} onChange={e => setNewApp(p => ({ ...p, stage: e.target.value }))} style={{ width: 'auto' }}>
                    {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
                <button
                  onClick={addApplication}
                  className="px-5 py-2.5 rounded-xl text-sm font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}
                >
                  Save application
                </button>
              </div>
            )}

            {/* Stage columns */}
            {appsLoading ? (
              <div className="text-center py-12 text-[#7E7E8E]">Loading...</div>
            ) : applications.length === 0 ? (
              <div className="gradient-border-card rounded-2xl p-16 text-center">
                <p className="text-4xl mb-4">📋</p>
                <p className="text-[#A6A6B4] font-bold">No applications yet</p>
                <p className="text-[#5C5C6A] text-sm mt-2">Add one above or use the Job Scanner to find and track roles.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Stage summary bar */}
                <div className="grid grid-cols-4 gap-2">
                  {STAGES.slice(0, 4).map(s => {
                    const count = applications.filter(a => a.stage === s).length
                    return (
                      <div key={s} className="rounded-xl p-3 text-center"
                        style={{ background: STAGE_COLORS[s], border: `1px solid ${STAGE_TEXT[s]}22` }}>
                        <div className="text-2xl font-black" style={{ color: STAGE_TEXT[s] }}>{count}</div>
                        <div className="text-[10px] font-bold" style={{ color: STAGE_TEXT[s] + 'aa' }}>{STAGE_LABELS[s]}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Application cards */}
                {applications.filter(a => a.stage !== 'archived').map(app => (
                  <div key={app.id} className="gradient-border-card card-hover rounded-2xl p-5 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-[#F4F4F7] font-black">{app.job_title}</h3>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ background: STAGE_COLORS[app.stage], color: STAGE_TEXT[app.stage] }}>
                            {STAGE_LABELS[app.stage]}
                          </span>
                        </div>
                        <p className="text-[#C7C7D1] text-sm mb-2">{app.company_name}</p>
                        <p className="text-[#7E7E8E] text-xs">
                          Added {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {app.updated_at !== app.created_at && ` · Updated ${new Date(app.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <select
                          value={app.stage}
                          onChange={e => updateStage(app.id, e.target.value)}
                          style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
                        >
                          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 flex-wrap">
                      <button
                        onClick={() => runPrep(app)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(245,142,154,0.12)', border: '1px solid rgba(245,142,154,0.2)', color: '#F58E9A' }}
                      >
                        🎯 Prep for interview
                      </button>
                      {app.job_url && (
                        <a href={app.job_url} target="_blank" rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl text-xs font-bold text-[#7E7E8E] hover:text-[#A6A6B4] transition-colors"
                          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                          View job →
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {/* Archived */}
                {applications.filter(a => a.stage === 'archived').length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[#7E7E8E] text-xs cursor-pointer hover:text-[#A6A6B4] transition-colors">
                      {applications.filter(a => a.stage === 'archived').length} archived
                    </summary>
                    <div className="mt-2 space-y-2">
                      {applications.filter(a => a.stage === 'archived').map(app => (
                        <div key={app.id} className="rounded-xl p-4 opacity-40"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[#F4F4F7] text-sm font-bold">{app.job_title} <span className="text-[#7E7E8E] font-normal">at {app.company_name}</span></p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── INTERVIEW PREP ─── */}
        {tab === 'prep' && (
          <div className="space-y-4">
            {!prepApp && !prepping && (
              <div className="gradient-border-card rounded-2xl p-16 text-center">
                <p className="text-4xl mb-4">🎯</p>
                <p className="text-[#A6A6B4] font-bold">No prep session started</p>
                <p className="text-[#5C5C6A] text-sm mt-2">Go to your Applications and click &quot;Prep for interview&quot; on any role.</p>
                <button onClick={() => setTab('applications')}
                  className="mt-6 px-6 py-3 rounded-xl text-sm font-bold text-[#A6A6B4] hover:text-[#C7C7D1] transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  Go to Applications →
                </button>
              </div>
            )}

            {prepping && (
              <div className="gradient-border-card rounded-2xl p-12 text-center">
                <div className="flex justify-center mb-6">
                  <svg className="animate-spin w-8 h-8 text-[#6AA8F5]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="text-[#F4F4F7] font-bold mb-2">Researching {prepApp?.company_name}...</p>
                <p className="text-[#7E7E8E] text-sm">Scanning news, culture, Glassdoor, LinkedIn posts, social media. Takes ~40s.</p>
              </div>
            )}

            {prep && prepApp && !prepping && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-[#F4F4F7] font-black text-xl">{prepApp.job_title}</h2>
                    <p className="text-[#C7C7D1] text-sm">{prepApp.company_name} · Interview prep guide</p>
                  </div>
                  <button onClick={() => setTab('applications')}
                    className="text-[#7E7E8E] text-sm hover:text-[#A6A6B4] transition-colors">
                    ← Back to applications
                  </button>
                </div>

                {/* Section tabs */}
                <div className="flex gap-2 flex-wrap">
                  {([
                    ['snapshot', '🏢 Company'],
                    ['social', '📱 Social intel'],
                    ['stories', '📖 Your stories'],
                    ['questions', '❓ Questions'],
                    ['ask', '💬 Ask them'],
                    ['salary', '💰 Salary'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setPrepSection(key)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        prepSection === key ? 'tab-active' : 'border-[rgba(255,255,255,0.08)] text-[#A6A6B4]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Snapshot */}
                {prepSection === 'snapshot' && prep.company_snapshot && (
                  <div className="space-y-4">
                    <div className="gradient-border-card rounded-2xl p-6">
                      <h3 className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider mb-3">What they do</h3>
                      <p className="text-[#F4F4F7] text-sm leading-relaxed">{prep.company_snapshot.what_they_do}</p>
                      <p className="text-[#C7C7D1] text-sm mt-2 leading-relaxed">{prep.company_snapshot.size_and_stage}</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="gradient-border-card rounded-2xl p-5">
                        <h3 className="text-[#6AA8F5] text-xs font-bold uppercase tracking-wider mb-3">Recent news</h3>
                        <ul className="space-y-2">
                          {prep.company_snapshot.recent_news?.map((n, i) => (
                            <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed">• {n}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="gradient-border-card rounded-2xl p-5">
                        <h3 className="text-[#F08CAE] text-xs font-bold uppercase tracking-wider mb-3">Culture</h3>
                        <ul className="space-y-2">
                          {prep.company_snapshot.culture_themes?.map((t, i) => (
                            <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed">• {t}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="gradient-border-card rounded-2xl p-5">
                        <h3 className="text-[#F58E9A] text-xs font-bold uppercase tracking-wider mb-3">Challenges / watch for</h3>
                        <ul className="space-y-2">
                          {prep.company_snapshot.known_challenges?.map((c, i) => (
                            <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed">• {c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {prep.why_they_will_love_you?.length > 0 && (
                      <div className="gradient-border-card rounded-2xl p-6">
                        <h3 className="text-[#6AA8F5] text-xs font-bold uppercase tracking-wider mb-3">Why they&apos;ll want you</h3>
                        <ul className="space-y-3">
                          {prep.why_they_will_love_you.map((r, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-[#6AA8F5] font-black flex-shrink-0">0{i + 1}</span>
                              <p className="text-[#C7C7D1] text-sm leading-relaxed">{r}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Social intel */}
                {prepSection === 'social' && (
                  <div className="space-y-4">
                    {/* Conversation starters — most actionable, show first */}
                    {prep.social_intel?.conversation_starters?.length > 0 && (
                      <div className="rounded-2xl p-6"
                        style={{ background: 'linear-gradient(135deg, rgba(245,142,154,0.08), rgba(240,140,174,0.08))', border: '1px solid rgba(245,142,154,0.2)' }}>
                        <h3 className="text-[#F58E9A] text-xs font-bold uppercase tracking-wider mb-4">
                          💬 Use these in the interview
                        </h3>
                        <ul className="space-y-3">
                          {prep.social_intel.conversation_starters.map((s, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-[#F58E9A] font-black flex-shrink-0 text-sm">→</span>
                              <p className="text-[#F4F4F7] text-sm leading-relaxed italic">&ldquo;{s}&rdquo;</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Leadership voice */}
                    {prep.social_intel?.leadership_voice && (
                      <div className="gradient-border-card rounded-2xl p-5">
                        <h3 className="text-[#6AA8F5] text-xs font-bold uppercase tracking-wider mb-2">
                          🎙 What leadership is championing right now
                        </h3>
                        <p className="text-[#C7C7D1] text-sm leading-relaxed">{prep.social_intel.leadership_voice}</p>
                      </div>
                    )}

                    {/* LinkedIn posts */}
                    {prep.social_intel?.linkedin_posts?.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                          <span style={{ background: 'linear-gradient(135deg,#0077B5,#00A0DC)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>in</span>
                          Recent LinkedIn activity
                        </h3>
                        {prep.social_intel.linkedin_posts.map((post, i) => (
                          <div key={i} className="gradient-border-card rounded-xl p-5">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <p className="text-[#C7C7D1] text-sm leading-relaxed">{post.summary}</p>
                              {post.posted && (
                                <span className="text-[#7E7E8E] text-[10px] flex-shrink-0">{post.posted}</span>
                              )}
                            </div>
                            {post.how_to_use && (
                              <div className="rounded-lg p-3" style={{ background: 'rgba(106,168,245,0.06)', border: '1px solid rgba(106,168,245,0.1)' }}>
                                <p className="text-[#6AA8F5] text-[10px] font-bold uppercase tracking-wider mb-1">How to use this</p>
                                <p className="text-[#C7C7D1] text-xs leading-relaxed">{post.how_to_use}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Social themes */}
                    {prep.social_intel?.social_themes?.length > 0 && (
                      <div className="gradient-border-card rounded-2xl p-5">
                        <h3 className="text-[#F08CAE] text-xs font-bold uppercase tracking-wider mb-3">Recurring themes across their social</h3>
                        <div className="flex flex-wrap gap-2">
                          {prep.social_intel.social_themes.map((t, i) => (
                            <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full"
                              style={{ background: 'rgba(240,140,174,0.12)', color: '#F08CAE', border: '1px solid rgba(240,140,174,0.2)' }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {!prep.social_intel && (
                      <div className="gradient-border-card rounded-2xl p-10 text-center">
                        <p className="text-[#7E7E8E] text-sm">No social data found for this company. Try regenerating prep.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* STAR stories */}
                {prepSection === 'stories' && prep.your_stories && (
                  <div className="space-y-4">
                    {prep.your_stories.map((story, i) => (
                      <div key={i} className="gradient-border-card rounded-2xl p-6">
                        <p className="text-[#7E7E8E] text-xs font-bold mb-3">Use for: <span className="text-[#6AA8F5]">&quot;{story.use_for_question}&quot;</span></p>
                        <div className="grid md:grid-cols-2 gap-4">
                          {[
                            { label: 'S — Situation', content: story.situation, color: '#F08CAE' },
                            { label: 'T — Task', content: story.task, color: '#6AA8F5' },
                            { label: 'A — Action', content: story.action, color: '#F58E9A' },
                            { label: 'R — Result', content: story.result, color: '#6AA8F5' },
                          ].map(({ label, content, color }) => (
                            <div key={label}>
                              <p className="text-xs font-bold mb-1" style={{ color }}>{label}</p>
                              <p className="text-[#C7C7D1] text-sm leading-relaxed">{content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Likely questions */}
                {prepSection === 'questions' && prep.likely_questions && (
                  <div className="space-y-4">
                    {prep.likely_questions.map((q, i) => (
                      <div key={i} className="gradient-border-card rounded-2xl p-6">
                        <h3 className="text-[#F4F4F7] font-bold mb-3">&ldquo;{q.question}&rdquo;</h3>
                        <div className="space-y-3">
                          <div>
                            <p className="text-[#6AA8F5] text-xs font-bold mb-1">Your angle</p>
                            <p className="text-[#C7C7D1] text-sm leading-relaxed">{q.your_answer_angle}</p>
                          </div>
                          {q.watch_out_for && (
                            <div>
                              <p className="text-[#F58E9A] text-xs font-bold mb-1">⚠️ Watch out for</p>
                              <p className="text-[#C7C7D1] text-sm leading-relaxed">{q.watch_out_for}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Questions to ask */}
                {prepSection === 'ask' && (
                  <div className="gradient-border-card rounded-2xl p-6">
                    <h3 className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider mb-4">Questions to ask them</h3>
                    <ul className="space-y-4">
                      {prep.questions_to_ask_them?.map((q, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-[#F08CAE] font-black flex-shrink-0">Q{i + 1}</span>
                          <p className="text-[#C7C7D1] text-sm leading-relaxed">{q}</p>
                        </li>
                      ))}
                    </ul>
                    {prep.red_flags_to_probe?.length > 0 && (
                      <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.08)]">
                        <h3 className="text-[#F58E9A] text-xs font-bold uppercase tracking-wider mb-3">Red flags to probe</h3>
                        <ul className="space-y-2">
                          {prep.red_flags_to_probe.map((r, i) => (
                            <li key={i} className="text-[#C7C7D1] text-sm leading-relaxed">⚠️ {r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Salary */}
                {prepSection === 'salary' && (
                  <div className="gradient-border-card rounded-2xl p-6">
                    <h3 className="text-[#6AA8F5] text-xs font-bold uppercase tracking-wider mb-4">Salary intelligence</h3>
                    <p className="text-[#C7C7D1] text-sm leading-relaxed">{prep.salary_intel}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
