// Verified Positioning CV — three template variants for review.
//
// Concept (from Julie Fedele's "the CV is dead" + our verification moat):
// a statement-led page that replaces the chronological job-list with a bold
// positioning headline, a tight narrative, and a few PROOF engagements — each
// an outcome + a number, each carrying its verification status (the bit no
// other CV tool can do). Ocean-emerald, inline styles for print portability.

import type { CSSProperties } from 'react'

const OCEAN = '#38BDF8'
const EMERALD = '#34D399'
const GRAD = `linear-gradient(135deg, ${OCEAN}, ${EMERALD})`

// Each proof is tagged to a skill axis (Head / Hands / Spark / Heart) so the
// glance shows RANGE, not recency. Proofs are chosen as the highest-impact
// achievements that also maximise axis coverage — Shapi's skill-quadrant data
// powers this (no other CV tool can).
export type Axis = 'Head' | 'Hands' | 'Spark' | 'Heart'

export type Proof = {
  axis: Axis
  number: string                 // "$40M"
  context: string                // "NEOM · Studio Operations"
  outcome: string                // "saved on a $56M facilities contract"
  v: 'verified' | 'assessed' | 'self'
}

const AXIS_META: Record<Axis, { label: string; color: string }> = {
  Head: { label: 'Head · strategy', color: '#38BDF8' },
  Hands: { label: 'Hands · execution', color: '#34D399' },
  Spark: { label: 'Spark · building', color: '#FBBF24' },
  Heart: { label: 'Heart · people', color: '#FB7185' },
}

function AxisTag({ axis }: { axis: Axis }) {
  const m = AXIS_META[axis]
  return (
    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: m.color, background: `${m.color}1a`, border: `1px solid ${m.color}3a`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{m.label}</span>
  )
}

// A high, verified credentials strip — languages · right to work · ways to work —
// so they're never lost at the bottom.
function CredentialStrip({ d }: { d: CVData }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', alignItems: 'center', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize: 11.5, color: '#C7C7D1' }}>🌐 {d.languages.map(l => `${l.name}${l.verified ? ' ✓' : ''}`).join(' · ')}</span>
      <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.12)' }} />
      <span style={{ fontSize: 11.5, color: '#C7C7D1' }}><span style={{ color: EMERALD }}>✓</span> Right to work: {d.rightToWork.join(' · ')}</span>
      <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.12)' }} />
      <span style={{ fontSize: 11.5, color: '#7E7E8E' }}>Works as: {d.waysToWork.join(' · ')}</span>
    </div>
  )
}

export type CVData = {
  name: string
  roleLabel: string              // "FILM STUDIO OPERATIONS · AI-ENABLED LEADER"
  tier?: 'Basic' | 'Strongly' | 'Premium'  // omit until actually earned (no overclaiming)
  headline: string               // bold statement, ⟦…⟧ marks the highlighted phrase
  narrative: string
  proofs: Proof[]
  expertise: { label: string; bars: { name: string; v: number }[] } // skill-quadrant style
  waysToWork: string[]           // ["Permanent", "Fractional", "Advisory"]
  languages: { name: string; verified?: boolean }[]
  rightToWork: string[]
  profileUrl: string             // "shapi.io/p/ana"
}

// ── shared atoms ─────────────────────────────────────────────────────────────

// Render ⟦…⟧ segments in the brand gradient (same marker system as the site).
function Hl({ text }: { text: string }) {
  const parts = text.split(/⟦([^⟧]*)⟧/g)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{p}</span>
        ) : (
          p
        ),
      )}
    </>
  )
}

function vMeta(v: Proof['v']) {
  if (v === 'verified') return { icon: '✓', color: EMERALD, label: 'Verified' }
  if (v === 'assessed') return { icon: '◆', color: OCEAN, label: 'Shapi-assessed' }
  return { icon: '○', color: '#7E7E8E', label: 'Self-reported' }
}

