'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Location = {
  id: string
  name: string
  country: string
  city: string | null
  timezone: string | null
  is_primary: boolean
}

type Team = {
  id: string
  name: string
  location_id: string
  parent_team_id: string | null
  function: string | null
  description: string | null
}

type Person = {
  id: string
  full_name: string
  preferred_name: string | null
  email: string | null
  whatsapp_number: string | null
  status: string
}

type Seat = {
  id: string
  title: string
  team_id: string
  seniority: string | null
  function: string | null
  person_id: string | null
  status: string
  experienced_budget_sar: number | null
  pivot_budget_sar: number | null
}

const CARD = 'rounded-2xl border'
const CARD_STYLE: React.CSSProperties = {
  background: '#13161b',
  borderColor: 'rgba(124,147,245,0.18)',
}
const HEADING = 'text-lg font-black tracking-tight'
const HEADING_STYLE: React.CSSProperties = { color: '#f4f6f9' }
const BODY_STYLE: React.CSSProperties = { color: '#9ca3af' }
const ACCENT = '#7c93f5'
const CTA_STYLE: React.CSSProperties = { background: '#eef1f6', color: '#0c0e11' }
const INPUT = 'w-full px-3 py-2 rounded-lg text-sm'
const INPUT_STYLE: React.CSSProperties = {
  background: '#0c0e11',
  border: '1px solid rgba(124,147,245,0.20)',
  color: '#f4f6f9',
}
const LABEL = 'block text-[10px] font-bold uppercase tracking-wider mb-1'
const LABEL_STYLE: React.CSSProperties = { color: '#9ca3af' }

