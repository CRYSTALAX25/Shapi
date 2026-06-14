'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type RefData = {
  referee_name: string
  referee_title: string | null
  candidate_name: string
  candidate_job_title: string | null
  candidate_company: string | null
  candidate_dates: string | null
  ref_type: 'manager' | 'colleague' | 'stakeholder'
  status: string
  nominator: { name: string; company: string } | null
}

const REHIRE_OPTIONS = [
  { val: 'yes_definitely', label: 'Yes, without hesitation' },
  { val: 'yes_right_role', label: 'Yes, in the right role' },
  { val: 'not_sure', label: 'Not sure' },
  { val: 'no', label: 'No' },
]

const FS: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, padding: '14px 16px', fontSize: 14, color: '#F4F4F7', outline: 'none',
  resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
}
const FSI: React.CSSProperties = { ...FS, resize: undefined }

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'linear-gradient(#0D0C14,#0D0C14) padding-box,linear-gradient(135deg,rgba(56, 189, 248, 0.12),rgba(56, 189, 248, 0.12)) border-box',
      border: '1px solid transparent', borderRadius: 16, padding: 24,
      boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)',
    }}>{children}</div>
  )
}
function QL({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(244,244,247,0.85)', marginBottom: 4 }}>{children}{req && <span style={{ color: '#FB7185', marginLeft: 4 }}>*</span>}</p>
}
function QH({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: 'rgba(126,126,142,1)', marginBottom: 12, lineHeight: 1.5 }}>{children}</p>
}