function VBadge({ v }: { v: Proof['v'] }) {
  const m = vMeta(v)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: m.color, whiteSpace: 'nowrap' }}>
      {m.icon} {m.label}
    </span>
  )
}

function TierBadge({ tier }: { tier: CVData['tier'] }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: EMERALD, background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.28)', borderRadius: 999, padding: '3px 10px' }}>
      ✓ {tier} Verified
    </span>
  )
}

// A small faux-QR so the layout reads right in review (real QR wired at build).
function QR() {
  const cells = Array.from({ length: 25 }, (_, i) => (i * 7) % 3 === 0 || (i * 5) % 4 === 0)
  return (
    <div style={{ width: 54, height: 54, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 2, padding: 4, background: '#fff', borderRadius: 6 }}>
      {cells.map((on, i) => (
        <div key={i} style={{ background: on ? '#060609' : 'transparent', borderRadius: 1 }} />
      ))}
    </div>
  )
}

function Bars({ bars }: { bars: { name: string; v: number }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {bars.map(b => (
        <div key={b.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#A6A6B4', marginBottom: 2 }}>
            <span>{b.name}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${b.v}%`, background: GRAD, borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Chips({ items, color = OCEAN }: { items: string[]; color?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(i => (
        <span key={i} style={{ fontSize: 11, fontWeight: 700, color: '#C7C7D1', background: 'rgba(255,255,255,0.05)', border: `1px solid ${color}33`, borderRadius: 999, padding: '4px 10px' }}>{i}</span>
      ))}
    </div>
  )
}

const SHELL: CSSProperties = {
  background: '#0D0C14',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 18,
  color: '#F4F4F7',
  width: '100%',
  maxWidth: 760,
  boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 24px 60px rgba(0,0,0,0.4)',
  fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
}

const LABEL: CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#7E7E8E' }

// ── Variant 1 — "The Statement" (editorial, headline-hero) ───────────────────
export function PositioningStatement({ d }: { d: CVData }) {
  return (
    <div style={{ ...SHELL, padding: '44px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 }}>
        <span style={LABEL}>{d.roleLabel}</span>
        {d.tier && <TierBadge tier={d.tier} />}
      </div>
      <h1 style={{ fontSize: 40, lineHeight: 1.05, fontWeight: 900, letterSpacing: -1, margin: '0 0 16px' }}>
        <Hl text={d.headline} />
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: '#A6A6B4', maxWidth: 580, margin: '0 0 20px' }}>{d.narrative}</p>

      {/* credentials promoted high — never lost at the bottom */}
      <CredentialStrip d={d} />

      <p style={{ ...LABEL, margin: '28px 0 4px' }}>Proven across the full range</p>
      <p style={{ fontSize: 11.5, color: '#7E7E8E', margin: '0 0 18px' }}>The strongest result on each of the four ways this person creates value.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {d.proofs.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1, minWidth: 92, textAlign: 'right', background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{p.number}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <AxisTag axis={p.axis} />
                <VBadge v={p.v} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{p.outcome}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#7E7E8E' }}>{p.context}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '26px 0 22px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ ...LABEL, marginBottom: 10 }}>Expertise style · {d.expertise.label}</p>
          <Bars bars={d.expertise.bars} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <QR />
          <p style={{ margin: '8px 0 0', fontSize: 11, color: OCEAN, fontWeight: 700 }}>{d.profileUrl}</p>
        </div>
      </div>
    </div>
  )
}

// ── Variant 2 — "The Dossier" (two-column, structured) ───────────────────────
export function PositioningDossier({ d }: { d: CVData }) {
  return (
    <div style={{ ...SHELL, overflow: 'hidden' }}>
      <div style={{ padding: '34px 40px 26px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={LABEL}>{d.roleLabel}</span>
          {d.tier && <TierBadge tier={d.tier} />}
        </div>
        <h1 style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 900, letterSpacing: -0.5, margin: 0 }}><Hl text={d.headline} /></h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.7fr' }}>
        {/* left rail */}
        <div style={{ padding: '26px 28px', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 22, background: 'rgba(255,255,255,0.015)' }}>
          <div>
            <p style={{ ...LABEL, marginBottom: 10 }}>Expertise style</p>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: EMERALD }}>{d.expertise.label}</p>
            <Bars bars={d.expertise.bars} />
          </div>
          <div>
            <p style={{ ...LABEL, marginBottom: 8 }}>How I work</p>
            <Chips items={d.waysToWork} />
          </div>
          <div>
            <p style={{ ...LABEL, marginBottom: 8 }}>Languages</p>
            <div style={{ fontSize: 12, color: '#C7C7D1', lineHeight: 1.8 }}>
              {d.languages.map(l => <div key={l.name}>{l.name} {l.verified && <span style={{ color: EMERALD }}>✓</span>}</div>)}
            </div>
          </div>
          <div>
            <p style={{ ...LABEL, marginBottom: 8 }}>Right to work</p>
            <div style={{ fontSize: 12, color: '#C7C7D1', lineHeight: 1.7 }}>{d.rightToWork.map(r => <div key={r}>✓ {r}</div>)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto' }}>
            <QR />
            <span style={{ fontSize: 11, color: OCEAN, fontWeight: 700 }}>{d.profileUrl}</span>
          </div>
        </div>
        {/* right column */}
        <div style={{ padding: '26px 32px' }}>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: '#C7C7D1', margin: '0 0 24px' }}>{d.narrative}</p>
          <p style={{ ...LABEL, marginBottom: 16 }}>Proven on real work</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.proofs.map((p, i) => (
              <div key={i} style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{p.number}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AxisTag axis={p.axis} /><VBadge v={p.v} /></div>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, fontWeight: 700 }}>{p.outcome}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#7E7E8E' }}>{p.context}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Variant 3 — "The Proof Grid" (metric cards, digital-first) ───────────────
export function PositioningGrid({ d }: { d: CVData }) {
  return (
    <div style={{ ...SHELL, padding: '40px 44px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={LABEL}>{d.roleLabel}</span>
        {d.tier && <TierBadge tier={d.tier} />}
      </div>
      <h1 style={{ fontSize: 32, lineHeight: 1.1, fontWeight: 900, letterSpacing: -0.5, margin: '0 0 14px' }}><Hl text={d.headline} /></h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#A6A6B4', margin: '0 0 26px', maxWidth: 600 }}>{d.narrative}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 26 }}>
        {d.proofs.map((p, i) => (
          <div key={i} style={{ padding: 16, borderRadius: 14, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.16)' }}>
            <div style={{ marginBottom: 8 }}><AxisTag axis={p.axis} /></div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -1, background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{p.number}</p>
            <p style={{ margin: '6px 0 8px', fontSize: 12.5, fontWeight: 700, color: '#F4F4F7', lineHeight: 1.35 }}>{p.outcome}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#7E7E8E' }}>{p.context}</span>
            </div>
            <div style={{ marginTop: 6 }}><VBadge v={p.v} /></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ ...LABEL, marginBottom: 8 }}>Expertise · {d.expertise.label}</p>
          <Chips items={d.expertise.bars.map(b => b.name)} color={EMERALD} />
          <div style={{ marginTop: 12 }}><Chips items={d.waysToWork} /></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <QR />
          <p style={{ margin: '8px 0 0', fontSize: 11, color: OCEAN, fontWeight: 700 }}>{d.profileUrl}</p>
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 11, color: '#7E7E8E', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <span>🌐 {d.languages.map(l => `${l.name}${l.verified ? ' ✓' : ''}`).join(' · ')}</span>
        <span>✓ {d.rightToWork.join(' · ')}</span>
      </div>
    </div>
  )
}
