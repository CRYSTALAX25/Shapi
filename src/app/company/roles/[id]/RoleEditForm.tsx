'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type EditableRole = {
  id: string
  title: string
  department: string | null
  location: string | null
  remote: boolean | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_visible: boolean | null
  engagement_type: string | null
  accepts_pivot_candidates: boolean | null
  description: string | null
  requirements: string | null
  hiring_notes: string | null
  must_have_skills: string[] | null
  nice_to_have_skills: string[] | null
  status: string
  created_at: string
}

const CURRENCIES = ['USD', 'AED', 'SAR', 'GBP', 'EUR', 'INR']

export default function RoleEditForm({ role, fromWhatsApp }: { role: EditableRole; fromWhatsApp: boolean }) {
  const router = useRouter()

  const [title, setTitle] = useState(role.title || '')
  const [department, setDepartment] = useState(role.department || '')
  const [location, setLocation] = useState(role.location || '')
  const [remote, setRemote] = useState(!!role.remote)
  const [salaryMin, setSalaryMin] = useState(role.salary_min ? String(role.salary_min) : '')
  const [salaryMax, setSalaryMax] = useState(role.salary_max ? String(role.salary_max) : '')
  const [currency, setCurrency] = useState(role.salary_currency || 'USD')
  const [salaryVisible, setSalaryVisible] = useState(role.salary_visible !== false)
  const [engagementType, setEngagementType] = useState<'permanent' | 'contract' | 'temp'>(
    (['permanent', 'contract', 'temp'].includes(role.engagement_type || '') ? role.engagement_type : 'permanent') as 'permanent' | 'contract' | 'temp'
  )
  const [acceptsPivot, setAcceptsPivot] = useState(!!role.accepts_pivot_candidates)
  const [description, setDescription] = useState(role.description || '')
  const [requirements, setRequirements] = useState(role.requirements || '')
  const [hiringNotes, setHiringNotes] = useState(role.hiring_notes || '')

  const [status, setStatus] = useState(role.status)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const patch = async (extra: Record<string, unknown> = {}, opts: { silent?: boolean } = {}) => {
    setError('')
    if (!opts.silent) setSaving(true)
    setSaved(false)

    const body = {
      title: title.trim(),
      department: department.trim() || null,
      location: location.trim() || null,
      remote,
      salary_min: salaryMin ? parseInt(salaryMin) : null,
      salary_max: salaryMax ? parseInt(salaryMax) : null,
      salary_currency: currency,
      salary_visible: salaryVisible,
      engagement_type: engagementType,
      accepts_pivot_candidates: acceptsPivot,
      description,
      requirements,
      hiring_notes: hiringNotes,
      ...extra,
    }

    try {
      const res = await fetch(`/api/company/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Save failed — try again'); return false }
      if (d.role?.status) setStatus(d.role.status)
      setSaved(true)
      router.refresh()
      return true
    } catch {
      setError('Save failed — try again')
      return false
    } finally {
      setSaving(false)
    }
  }

  const save = () => {
    if (!title.trim()) { setError('Role title is required'); return }
    if (salaryMin && salaryMax && parseInt(salaryMin) >= parseInt(salaryMax)) {
      setError('Salary max must be greater than min'); return
    }
    patch()
  }

  const publish = () => {
    if (!title.trim()) { setError('Add a title before publishing'); return }
    if (!salaryMin || !salaryMax) { setError('Add a salary range before publishing — it is required'); return }
    patch({ status: 'active' })
  }

  const unpublish = () => patch({ status: 'draft' })
  const close = () => patch({ status: 'closed' })
  const reopen = () => patch({ status: 'active' })

  const remove = async () => {
    if (!confirm('Delete this role permanently? This cannot be undone.')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/company/roles/${role.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Delete failed'); return }
      router.push('/company/roles')
    } catch {
      setError('Delete failed — try again')
    } finally {
      setSaving(false)
    }
  }

  const statusBadge =
    status === 'active' ? { label: 'Active', bg: 'rgba(157, 140, 255, 0.12)', c: '#9D8CFF' } :
    status === 'closed' ? { label: 'Closed', bg: 'rgba(251, 113, 133, 0.12)', c: '#FB7185' } :
    { label: 'Draft', bg: 'rgba(251,191,36,0.12)', c: '#FBBF24' }

  return (
    <>
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(157, 140, 255, 0.15), rgba(157, 140, 255, 0.15)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .field { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: #F4F4F7; outline: none; transition: border-color 0.2s; }
        .field::placeholder { color: rgba(126,126,142,1); }
        .field:focus { border-color: rgba(157, 140, 255, 0.5); }
        .rolelabel { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #A6A6B4; margin-bottom: 8px; }
        .required::after { content: " *"; color: #FB7185; }
      `}</style>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-[#F4F4F7]">Edit role</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: statusBadge.bg, color: statusBadge.c }}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-[#A6A6B4] text-sm">Tweak the details, edit the AI-written JD, then publish.</p>
        </div>
      </div>

      {fromWhatsApp && (
        <div className="rounded-xl px-4 py-3 mb-6" style={{ background: 'rgba(157, 140, 255, 0.08)', border: '1px solid rgba(157, 140, 255, 0.22)' }}>
          <p className="text-sm font-bold text-[#9D8CFF]">💬 Drafted from your WhatsApp chat</p>
          <p className="text-[#A6A6B4] text-xs mt-1 leading-relaxed">
            Shapi turned your conversation into this role. Review the salary, JD and requirements below — they&apos;re fully editable — then hit Publish to start matching candidates.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3 mb-6 text-sm text-[#FB7185]">{error}</div>
      )}
      {saved && !error && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm" style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)', color: '#34D399' }}>✓ Saved</div>
      )}

      {/* Basics */}
      <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-4">
        <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Role basics</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="rolelabel required">Job title</label>
            <input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Head of Operations" />
          </div>
          <div>
            <label className="rolelabel">Department</label>
            <input className="field" value={department} onChange={e => setDepartment(e.target.value)} placeholder="Operations, Finance, Tech..." />
          </div>
          <div>
            <label className="rolelabel">Location</label>
            <input className="field" value={location} onChange={e => setLocation(e.target.value)} placeholder="Dubai, UAE" />
          </div>
        </div>

        <div>
          <label className="rolelabel">Engagement type</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 'permanent', l: 'Permanent', s: 'Full-time hire' },
              { v: 'contract', l: 'Contract', s: 'Fixed-term / day rate' },
              { v: 'temp', l: 'Temp / Shift', s: 'Short-term cover' },
            ] as const).map(o => (
              <button key={o.v} type="button" onClick={() => setEngagementType(o.v)}
                className="text-left rounded-xl px-3 py-2.5 transition-all"
                style={engagementType === o.v
                  ? { background: 'rgba(157, 140, 255, 0.1)', border: '1px solid rgba(157, 140, 255, 0.45)' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-sm font-bold" style={{ color: engagementType === o.v ? '#9D8CFF' : '#C7C7D1' }}>{o.l}</p>
                <p className="text-[#7E7E8E] text-[10px] leading-tight">{o.s}</p>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div onClick={() => setRemote(!remote)}
            className={`w-10 h-6 rounded-full transition-colors relative ${remote ? 'bg-[#9D8CFF]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${remote ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-[#A6A6B4] text-sm">Remote / hybrid OK</span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <div onClick={() => setAcceptsPivot(!acceptsPivot)}
            className={`mt-0.5 flex-shrink-0 w-10 h-6 rounded-full transition-colors relative ${acceptsPivot ? 'bg-[#9D8CFF]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${acceptsPivot ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-sm">
            <span className="text-[#A6A6B4]">🌱 Open to career-changers — we&apos;ll train on the job</span>
            <span className="block text-[#7E7E8E] text-xs mt-0.5">Train-to-Hire: surfaces this role to pivoters who don&apos;t yet match every requirement.</span>
          </span>
        </label>
      </div>

      {/* Salary */}
      <div className="gradient-border-card rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Salary range</p>
          <span className="text-[#FB7185] text-xs font-bold">Required to publish</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="rolelabel">Currency</label>
            <select className="field" value={currency} onChange={e => setCurrency(e.target.value)} style={{ appearance: 'none' }}>
              {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#0D0C14' }}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="rolelabel">Minimum</label>
            <input className="field" type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="80000" />
          </div>
          <div>
            <label className="rolelabel">Maximum</label>
            <input className="field" type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)} placeholder="120000" />
          </div>
        </div>
        {salaryMin && salaryMax && parseInt(salaryMin) < parseInt(salaryMax) && (
          <p className="text-[#9D8CFF] text-xs font-semibold">
            {currency} {parseInt(salaryMin).toLocaleString()} – {parseInt(salaryMax).toLocaleString()} per year
          </p>
        )}
        <label className="flex items-center gap-3 cursor-pointer mt-4">
          <div onClick={() => setSalaryVisible(!salaryVisible)}
            className={`w-10 h-6 rounded-full transition-colors relative ${salaryVisible ? 'bg-[#9D8CFF]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${salaryVisible ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-[#A6A6B4] text-sm">Show salary publicly on role listing</span>
        </label>
      </div>

      {/* JD — editable */}
      <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-5">
        <div>
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1">Job description</p>
          <p className="text-[#7E7E8E] text-xs">This is what candidates see. Shapi wrote it from your brief — edit freely.</p>
        </div>
        <div>
          <label className="rolelabel">Role overview</label>
          <textarea className="field" rows={8} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What the role is, why it matters, what the team looks like, what they'll actually be doing…"
            style={{ resize: 'vertical' }} />
        </div>
        <div>
          <label className="rolelabel">Requirements</label>
          <textarea className="field" rows={6} value={requirements} onChange={e => setRequirements(e.target.value)}
            placeholder="- 6-8 genuine requirements, one per line"
            style={{ resize: 'vertical' }} />
        </div>
        <div>
          <label className="rolelabel">Hiring notes (internal — not shown to candidates)</label>
          <textarea className="field" rows={3} value={hiringNotes} onChange={e => setHiringNotes(e.target.value)}
            placeholder="Team context, dealbreakers, what success looks like…"
            style={{ resize: 'vertical' }} />
        </div>
      </div>

      {/* Save */}
      <button onClick={save} disabled={saving}
        className="w-full bg-gradient-to-r from-[#9D8CFF] to-[#9D8CFF] py-4 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity disabled:opacity-50">
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      {/* Status actions */}
      <div className="gradient-border-card rounded-2xl p-6 mt-6">
        <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-4">Publishing</p>
        <div className="flex flex-wrap gap-3">
          {status !== 'active' && (
            <button onClick={publish} disabled={saving}
              className="bg-gradient-to-r from-[#9D8CFF] to-[#9D8CFF] px-6 py-3 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity disabled:opacity-50">
              {status === 'closed' ? 'Reopen & publish →' : 'Publish role →'}
            </button>
          )}
          {status === 'active' && (
            <>
              <button onClick={unpublish} disabled={saving}
                className="px-6 py-3 rounded-full font-bold text-sm transition-colors disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#C7C7D1' }}>
                Unpublish (back to draft)
              </button>
              <button onClick={close} disabled={saving}
                className="px-6 py-3 rounded-full font-bold text-sm transition-colors disabled:opacity-50"
                style={{ background: 'rgba(251, 113, 133, 0.10)', border: '1px solid rgba(251, 113, 133, 0.25)', color: '#FB7185' }}>
                Close role
              </button>
            </>
          )}
          {status === 'closed' && (
            <button onClick={reopen} disabled={saving}
              className="px-6 py-3 rounded-full font-bold text-sm transition-colors disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#C7C7D1' }}>
              Reopen as draft
            </button>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.08)]">
          <button onClick={remove} disabled={saving}
            className="text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: '#FB7185' }}>
            Delete this role permanently
          </button>
        </div>
      </div>
    </>
  )
}