function ErrorBanner({ msg, onClear }: { msg: string | null; onClear: () => void }) {
  if (!msg) return null
  return (
    <div
      className="mb-3 p-3 rounded-lg text-xs flex items-start justify-between gap-2"
      style={{ background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.30)', color: '#FB7185' }}
    >
      <span>{msg}</span>
      <button onClick={onClear} className="font-bold">×</button>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/* LOCATIONS                                                               */
/* ──────────────────────────────────────────────────────────────────────── */
export function LocationsSection({ locations }: { locations: Location[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', country: '', city: '', timezone: '', is_primary: false })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const res = await fetch('/api/company/spine/location', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      if (data.error === 'free_tier_location_limit_exceeded') {
        setErr('Free tier supports one location. Upgrade to Pro to add more.')
      } else {
        setErr(data.error || 'Failed to add location')
      }
      return
    }
    setForm({ name: '', country: '', city: '', timezone: '', is_primary: false })
    setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this location? Teams + seats in it will be deleted too.')) return
    const res = await fetch(`/api/company/spine/location?id=${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  return (
    <div className={`${CARD} p-5`} style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={HEADING} style={HEADING_STYLE}>Locations</h2>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs font-black px-3 py-1.5 rounded-full"
          style={CTA_STYLE}
        >
          {open ? 'Cancel' : '+ Add location'}
        </button>
      </div>

      <ErrorBanner msg={err} onClear={() => setErr(null)} />

      {open && (
        <form onSubmit={submit} className="mb-4 p-4 rounded-xl" style={{ background: '#0c0e11', border: `1px dashed ${ACCENT}40` }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Name</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Riyadh HQ" required />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Country (ISO-2)</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.country} onChange={e => setForm({ ...form, country: e.target.value.toUpperCase() })} placeholder="SA" maxLength={2} required />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>City</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Riyadh" />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Timezone</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} placeholder="Asia/Riyadh" />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-3 text-xs" style={BODY_STYLE}>
            <input type="checkbox" checked={form.is_primary} onChange={e => setForm({ ...form, is_primary: e.target.checked })} />
            Mark as primary location
          </label>
          <button type="submit" disabled={busy} className="mt-3 text-xs font-black px-4 py-2 rounded-full" style={CTA_STYLE}>
            {busy ? 'Saving...' : 'Save location'}
          </button>
        </form>
      )}

      {locations.length === 0 ? (
        <p className="text-xs" style={BODY_STYLE}>No locations yet. Add your headquarters to start.</p>
      ) : (
        <ul className="space-y-2">
          {locations.map(loc => (
            <li key={loc.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0c0e11' }}>
              <div>
                <div className="text-sm font-bold" style={HEADING_STYLE}>
                  {loc.name}
                  {loc.is_primary && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${ACCENT}22`, color: ACCENT }}>primary</span>}
                </div>
                <div className="text-xs" style={BODY_STYLE}>
                  {[loc.city, loc.country].filter(Boolean).join(' · ')}{loc.timezone && ` · ${loc.timezone}`}
                </div>
              </div>
              <button onClick={() => remove(loc.id)} className="text-xs font-bold" style={{ color: '#FB7185' }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/* TEAMS                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */
export function TeamsSection({ teams, locations }: { teams: Team[]; locations: Location[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', location_id: '', parent_team_id: '', function: '', description: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const res = await fetch('/api/company/spine/team', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, parent_team_id: form.parent_team_id || null }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErr(data.error || 'Failed to add team')
      return
    }
    setForm({ name: '', location_id: '', parent_team_id: '', function: '', description: '' })
    setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this team? Seats in it will be deleted too.')) return
    const res = await fetch(`/api/company/spine/team?id=${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  const locById = Object.fromEntries(locations.map(l => [l.id, l]))

  return (
    <div className={`${CARD} p-5`} style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={HEADING} style={HEADING_STYLE}>Teams</h2>
        <button
          onClick={() => setOpen(v => !v)}
          disabled={locations.length === 0}
          className="text-xs font-black px-3 py-1.5 rounded-full disabled:opacity-40"
          style={CTA_STYLE}
        >
          {open ? 'Cancel' : '+ Add team'}
        </button>
      </div>

      {locations.length === 0 && (
        <p className="text-xs mb-3" style={BODY_STYLE}>Add a location first.</p>
      )}

      <ErrorBanner msg={err} onClear={() => setErr(null)} />

      {open && (
        <form onSubmit={submit} className="mb-4 p-4 rounded-xl" style={{ background: '#0c0e11', border: `1px dashed ${ACCENT}40` }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Name</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Backend" required />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Location</label>
              <select className={INPUT} style={INPUT_STYLE} value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value })} required>
                <option value="">Select...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Parent team (optional)</label>
              <select className={INPUT} style={INPUT_STYLE} value={form.parent_team_id} onChange={e => setForm({ ...form, parent_team_id: e.target.value })}>
                <option value="">— top level —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Function</label>
              <select className={INPUT} style={INPUT_STYLE} value={form.function} onChange={e => setForm({ ...form, function: e.target.value })}>
                <option value="">—</option>
                <option value="engineering">Engineering</option>
                <option value="sales">Sales</option>
                <option value="ops">Operations</option>
                <option value="finance">Finance</option>
                <option value="people">People / HR</option>
                <option value="marketing">Marketing</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className={LABEL} style={LABEL_STYLE}>Description</label>
            <input className={INPUT} style={INPUT_STYLE} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
          </div>
          <button type="submit" disabled={busy} className="mt-3 text-xs font-black px-4 py-2 rounded-full" style={CTA_STYLE}>
            {busy ? 'Saving...' : 'Save team'}
          </button>
        </form>
      )}

      {teams.length === 0 ? (
        <p className="text-xs" style={BODY_STYLE}>No teams yet.</p>
      ) : (
        <ul className="space-y-2">
          {teams.map(t => {
            const parent = t.parent_team_id ? teams.find(x => x.id === t.parent_team_id) : null
            const loc = locById[t.location_id]
            return (
              <li key={t.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0c0e11' }}>
                <div>
                  <div className="text-sm font-bold" style={HEADING_STYLE}>
                    {parent ? `${parent.name} › ` : ''}{t.name}
                  </div>
                  <div className="text-xs" style={BODY_STYLE}>
                    {loc?.name || '—'}{t.function && ` · ${t.function}`}
                  </div>
                </div>
                <button onClick={() => remove(t.id)} className="text-xs font-bold" style={{ color: '#FB7185' }}>Delete</button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/* PERSONS                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */
export function PersonsSection({ persons }: { persons: Person[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', preferred_name: '', email: '', whatsapp_number: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const res = await fetch('/api/company/spine/person', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErr(data.error || 'Failed to add person')
      return
    }
    setForm({ full_name: '', preferred_name: '', email: '', whatsapp_number: '' })
    setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this person? Their seat assignments will be cleared.')) return
    const res = await fetch(`/api/company/spine/person?id=${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  return (
    <div className={`${CARD} p-5`} style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={HEADING} style={HEADING_STYLE}>People</h2>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs font-black px-3 py-1.5 rounded-full"
          style={CTA_STYLE}
        >
          {open ? 'Cancel' : '+ Add person'}
        </button>
      </div>

      <ErrorBanner msg={err} onClear={() => setErr(null)} />

      {open && (
        <form onSubmit={submit} className="mb-4 p-4 rounded-xl" style={{ background: '#0c0e11', border: `1px dashed ${ACCENT}40` }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Full name</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Ahmed Al-Saud" required />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Preferred name</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.preferred_name} onChange={e => setForm({ ...form, preferred_name: e.target.value })} placeholder="Ahmed" />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Email</label>
              <input type="email" className={INPUT} style={INPUT_STYLE} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ahmed@company.com" />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>WhatsApp</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+966 50..." />
            </div>
          </div>
          <button type="submit" disabled={busy} className="mt-3 text-xs font-black px-4 py-2 rounded-full" style={CTA_STYLE}>
            {busy ? 'Saving...' : 'Save person'}
          </button>
        </form>
      )}

      {persons.length === 0 ? (
        <p className="text-xs" style={BODY_STYLE}>No people yet. Add employees to assign them to seats.</p>
      ) : (
        <ul className="space-y-2">
          {persons.map(p => (
            <li key={p.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0c0e11' }}>
              <div>
                <div className="text-sm font-bold" style={HEADING_STYLE}>
                  {p.preferred_name || p.full_name}
                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full capitalize" style={{ background: `${ACCENT}22`, color: ACCENT }}>{p.status}</span>
                </div>
                <div className="text-xs" style={BODY_STYLE}>{p.email || p.whatsapp_number || '—'}</div>
              </div>
              <button onClick={() => remove(p.id)} className="text-xs font-bold" style={{ color: '#FB7185' }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/* SEATS                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */
export function SeatsSection({ seats, teams, persons }: { seats: Seat[]; teams: Team[]; persons: Person[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', team_id: '', seniority: '', function: '',
    person_id: '', status: 'planned',
    experienced_budget_sar: '', pivot_budget_sar: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const res = await fetch('/api/company/spine/seat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        person_id: form.person_id || null,
        experienced_budget_sar: form.experienced_budget_sar ? Number(form.experienced_budget_sar) : null,
        pivot_budget_sar: form.pivot_budget_sar ? Number(form.pivot_budget_sar) : null,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErr(data.error || 'Failed to add seat')
      return
    }
    setForm({ title: '', team_id: '', seniority: '', function: '', person_id: '', status: 'planned', experienced_budget_sar: '', pivot_budget_sar: '' })
    setOpen(false)
    router.refresh()
  }

  async function assignPerson(seatId: string, personId: string | null) {
    const res = await fetch('/api/company/spine/seat', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: seatId,
        person_id: personId,
        status: personId ? 'active' : 'vacant',
      }),
    })
    if (res.ok) router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this seat?')) return
    const res = await fetch(`/api/company/spine/seat?id=${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  const teamById = Object.fromEntries(teams.map(t => [t.id, t]))
  const personById = Object.fromEntries(persons.map(p => [p.id, p]))

  return (
    <div className={`${CARD} p-5`} style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={HEADING} style={HEADING_STYLE}>Seats</h2>
        <button
          onClick={() => setOpen(v => !v)}
          disabled={teams.length === 0}
          className="text-xs font-black px-3 py-1.5 rounded-full disabled:opacity-40"
          style={CTA_STYLE}
        >
          {open ? 'Cancel' : '+ Add seat'}
        </button>
      </div>

      {teams.length === 0 && (
        <p className="text-xs mb-3" style={BODY_STYLE}>Add a team first.</p>
      )}

      <ErrorBanner msg={err} onClear={() => setErr(null)} />

      {open && (
        <form onSubmit={submit} className="mb-4 p-4 rounded-xl" style={{ background: '#0c0e11', border: `1px dashed ${ACCENT}40` }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Title</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Senior Backend Engineer" required />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Team</label>
              <select className={INPUT} style={INPUT_STYLE} value={form.team_id} onChange={e => setForm({ ...form, team_id: e.target.value })} required>
                <option value="">Select...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Seniority</label>
              <select className={INPUT} style={INPUT_STYLE} value={form.seniority} onChange={e => setForm({ ...form, seniority: e.target.value })}>
                <option value="">—</option>
                <option value="intern">Intern</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
                <option value="manager">Manager</option>
                <option value="director">Director</option>
                <option value="vp">VP</option>
                <option value="cxo">C-level</option>
              </select>
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Function</label>
              <input className={INPUT} style={INPUT_STYLE} value={form.function} onChange={e => setForm({ ...form, function: e.target.value })} placeholder="data" />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Person (optional)</label>
              <select className={INPUT} style={INPUT_STYLE} value={form.person_id} onChange={e => setForm({ ...form, person_id: e.target.value, status: e.target.value ? 'active' : 'planned' })}>
                <option value="">(vacant)</option>
                {persons.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={p.id}>{p.preferred_name || p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Status</label>
              <select className={INPUT} style={INPUT_STYLE} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="planned">Planned</option>
                <option value="vacant">Vacant</option>
                <option value="active">Active</option>
                <option value="frozen">Frozen</option>
              </select>
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Experienced budget (SAR)</label>
              <input type="number" className={INPUT} style={INPUT_STYLE} value={form.experienced_budget_sar} onChange={e => setForm({ ...form, experienced_budget_sar: e.target.value })} placeholder="18000" />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Pivot budget (SAR)</label>
              <input type="number" className={INPUT} style={INPUT_STYLE} value={form.pivot_budget_sar} onChange={e => setForm({ ...form, pivot_budget_sar: e.target.value })} placeholder="12000" />
            </div>
          </div>
          <button type="submit" disabled={busy} className="mt-3 text-xs font-black px-4 py-2 rounded-full" style={CTA_STYLE}>
            {busy ? 'Saving...' : 'Save seat'}
          </button>
        </form>
      )}

      {seats.length === 0 ? (
        <p className="text-xs" style={BODY_STYLE}>No seats yet. Add a seat to define a role in the org.</p>
      ) : (
        <ul className="space-y-2">
          {seats.map(s => {
            const t = teamById[s.team_id]
            const p = s.person_id ? personById[s.person_id] : null
            return (
              <li key={s.id} className="p-3 rounded-lg" style={{ background: '#0c0e11' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-bold flex items-center gap-2 flex-wrap" style={HEADING_STYLE}>
                      {s.title}
                      <span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={{ background: `${ACCENT}22`, color: ACCENT }}>{s.status}</span>
                      {s.seniority && <span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>{s.seniority}</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={BODY_STYLE}>
                      {t?.name || '—'}{p ? ` · 👤 ${p.preferred_name || p.full_name}` : ' · vacant'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={s.person_id || ''}
                      onChange={e => assignPerson(s.id, e.target.value || null)}
                      className="text-xs px-2 py-1 rounded"
                      style={INPUT_STYLE}
                    >
                      <option value="">(vacant)</option>
                      {persons.filter(person => person.status === 'active').map(person => (
                        <option key={person.id} value={person.id}>{person.preferred_name || person.full_name}</option>
                      ))}
                    </select>
                    <button onClick={() => remove(s.id)} className="text-xs font-bold" style={{ color: '#FB7185' }}>Delete</button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
