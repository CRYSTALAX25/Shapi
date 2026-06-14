'use client'

// Token-gated edit + publish form. Saves via /api/role/share/[token].

import { useState } from 'react'

type Role = {
  id: string
  title: string | null
  description: string | null
  requirements: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_visible: boolean | null
  status: string | null
  remote: boolean | null
  location: string | null
  department: string | null
  company_id: string
}

export default function RoleEditClient({ token, role, companyName }: { token: string; role: Role; companyName: string }) {
  const [title, setTitle] = useState(role.title || '')
  const [description, setDescription] = useState(role.description || '')
  const [requirements, setRequirements] = useState(role.requirements || '')
  const [salaryMin, setSalaryMin] = useState(role.salary_min?.toString() || '')
  const [salaryMax, setSalaryMax] = useState(role.salary_max?.toString() || '')
  const [salaryCurrency, setSalaryCurrency] = useState(role.salary_currency || '')
  const [location, setLocation] = useState(role.location || '')
  const [department, setDepartment] = useState(role.department || '')
  const [remote, setRemote] = useState(!!role.remote)
  const [status, setStatus] = useState(role.status || 'draft')

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async () => {
    if (saving || publishing) return
    setSaving(true); setMsg('')
    const updates = {
      title: title.trim() || null,
      description: description.trim() || null,
      requirements: requirements.trim() || null,
      salary_min: salaryMin ? parseInt(salaryMin, 10) : null,
      salary_max: salaryMax ? parseInt(salaryMax, 10) : null,
      salary_currency: salaryCurrency.trim() || null,
      location: location.trim() || null,
      department: department.trim() || null,
      remote,
    }
    try {
      const res = await fetch(`/api/role/share/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', updates }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) setMsg('Saved ✓')
      else setMsg(d.error || 'Save failed')
    } catch { setMsg('Network error') }
    finally { setSaving(false) }
  }

  const publish = async () => {
    if (saving || publishing) return
    setPublishing(true); setMsg('')
    try {
      // Save edits first, then publish.
      await save()
      const res = await fetch(`/api/role/share/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('active')
        setMsg('🎉 Published! Verified candidates can now see this role.')
      } else {
        setMsg(d.error || 'Publish failed')
      }
    } catch { setMsg('Network error') }
    finally { setPublishing(false) }
  }

  const cardStyle = { background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }
  const inputCls = 'w-full rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#38BDF8]/40'
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1.5'

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={cardStyle}>
        <label className={labelCls}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} style={inputStyle} placeholder="Role title" />
      </div>

      <div className="rounded-2xl p-5" style={cardStyle}>
        <label className={labelCls}>Description / what they&apos;ll do</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={8} className={inputCls} style={inputStyle} placeholder="Describe the role…" />
      </div>

      <div className="rounded-2xl p-5" style={cardStyle}>
        <label className={labelCls}>Must-haves / requirements</label>
        <textarea value={requirements} onChange={e => setRequirements(e.target.value)} rows={6} className={inputCls} style={inputStyle} placeholder="One per line — start each with a dash" />
      </div>

      <div className="rounded-2xl p-5 grid grid-cols-2 gap-3" style={cardStyle}>
        <div className="col-span-2">
          <label className={labelCls}>Salary band</label>
        </div>
        <div>
          <input value={salaryCurrency} onChange={e => setSalaryCurrency(e.target.value)} className={inputCls} style={inputStyle} placeholder="AED / $ / £" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={salaryMin} onChange={e => setSalaryMin(e.target.value)} inputMode="numeric" className={inputCls} style={inputStyle} placeholder="Min" />
          <input value={salaryMax} onChange={e => setSalaryMax(e.target.value)} inputMode="numeric" className={inputCls} style={inputStyle} placeholder="Max" />
        </div>
      </div>

      <div className="rounded-2xl p-5 grid grid-cols-2 gap-3" style={cardStyle}>
        <div>
          <label className={labelCls}>Department</label>
          <input value={department} onChange={e => setDepartment(e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. Marketing" />
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input value={location} onChange={e => setLocation(e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. Dubai" />
        </div>
        <label className="col-span-2 flex items-center gap-2 mt-1 cursor-pointer select-none">
          <input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} className="accent-[#38BDF8]" />
          <span className="text-[#C7C7D1] text-sm">Remote OK</span>
        </label>
      </div>

      {msg && (
        <div className="rounded-xl px-4 py-3 text-sm font-bold"
          style={{ background: msg.includes('✓') || msg.includes('🎉') ? 'rgba(52,211,153,0.10)' : 'rgba(251, 113, 133, 0.10)', color: msg.includes('✓') || msg.includes('🎉') ? '#34D399' : '#FB7185' }}>
          {msg}
        </div>
      )}

      <div className="sticky bottom-3 z-10 flex gap-2">
        <button type="button" onClick={save} disabled={saving || publishing}
          className="flex-1 py-3.5 rounded-full font-black text-sm disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#C7C7D1' }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {status !== 'active' && (
          <button type="button" onClick={publish} disabled={saving || publishing}
            className="flex-1 py-3.5 rounded-full font-black text-sm text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}>
            {publishing ? 'Publishing…' : 'Publish role'}
          </button>
        )}
      </div>

      <p className="text-[#7E7E8E] text-[11px] text-center leading-relaxed pt-2">
        Working as <strong className="text-[#A6A6B4]">{companyName}</strong> via a secure share link. No login needed; saves go directly to your dashboard.
      </p>
    </div>
  )
}
