'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type WorkEntry = { title: string; company: string; start: string; end: string; achievements: string }

export default function EditProfile() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [fullName, setFullName] = useState('')
  const [headline, setHeadline] = useState('')
  const [location, setLocation] = useState('')
  const [summary, setSummary] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [skillsRaw, setSkillsRaw] = useState('') // comma-separated
  const [workHistory, setWorkHistory] = useState<WorkEntry[]>([])
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')

  useEffect(() => {
    fetch('/api/profile/get')
      .then(r => r.json())
      .then(({ profile: data }) => {
        if (!data) return
        setFullName(data.full_name || '')
        setHeadline(data.headline || '')
        setLocation(data.location || '')
        setSummary(data.summary || '')
        setWhatsapp(data.whatsapp_number || '')
        setSkillsRaw(Array.isArray(data.skills) ? data.skills.join(', ') : '')
        setLinkedinUrl(data.linkedin_url || '')
        setGithubUrl(data.github_url || '')
        setWebsiteUrl(data.website_url || '')
        setPortfolioUrl(data.portfolio_url || '')
        setWorkHistory(
          Array.isArray(data.work_history)
            ? data.work_history.map((w: Partial<WorkEntry>) => ({
                title: w.title || '', company: w.company || '',
                start: w.start || '', end: w.end || '', achievements: w.achievements || '',
              }))
            : []
        )
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const addJob = () => setWorkHistory(prev => [...prev, { title: '', company: '', start: '', end: '', achievements: '' }])
  const removeJob = (i: number) => setWorkHistory(prev => prev.filter((_, j) => j !== i))
  const updateJob = (i: number, field: keyof WorkEntry, value: string) =>
    setWorkHistory(prev => prev.map((w, j) => j === i ? { ...w, [field]: value } : w))

  const save = async () => {
    setSaving(true)
    setError('')
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName.trim() || null,
        headline: headline.trim() || null,
        location: location.trim() || null,
        summary: summary.trim() || null,
        whatsapp_number: whatsapp.trim() || null,
        skills: skillsRaw.split(',').map(s => s.trim()).filter(Boolean),
        work_history: workHistory.filter(w => w.title || w.company),
        linkedin_url: linkedinUrl.trim() || null,
        github_url: githubUrl.trim() || null,
        website_url: websiteUrl.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to save — try again')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#22D3EE] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.15), rgba(139,92,246,0.15)) border-box;
          border: 1px solid transparent;
        }
        .field { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: white; outline: none; transition: border-color 0.2s; }
        .field::placeholder { color: rgba(255,255,255,0.2); }
        .field:focus { border-color: rgba(34,211,238,0.5); }
        label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.35); margin-bottom: 8px; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.07) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-3xl mx-auto border-b border-white/[0.05]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <div className="flex items-center gap-4">
          {saved && <span className="text-emerald-400 text-sm font-semibold">✓ Saved</span>}
          <Link href="/profile" className="text-white/40 text-sm hover:text-white/70 transition-colors">← Profile</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Edit your profile.</h1>
          <p className="text-white/35 text-sm">Changes update your profile page and both CV versions immediately.</p>
        </div>

        {error && (
          <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3 mb-6 text-sm text-[#FB7185]">{error}</div>
        )}

        {/* Basic info */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-4">
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Basic info</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label>Full name</label>
              <input className="field" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ana O. Barber" />
            </div>
            <div>
              <label>Location</label>
              <input className="field" value={location} onChange={e => setLocation(e.target.value)} placeholder="Dubai, UAE" />
            </div>
          </div>
          <div>
            <label>Professional headline</label>
            <input className="field" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Head of Studio Operations · NEOM" />
          </div>
          <div>
            <label>WhatsApp number</label>
            <input className="field" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+966 50 250 6355" />
          </div>
        </div>

        {/* Summary */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5">
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">Profile summary</p>
          <label>Summary</label>
          <textarea
            className="field"
            rows={4}
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="A short paragraph about your experience and what you bring..."
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Skills */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5">
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">Skills</p>
          <label>Skills (comma separated)</label>
          <input
            className="field"
            value={skillsRaw}
            onChange={e => setSkillsRaw(e.target.value)}
            placeholder="Project management, AutoCAD, Budget control, Stakeholder management"
          />
          {skillsRaw && (
            <div className="flex flex-wrap gap-2 mt-3">
              {skillsRaw.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                <span key={i} className="bg-white/[0.06] text-white/60 text-xs px-3 py-1.5 rounded-full">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Work history */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Work history</p>
            <button onClick={addJob}
              className="text-xs text-[#22D3EE] font-bold hover:opacity-80 transition-opacity flex items-center gap-1">
              + Add role
            </button>
          </div>

          {workHistory.length === 0 && (
            <p className="text-white/25 text-sm text-center py-4">No roles yet — click &ldquo;Add role&rdquo; to start.</p>
          )}

          <div className="space-y-6">
            {workHistory.map((job, i) => (
              <div key={i} className={`${i > 0 ? 'pt-6 border-t border-white/[0.06]' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/40 text-xs font-bold">Role {i + 1}</p>
                  <button onClick={() => removeJob(i)} className="text-[#FB7185]/60 text-xs hover:text-[#FB7185] transition-colors">Remove</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label>Job title</label>
                    <input className="field" value={job.title} onChange={e => updateJob(i, 'title', e.target.value)} placeholder="Head of Operations" />
                  </div>
                  <div>
                    <label>Company</label>
                    <input className="field" value={job.company} onChange={e => updateJob(i, 'company', e.target.value)} placeholder="NEOM" />
                  </div>
                  <div>
                    <label>Start</label>
                    <input className="field" value={job.start} onChange={e => updateJob(i, 'start', e.target.value)} placeholder="2022" />
                  </div>
                  <div>
                    <label>End (leave blank if current)</label>
                    <input className="field" value={job.end} onChange={e => updateJob(i, 'end', e.target.value)} placeholder="Present" />
                  </div>
                </div>
                <div>
                  <label>Achievements & responsibilities</label>
                  <textarea
                    className="field"
                    rows={3}
                    value={job.achievements}
                    onChange={e => updateJob(i, 'achievements', e.target.value)}
                    placeholder="Key achievements, impact, outcomes..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Links & online presence */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-4">
          <div>
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Links & online presence</p>
            <p className="text-white/20 text-xs mt-1">Shown on your public profile. All optional.</p>
          </div>
          <div>
            <label>LinkedIn URL</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm font-bold select-none">in</span>
              <input
                className="field"
                style={{ paddingLeft: 32 }}
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/yourname"
                type="url"
              />
            </div>
          </div>
          <div>
            <label>GitHub URL</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-xs select-none">{'</>'}</span>
              <input
                className="field"
                style={{ paddingLeft: 36 }}
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder="https://github.com/yourname"
                type="url"
              />
            </div>
          </div>
          <div>
            <label>Personal website</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-xs select-none">🌐</span>
              <input
                className="field"
                style={{ paddingLeft: 30 }}
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://yourname.com"
                type="url"
              />
            </div>
          </div>
          <div>
            <label>Portfolio / project URL</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-xs select-none">🗂</span>
              <input
                className="field"
                style={{ paddingLeft: 30 }}
                value={portfolioUrl}
                onChange={e => setPortfolioUrl(e.target.value)}
                placeholder="https://behance.net/yourname or github repo"
                type="url"
              />
            </div>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes →'}
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="w-full py-3 text-sm text-white/25 hover:text-white/50 transition-colors mt-2"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