export default function ReferencePage() {
  const { token } = useParams()
  const [ref, setRef] = useState<RefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // Manager fields
  const [quality, setQuality] = useState('')
  const [achievement, setAchievement] = useState('')
  const [skills, setSkills] = useState('')
  const [wouldRehire, setWouldRehire] = useState('')
  const [anythingElse, setAnythingElse] = useState('')
  // Manager nominations
  const [colName, setColName] = useState('')
  const [colPhone, setColPhone] = useState('')
  const [colEmail, setColEmail] = useState('')
  const [colTitle, setColTitle] = useState('')
  const [stkName, setStkName] = useState('')
  const [stkPhone, setStkPhone] = useState('')
  const [stkEmail, setStkEmail] = useState('')
  const [stkCompany, setStkCompany] = useState('')
  // Colleague / stakeholder fields
  const [howWorked, setHowWorked] = useState('')
  const [biggestStrength, setBiggestStrength] = useState('')
  const [extra, setExtra] = useState('')

  useEffect(() => {
    fetch(`/api/references/form?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setNotFound(true)
        else { setRef(data); if (data.status === 'completed') setDone(true) }
        setLoading(false)
      })
  }, [token])

  const isManager = ref?.ref_type === 'manager'

  const submit = async () => {
    setSubmitting(true)
    await fetch('/api/references/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isManager ? {
        token, quality, achievement, skills, would_rehire: wouldRehire, anything_else: anythingElse,
        colleague_name: colName || undefined,
        colleague_phone: colPhone || undefined,
        colleague_email: colEmail || undefined,
        colleague_title: colTitle || undefined,
        stakeholder_name: stkName || undefined,
        stakeholder_phone: stkPhone || undefined,
        stakeholder_email: stkEmail || undefined,
        stakeholder_company: stkCompany || undefined,
      } : { token, how_worked: howWorked, biggest_strength: biggestStrength, extra }),
    })
    setDone(true)
    setSubmitting(false)
  }

  const canSubmit = isManager
    ? quality.trim() && achievement.trim() && skills.trim() && wouldRehire
    : howWorked.trim() && biggestStrength.trim()

  if (loading) return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center">
      <div className="flex gap-2">{[0,150,300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-[#38BDF8]/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">🔍</div>
        <h1 className="text-2xl font-black text-[#F4F4F7] mb-3">Link not found</h1>
        <p className="text-[#A6A6B4] text-sm">This reference link is invalid or has already been completed.</p>
      </div>
    </div>
  )

  if (done) {
    const first = ref?.referee_name?.split(' ')[0] || 'there'
    const cf = ref?.candidate_name?.split(' ')[0] || 'them'
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
        <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.05) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="relative z-10 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)' }}>✓</div>
          <h1 className="text-2xl font-black text-[#F4F4F7] mb-3">Thank you, {first}.</h1>
          <p className="text-[#A6A6B4] text-sm leading-relaxed mb-4">
            Your reference for {ref?.candidate_name} is submitted. Your words appear exactly as written — {cf} cannot edit them.
          </p>
          {isManager && (colName || stkName) && (
            <p className="text-[#7E7E8E] text-xs leading-relaxed mb-6">
              We&apos;ll reach out to your nominees — {cf} won&apos;t be told who you named.
            </p>
          )}
          <p className="text-[#5C5C6A] text-xs"><Link href="/" className="text-[#7E7E8E] hover:text-[#A6A6B4]">shapi.io</Link></p>
        </div>
      </div>
    )
  }

  const first = ref?.candidate_name?.split(' ')[0] || 'them'

  return (
    <div className="min-h-screen bg-[#060609]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.05) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-5 border-b border-[rgba(255,255,255,0.08)]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-24 space-y-4">

        {/* Header */}
        <div className="mb-2">
          <span className="text-[#38BDF8] text-xs font-bold uppercase tracking-wider">Reference request</span>
          <h1 className="text-3xl font-black text-[#F4F4F7] mt-2 mb-3">
            {isManager ? `A reference for ${ref?.candidate_name}` : `A quick word about ${ref?.candidate_name}`}
          </h1>

          {isManager ? (
            <p className="text-[#A6A6B4] text-sm leading-relaxed max-w-lg">
              {ref?.candidate_name} listed you as their direct manager at{' '}
              <strong className="text-[#C7C7D1]">{ref?.candidate_company}</strong>
              {ref?.candidate_dates ? ` (${ref.candidate_dates})` : ''}.
              Takes about 5 minutes. Your answers appear verbatim — {first} cannot edit them.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-[#A6A6B4] text-sm leading-relaxed max-w-lg">
                <strong className="text-[#C7C7D1]">{ref?.nominator?.name}</strong>
                {ref?.nominator?.company ? ` at ${ref.nominator.company}` : ''} suggested you worked with {ref?.candidate_name} and might share a perspective.
              </p>
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 10, padding: '10px 16px', display: 'inline-block' }}>
                <p className="text-sm font-bold" style={{ color: '#38BDF8' }}>
                  {first} doesn&apos;t know we&apos;ve reached out — you can be completely candid.
                </p>
              </div>
            </div>
          )}

          {ref?.candidate_job_title && ref?.candidate_company && (
            <div className="mt-4 inline-flex items-center gap-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-full px-4 py-1.5">
              <span className="text-[#A6A6B4] text-xs">{ref.candidate_job_title} · {ref.candidate_company}</span>
            </div>
          )}
        </div>

        {/* Progress dots — manager only */}
        {isManager && (
          <div className="flex gap-1.5">
            {[quality, achievement, skills, wouldRehire].map((v, i) => (
              <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ background: v ? 'linear-gradient(90deg,#38BDF8, #34D399)' : 'rgba(255,255,255,0.07)' }} />
            ))}
          </div>
        )}

        {/* ── MANAGER FORM ── */}
        {isManager && (<>
          <Card>
            <QL req>How would you describe the quality of {first}&apos;s work?</QL>
            <QH>Be specific — vague praise is less useful than honest detail.</QH>
            <textarea style={FS} rows={4} value={quality} onChange={e => setQuality(e.target.value)}
              placeholder={`${first} was consistently… The quality of their work stood out because…`} />
          </Card>

          <Card>
            <QL req>What&apos;s one specific achievement that shows what {first} is capable of?</QL>
            <QH>Numbers, scale, or a real project — one concrete example beats ten adjectives.</QH>
            <textarea style={FS} rows={4} value={achievement} onChange={e => setAchievement(e.target.value)}
              placeholder="One example that comes to mind…" />
          </Card>

          <Card>
            <QL req>What skills or strengths might not be obvious from their CV?</QL>
            <QH>Hidden strengths, soft skills, things they undersell.</QH>
            <textarea style={FS} rows={3} value={skills} onChange={e => setSkills(e.target.value)}
              placeholder="Something people don't always realise about them…" />
          </Card>

          <Card>
            <QL req>Would you work with {first} again?</QL>
            <div className="mt-3 space-y-2">
              {REHIRE_OPTIONS.map(opt => (
                <button key={opt.val} type="button" onClick={() => setWouldRehire(opt.val)}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left"
                  style={{
                    background: wouldRehire === opt.val ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255,255,255,0.03)',
                    border: wouldRehire === opt.val ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                  }}>
                  <div className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                    style={{ borderColor: wouldRehire === opt.val ? '#38BDF8' : 'rgba(255,255,255,0.2)', background: wouldRehire === opt.val ? '#38BDF8' : 'transparent' }}>
                    {wouldRehire === opt.val && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm" style={{ color: wouldRehire === opt.val ? 'rgba(244,244,247,0.9)' : 'rgba(166,166,180,1)' }}>{opt.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <QL>Anything else you&apos;d want an employer to know?</QL>
            <QH>Optional — often the most useful part.</QH>
            <textarea style={FS} rows={3} value={anythingElse} onChange={e => setAnythingElse(e.target.value)} placeholder="Optional…" />
          </Card>

          {/* Nominations */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1">One more thing — optional but valuable</p>
            <p className="text-[#7E7E8E] text-sm leading-relaxed mb-6">
              Nominate a colleague and a stakeholder who worked with {first}.
              We&apos;ll reach out to them directly — {first} won&apos;t be told who you named.
            </p>

            {/* Colleague */}
            <div className="mb-5">
              <p className="text-[#C7C7D1] text-sm font-bold mb-1">Colleague — someone on {first}&apos;s team</p>
              <p style={{ fontSize: 11, color: 'rgba(92,92,106,1)', marginBottom: 12 }}>We&apos;ll message them on WhatsApp first, then SMS, then email — whichever reaches them.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <input style={FSI} value={colName} onChange={e => setColName(e.target.value)} placeholder="Full name" />
                <input style={FSI} value={colPhone} onChange={e => setColPhone(e.target.value)} placeholder="WhatsApp / phone (primary)" type="tel" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input style={FSI} value={colEmail} onChange={e => setColEmail(e.target.value)} placeholder="Email (secondary)" type="email" />
                <input style={FSI} value={colTitle} onChange={e => setColTitle(e.target.value)} placeholder="Their job title (optional)" />
              </div>
            </div>

            {/* Stakeholder */}
            <div>
              <p className="text-[#C7C7D1] text-sm font-bold mb-1">Stakeholder — a client, partner, or senior leader they worked with</p>
              <p style={{ fontSize: 11, color: 'rgba(92,92,106,1)', marginBottom: 12 }}>Same — WhatsApp first, SMS fallback, email as backup.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <input style={FSI} value={stkName} onChange={e => setStkName(e.target.value)} placeholder="Full name" />
                <input style={FSI} value={stkPhone} onChange={e => setStkPhone(e.target.value)} placeholder="WhatsApp / phone (primary)" type="tel" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input style={FSI} value={stkEmail} onChange={e => setStkEmail(e.target.value)} placeholder="Email (secondary)" type="email" />
                <input style={FSI} value={stkCompany} onChange={e => setStkCompany(e.target.value)} placeholder="Their company / role (optional)" />
              </div>
            </div>
          </div>
        </>)}

        {/* ── COLLEAGUE / STAKEHOLDER FORM (3 questions) ── */}
        {!isManager && (<>
          <Card>
            <QL req>How did you work with {first}, and for how long?</QL>
            <QH>Give us the context — your role relative to theirs, and roughly how long you worked together.</QH>
            <textarea style={FS} rows={4} value={howWorked} onChange={e => setHowWorked(e.target.value)}
              placeholder={`We worked together at… for about… ${first}'s role was…`} />
          </Card>

          <Card>
            <QL req>What&apos;s {first}&apos;s biggest professional strength in your view?</QL>
            <QH>The one thing that stands out most about how they work.</QH>
            <textarea style={FS} rows={3} value={biggestStrength} onChange={e => setBiggestStrength(e.target.value)}
              placeholder="The thing that always stood out was…" />
          </Card>

          <Card>
            <QL>Anything else you&apos;d like to add?</QL>
            <QH>Optional — a specific project, example, or anything else relevant.</QH>
            <textarea style={FS} rows={3} value={extra} onChange={e => setExtra(e.target.value)} placeholder="Optional…" />
          </Card>
        </>)}

        <button onClick={submit} disabled={!canSubmit || submitting}
          className="w-full py-4 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)', color: '#fff' }}>
          {submitting ? 'Submitting…' : 'Submit reference →'}
        </button>

        <p className="text-center text-xs text-[#5C5C6A] pb-4">
          Your responses are final once submitted. {first} can see them but cannot edit them.
        </p>
      </div>
    </div>
  )
}
