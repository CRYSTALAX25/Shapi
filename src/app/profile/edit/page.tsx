'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SUPPORTED_INDUSTRIES, INDUSTRY_META } from '@/lib/industry-briefs'

type WorkEntry = { title: string; company: string; start: string; end: string; achievements: string }
type LanguageEntry = { language: string; level: string }
type RtwEntry = { region: string; basis: string }
type PivotBand = { track: string; min: string; max: string; note: string }

const INTENT_OPTIONS = [
  { value: 'actively_looking', label: 'Actively looking', sub: 'Ready to move now' },
  { value: 'open', label: 'Open to offers', sub: 'Happy where I am, open to the right thing' },
  { value: 'not_looking', label: 'Not looking', sub: 'Profile stays private' },
]
const CURRENCIES = ['AED', 'SAR', 'USD', 'GBP', 'EUR', 'QAR', 'KWD', 'BHD', 'OMR']

const RTW_BASIS = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'permanent_resident', label: 'Permanent Resident' },
  { value: 'work_visa', label: 'Work Visa' },
  { value: 'eu_citizen', label: 'EU/EEA citizen' },
  { value: 'need_sponsorship', label: 'Needs sponsorship' },
]

const PROFICIENCY_LEVELS = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Conversational', 'Basic']

// CEFR + IELTS explainers — shown in info tooltips so candidates know what their scores mean
const CEFR_INFO: Record<string, string> = {
  A1: 'Beginner — can use basic phrases and introduce themselves.',
  A2: 'Elementary — can handle simple daily interactions.',
  B1: 'Intermediate — can deal with most situations while travelling, write basic emails.',
  B2: 'Upper-intermediate — can communicate fluently with native speakers, write clear texts on familiar topics.',
  C1: 'Advanced — can express ideas fluently and use the language flexibly for social, academic and professional purposes.',
  C2: 'Mastery / near-native — can understand virtually everything and express themselves spontaneously, precisely and finely.',
}

const IELTS_BAND_INFO: Record<string, string> = {
  '0-3': 'Limited / very basic user',
  '3-4': 'Limited user — basic competence',
  '4-5': 'Modest user — can handle straightforward situations',
  '5-6': 'Modest to competent — generally effective communicator',
  '6-7': 'Competent user — generally effective despite some inaccuracies',
  '7-8': 'Good to very good user — full operational command, handles complex language',
  '8-9': 'Very good to expert — fully fluent, idiomatic, accurate',
}

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
  const [nationality, setNationality] = useState('')
  const [nativeLanguage, setNativeLanguage] = useState('')
  const [languagesSpoken, setLanguagesSpoken] = useState<LanguageEntry[]>([])
  const [languageProficiency, setLanguageProficiency] = useState<{
    conversation_language?: string
    cefr_level?: string
    ielts_equivalent?: string
    english_level?: string
    proficiency_notes?: string
  } | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [rightToWork, setRightToWork] = useState<RtwEntry[]>([])
  // Availability + salary
  const [jobSearchStatus, setJobSearchStatus] = useState('open')
  const [salCurrency, setSalCurrency] = useState('AED')
  const [salPeriod, setSalPeriod] = useState<'month' | 'year'>('month')
  const [salAllowances, setSalAllowances] = useState(true)
  const [salFlexible, setSalFlexible] = useState(true)
  const [primaryTrack, setPrimaryTrack] = useState('')
  const [primaryMin, setPrimaryMin] = useState('')
  const [primaryMax, setPrimaryMax] = useState('')
  const [pivotBands, setPivotBands] = useState<PivotBand[]>([])
  const [openToEngagement, setOpenToEngagement] = useState<string[]>([])
  const [targetRolesRaw, setTargetRolesRaw] = useState('')
  const [targetIndustries, setTargetIndustries] = useState<string[]>([])

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
        setNationality(data.nationality || '')
        setNativeLanguage(data.native_language || '')
        setLanguagesSpoken(
          Array.isArray(data.languages_spoken)
            ? data.languages_spoken.map((l: { language?: string; level?: string }) => ({
                language: l.language || '', level: l.level || 'Fluent',
              }))
            : []
        )
        setLanguageProficiency(data.language_proficiency || null)
        setProfileImageUrl(data.profile_image_url || '')
        setRightToWork(
          Array.isArray(data.right_to_work)
            ? data.right_to_work.map((r: { region?: string; basis?: string }) => ({ region: r.region || '', basis: r.basis || 'citizen' }))
            : []
        )
        setJobSearchStatus(data.job_search_status || 'open')
        setOpenToEngagement(Array.isArray(data.open_to_engagement) ? data.open_to_engagement : [])
        setTargetRolesRaw(Array.isArray(data.target_roles) ? data.target_roles.join(', ') : '')
        setTargetIndustries(Array.isArray(data.target_industries) ? data.target_industries : [])
        const se = data.salary_expectations
        if (se && typeof se === 'object') {
          setSalCurrency(se.currency || 'AED')
          setSalPeriod(se.period === 'year' ? 'year' : 'month')
          setSalAllowances(se.includes_allowances !== false)
          setSalFlexible(se.flexible !== false)
          setPrimaryTrack(se.primary?.track || '')
          setPrimaryMin(se.primary?.min != null ? String(se.primary.min) : '')
          setPrimaryMax(se.primary?.max != null ? String(se.primary.max) : '')
          setPivotBands(
            Array.isArray(se.pivots)
              ? se.pivots.map((p: { track?: string; min?: number; max?: number; note?: string }) => ({
                  track: p.track || '', min: p.min != null ? String(p.min) : '', max: p.max != null ? String(p.max) : '', note: p.note || '',
                }))
              : []
          )
        }
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

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    setUploadingImage(false)
    if (res.ok && d.url) setProfileImageUrl(d.url)
    else setError(d.error || 'Image upload failed')
  }

  const addRtw = () => setRightToWork(prev => [...prev, { region: '', basis: 'citizen' }])
  const removeRtw = (i: number) => setRightToWork(prev => prev.filter((_, j) => j !== i))
  const updateRtw = (i: number, field: keyof RtwEntry, value: string) =>
    setRightToWork(prev => prev.map((r, j) => j === i ? { ...r, [field]: value } : r))
  const updateJob = (i: number, field: keyof WorkEntry, value: string) =>
    setWorkHistory(prev => prev.map((w, j) => j === i ? { ...w, [field]: value } : w))

  const addPivot = () => setPivotBands(prev => [...prev, { track: '', min: '', max: '', note: '' }])
  const removePivot = (i: number) => setPivotBands(prev => prev.filter((_, j) => j !== i))
  const updatePivot = (i: number, field: keyof PivotBand, value: string) =>
    setPivotBands(prev => prev.map((p, j) => j === i ? { ...p, [field]: value } : p))

  const numOrNull = (s: string) => { const n = parseInt(s.replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null }

  const save = async () => {
    setSaving(true)
    setError('')
    const hasPrimary = primaryMin || primaryMax || primaryTrack
    const salaryExpectations = (hasPrimary || pivotBands.length > 0)
      ? {
          currency: salCurrency,
          period: salPeriod,
          includes_allowances: salAllowances,
          flexible: salFlexible,
          primary: hasPrimary ? { track: primaryTrack.trim() || null, min: numOrNull(primaryMin), max: numOrNull(primaryMax) } : null,
          pivots: pivotBands
            .filter(p => p.track.trim() || p.min || p.max)
            .map(p => ({ track: p.track.trim(), min: numOrNull(p.min), max: numOrNull(p.max), note: p.note.trim() || null })),
        }
      : null
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_search_status: jobSearchStatus,
        open_to_engagement: openToEngagement,
        target_roles: targetRolesRaw.split(',').map(s => s.trim()).filter(Boolean),
        target_industries: targetIndustries,
        salary_expectations: salaryExpectations,
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
        nationality: nationality.trim() || null,
        native_language: nativeLanguage.trim() || null,
        languages_spoken: languagesSpoken
          .filter(l => l.language.trim().length > 0)
          .map(l => ({ language: l.language.trim(), level: l.level })),
        right_to_work: rightToWork
          .filter(r => r.region.trim().length > 0)
          .map(r => ({ region: r.region.trim(), basis: r.basis, verified: false })),
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
      <div className="min-h-screen bg-[#0E0E13] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/[0.08] border-t-[#6AA8F5] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.15), rgba(240,140,174,0.15)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .field { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: #F4F4F7; outline: none; transition: border-color 0.2s; }
        .field::placeholder { color: #7E7E8E; }
        .field:focus { border-color: rgba(106,168,245,0.5); }
        label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #7E7E8E; margin-bottom: 8px; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-3xl mx-auto border-b border-white/[0.08]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <div className="flex items-center gap-4">
          {saved && <span className="text-emerald-400 text-sm font-semibold">✓ Saved</span>}
          <Link href="/profile" className="text-[#A6A6B4] text-sm hover:text-[#C7C7D1] transition-colors">← Profile</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2" style={{ color: '#FB7185' }}>Edit your profile.</h1>
          <p className="text-[#7E7E8E] text-sm">Changes update your profile page and both CV versions immediately.</p>
        </div>

        {error && (
          <div className="bg-[#F58E9A]/10 border border-[#F58E9A]/20 rounded-xl px-4 py-3 mb-6 text-sm text-[#F58E9A]">{error}</div>
        )}

        {/* Basic info */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-4">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Basic info</p>

          {/* Profile photo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {profileImageUrl
                ? <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                : <span className="text-[#7E7E8E] text-2xl">{(fullName || '?').charAt(0).toUpperCase()}</span>}
            </div>
            <div>
              <label>Profile photo</label>
              <label className="inline-block cursor-pointer text-xs font-bold px-3 py-2 rounded-lg" style={{ background: 'rgba(106,168,245,0.1)', color: '#6AA8F5', border: '1px solid rgba(106,168,245,0.25)' }}>
                {uploadingImage ? 'Uploading…' : profileImageUrl ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }} />
              </label>
              <p className="text-[#7E7E8E] text-[10px] mt-1">JPG/PNG/WebP, under 5MB</p>
            </div>
          </div>

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
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-4">Profile summary</p>
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
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-4">Skills</p>
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
                <span key={i} className="bg-white/[0.05] text-[#C7C7D1] text-xs px-3 py-1.5 rounded-full">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Work history */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Work history</p>
            <button onClick={addJob}
              className="text-xs text-[#6AA8F5] font-bold hover:opacity-80 transition-opacity flex items-center gap-1">
              + Add role
            </button>
          </div>

          {workHistory.length === 0 && (
            <p className="text-[#7E7E8E] text-sm text-center py-4">No roles yet — click &ldquo;Add role&rdquo; to start.</p>
          )}

          <div className="space-y-6">
            {workHistory.map((job, i) => (
              <div key={i} className={`${i > 0 ? 'pt-6 border-t border-white/[0.08]' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[#A6A6B4] text-xs font-bold">Role {i + 1}</p>
                  <button onClick={() => removeJob(i)} className="text-[#F58E9A]/60 text-xs hover:text-[#F58E9A] transition-colors">Remove</button>
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
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Links & online presence</p>
            <p className="text-[#5C5C6A] text-xs mt-1">Shown on your public profile. All optional.</p>
          </div>
          <div>
            <label>LinkedIn URL</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C6A] text-sm font-bold select-none">in</span>
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C6A] text-xs select-none">{'</>'}</span>
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C6A] text-xs select-none">🌐</span>
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C6A] text-xs select-none">🗂</span>
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

        {/* Identity & Languages */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-4">
          <div>
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Identity & languages</p>
            <p className="text-[#5C5C6A] text-xs mt-1">Detected from your CV. Correct if anything is wrong — used for native language CV generation.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label>Nationality</label>
              <input
                className="field"
                value={nationality}
                onChange={e => setNationality(e.target.value)}
                placeholder="e.g. Croatian, British, Saudi Arabian"
              />
            </div>
            <div>
              <label>Native language</label>
              <input
                className="field"
                value={nativeLanguage}
                onChange={e => setNativeLanguage(e.target.value)}
                placeholder="e.g. Croatian, Arabic, French"
              />
            </div>
          </div>

          {/* Other languages spoken — full editable list. Drives the multi-language
              CV picker on cv-ready + the WhatsApp language picker options. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="!mb-0">Languages you speak</label>
              <button
                type="button"
                onClick={() => setLanguagesSpoken(prev => [...prev, { language: '', level: 'Fluent' }])}
                className="text-[#6AA8F5] text-xs font-bold hover:opacity-80"
              >
                + Add language
              </button>
            </div>
            <p className="text-[#7E7E8E] text-xs mb-3">
              Add every language you speak. Each unlocks a CV in that language on the download page.
            </p>
            {languagesSpoken.length === 0 ? (
              <p className="text-[#7E7E8E] text-xs italic">No languages added yet — click &quot;Add language&quot; above.</p>
            ) : (
              <div className="space-y-2">
                {languagesSpoken.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="field"
                      value={l.language}
                      onChange={e => setLanguagesSpoken(prev => prev.map((x, j) => j === i ? { ...x, language: e.target.value } : x))}
                      placeholder="e.g. Italian"
                      style={{ flex: 2 }}
                    />
                    <select
                      value={l.level}
                      onChange={e => setLanguagesSpoken(prev => prev.map((x, j) => j === i ? { ...x, level: e.target.value } : x))}
                      className="field"
                      style={{ flex: 1, minWidth: 120 }}
                    >
                      {PROFICIENCY_LEVELS.map(lvl => (
                        <option key={lvl} value={lvl} style={{ background: '#16161F' }}>{lvl}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setLanguagesSpoken(prev => prev.filter((_, j) => j !== i))}
                      className="text-[#7E7E8E] hover:text-[#F58E9A] text-lg px-2"
                      aria-label="Remove language"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right to work — multi-entry (you can have rights in several places) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="!mb-0">Right to work</label>
              <button type="button" onClick={addRtw} className="text-[#6AA8F5] text-xs font-bold hover:opacity-80">+ Add country/region</button>
            </div>
            <p className="text-[#7E7E8E] text-xs mb-3">
              Where you&apos;re authorised to work, and on what basis. Add all that apply (e.g. UK PR, Saudi PR, EU/EEA via citizenship). Shown as self-reported until document-verified.
            </p>
            {rightToWork.length === 0 ? (
              <p className="text-[#7E7E8E] text-xs italic">None added yet — click &quot;Add country/region&quot;.</p>
            ) : (
              <div className="space-y-2">
                {rightToWork.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="field"
                      value={r.region}
                      onChange={e => updateRtw(i, 'region', e.target.value)}
                      placeholder="e.g. United Kingdom, Saudi Arabia, EU/EEA"
                      style={{ flex: 2 }}
                    />
                    <select
                      value={r.basis}
                      onChange={e => updateRtw(i, 'basis', e.target.value)}
                      className="field"
                      style={{ flex: 1, minWidth: 150 }}
                    >
                      {RTW_BASIS.map(b => (
                        <option key={b.value} value={b.value} style={{ background: '#16161F' }}>{b.label}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeRtw(i)} className="text-[#7E7E8E] hover:text-[#F58E9A] text-lg px-2" aria-label="Remove">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Language proficiency — read-only, set by WhatsApp analysis */}
          {languageProficiency && (
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
              <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider mb-3">Language proficiency — assessed from WhatsApp</p>
              <div className="flex flex-wrap gap-3">
                {languageProficiency.cefr_level && (
                  <div
                    className="bg-[#6AA8F5]/10 border border-[#6AA8F5]/20 rounded-xl px-4 py-2 text-center cursor-help"
                    title={`CEFR ${languageProficiency.cefr_level} (${languageProficiency.conversation_language || 'detected language'}): ${CEFR_INFO[languageProficiency.cefr_level] || 'Common European Framework of Reference for Languages — international standard for language proficiency from A1 (beginner) to C2 (mastery).'}`}
                  >
                    <p className="text-[#6AA8F5] text-lg font-black">{languageProficiency.cefr_level}</p>
                    <p className="text-[#7E7E8E] text-xs">CEFR · {languageProficiency.conversation_language || 'Language'} <span className="opacity-50">ⓘ</span></p>
                  </div>
                )}
                {languageProficiency.ielts_equivalent && (
                  <div
                    className="bg-[#F08CAE]/10 border border-[#F08CAE]/20 rounded-xl px-4 py-2 text-center cursor-help"
                    title={`IELTS ${languageProficiency.ielts_equivalent}: International English Language Testing System band. ${IELTS_BAND_INFO[languageProficiency.ielts_equivalent.replace(/[^0-9-]/g, '')] || 'Bands range 0 (no English) to 9 (expert/native).'}`}
                  >
                    <p className="text-[#F08CAE] text-lg font-black">{languageProficiency.ielts_equivalent}</p>
                    <p className="text-[#7E7E8E] text-xs">IELTS equivalent <span className="opacity-50">ⓘ</span></p>
                  </div>
                )}
                {languageProficiency.english_level && languageProficiency.english_level !== 'unassessed' && (
                  <div
                    className="bg-[#F58E9A]/10 border border-[#F58E9A]/20 rounded-xl px-4 py-2 text-center cursor-help"
                    title={`English CEFR ${languageProficiency.english_level}: ${CEFR_INFO[languageProficiency.english_level] || 'Common European Framework level for English specifically — A1 (beginner) through C2 (mastery).'}`}
                  >
                    <p className="text-[#F58E9A] text-lg font-black">{languageProficiency.english_level}</p>
                    <p className="text-[#7E7E8E] text-xs">English CEFR <span className="opacity-50">ⓘ</span></p>
                  </div>
                )}
              </div>
              {/* Mini CEFR scale legend, always visible — helps non-technical candidates calibrate */}
              <div className="mt-3 p-2 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                <p className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-1">CEFR scale (hover any badge for detail)</p>
                <p className="text-[#A6A6B4] text-xs leading-relaxed">
                  <strong className="text-[#C7C7D1]">A1/A2</strong> Beginner · <strong className="text-[#C7C7D1]">B1/B2</strong> Intermediate (B2 = fluent professional) · <strong className="text-[#C7C7D1]">C1/C2</strong> Advanced / near-native
                </p>
              </div>
              {languageProficiency.proficiency_notes && (
                <p className="text-[#7E7E8E] text-xs mt-3 leading-relaxed">{languageProficiency.proficiency_notes}</p>
              )}
              <p className="text-[#5C5C6A] text-xs mt-2">Assessed automatically — complete more of your WhatsApp conversation to improve accuracy.</p>
            </div>
          )}
        </div>

        {/* Availability & salary */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-5">
          <div>
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Availability & salary</p>
            <p className="text-[#5C5C6A] text-xs mt-1">Your salary expectations are <span className="font-bold text-[#A6A6B4]">private</span> — used for matching and shown only to companies you match with.</p>
          </div>

          {/* Intent status */}
          <div>
            <label>I&apos;m currently</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {INTENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setJobSearchStatus(opt.value)}
                  className="text-left rounded-xl px-4 py-3 transition-all"
                  style={jobSearchStatus === opt.value
                    ? { background: 'rgba(106,168,245,0.1)', border: '1px solid rgba(106,168,245,0.45)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <p className="text-sm font-bold" style={{ color: jobSearchStatus === opt.value ? '#6AA8F5' : '#A6A6B4' }}>{opt.label}</p>
                  <p className="text-[#7E7E8E] text-[11px] mt-0.5 leading-tight">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Open to engagement types */}
          <div>
            <label>Open to</label>
            <div className="flex flex-wrap gap-2">
              {([
                { v: 'permanent', l: 'Permanent' },
                { v: 'contract', l: 'Contract' },
                { v: 'temp', l: 'Temp / Shift' },
              ] as const).map(o => {
                const on = openToEngagement.includes(o.v)
                return (
                  <button key={o.v} type="button"
                    onClick={() => setOpenToEngagement(prev => on ? prev.filter(x => x !== o.v) : [...prev, o.v])}
                    className="text-sm font-bold px-4 py-2 rounded-full transition-all"
                    style={on
                      ? { background: 'rgba(106,168,245,0.12)', border: '1px solid rgba(106,168,245,0.45)', color: '#6AA8F5' }
                      : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#A6A6B4' }}>
                    {on ? '✓ ' : ''}{o.l}
                  </button>
                )
              })}
            </div>
            <p className="text-[#7E7E8E] text-xs mt-2">Which kinds of work you&apos;ll consider. Helps us match you to the right roles.</p>
          </div>

          {/* Looking for — roles + industries */}
          <div>
            <label>Roles you&apos;re looking for</label>
            <input className="field" value={targetRolesRaw} onChange={e => setTargetRolesRaw(e.target.value)}
              placeholder="e.g. Head of Operations, Chief of Staff, COO" />
            {targetRolesRaw && (
              <div className="flex flex-wrap gap-2 mt-2">
                {targetRolesRaw.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                  <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(106,168,245,0.10)', color: '#6AA8F5' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label>Target industries</label>
            <p className="text-[#7E7E8E] text-xs mb-2">We&apos;ll surface you for these — and lead with the matching CV when a company in that field views you.</p>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_INDUSTRIES.map(ind => {
                const on = targetIndustries.includes(ind)
                const meta = INDUSTRY_META[ind]
                return (
                  <button key={ind} type="button"
                    onClick={() => setTargetIndustries(prev => on ? prev.filter(x => x !== ind) : [...prev, ind])}
                    className="text-sm font-bold px-3 py-1.5 rounded-full transition-all"
                    style={on
                      ? { background: 'rgba(240,140,174,0.12)', border: '1px solid rgba(240,140,174,0.45)', color: '#F08CAE' }
                      : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#A6A6B4' }}>
                    {meta.emoji} {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Salary settings */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label>Currency</label>
              <select className="field" value={salCurrency} onChange={e => setSalCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#16161F' }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Per</label>
              <select className="field" value={salPeriod} onChange={e => setSalPeriod(e.target.value as 'month' | 'year')}>
                <option value="month" style={{ background: '#16161F' }}>Month</option>
                <option value="year" style={{ background: '#16161F' }}>Year</option>
              </select>
            </div>
            <label className="flex items-end gap-2 pb-3 cursor-pointer">
              <input type="checkbox" checked={salAllowances} onChange={e => setSalAllowances(e.target.checked)} className="w-4 h-4 accent-[#6AA8F5]" />
              <span className="text-[#C7C7D1] text-xs font-medium normal-case tracking-normal">Incl. allowances</span>
            </label>
            <label className="flex items-end gap-2 pb-3 cursor-pointer">
              <input type="checkbox" checked={salFlexible} onChange={e => setSalFlexible(e.target.checked)} className="w-4 h-4 accent-[#6AA8F5]" />
              <span className="text-[#C7C7D1] text-xs font-medium normal-case tracking-normal">Negotiable</span>
            </label>
          </div>

          {/* Primary expectation */}
          <div>
            <label>Primary expectation — your main field</label>
            <p className="text-[#7E7E8E] text-xs mb-2">Where you have the experience and references to back it up.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input className="field" value={primaryTrack} onChange={e => setPrimaryTrack(e.target.value)} placeholder="Field, e.g. Operations" />
              <input className="field" value={primaryMin} onChange={e => setPrimaryMin(e.target.value)} placeholder={`Min (${salCurrency})`} inputMode="numeric" />
              <input className="field" value={primaryMax} onChange={e => setPrimaryMax(e.target.value)} placeholder={`Max (${salCurrency})`} inputMode="numeric" />
            </div>
          </div>

          {/* Pivot bands */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="!mb-0">Pivot tracks — open from a lower band</label>
              <button type="button" onClick={addPivot} className="text-[#6AA8F5] text-xs font-bold hover:opacity-80">+ Add track</button>
            </div>
            <p className="text-[#7E7E8E] text-xs mb-3">
              Exploring a new field where you&apos;re still building experience? Set a fair, lower band for it — it rises as you upskill. Companies hiring for that track see the right number.
            </p>
            {pivotBands.length === 0 ? (
              <p className="text-[#7E7E8E] text-xs italic">None yet — add a track you&apos;re open to at a different rate.</p>
            ) : (
              <div className="space-y-3">
                {pivotBands.map((p, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(14,14,26,0.04)', border: '1px solid rgba(14,14,26,0.08)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#7E7E8E] text-[11px] font-bold uppercase tracking-wider">Pivot track {i + 1}</span>
                      <button type="button" onClick={() => removePivot(i)} className="text-[#7E7E8E] hover:text-[#F58E9A] text-sm">✕</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                      <input className="field" value={p.track} onChange={e => updatePivot(i, 'track', e.target.value)} placeholder="Track, e.g. UX Design" />
                      <input className="field" value={p.min} onChange={e => updatePivot(i, 'min', e.target.value)} placeholder={`Open from (${salCurrency})`} inputMode="numeric" />
                      <input className="field" value={p.max} onChange={e => updatePivot(i, 'max', e.target.value)} placeholder={`Up to (${salCurrency})`} inputMode="numeric" />
                    </div>
                    <input className="field" value={p.note} onChange={e => updatePivot(i, 'note', e.target.value)} placeholder="Note, e.g. completing Google UX certificate" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes →'}
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="w-full py-3 text-sm text-[#7E7E8E] hover:text-[#A6A6B4] transition-colors mt-2"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
