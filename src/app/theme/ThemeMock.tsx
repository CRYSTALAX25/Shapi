import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'
import type { ThemeTokens } from './themes'

// A representative candidate-profile screen, rendered in a given theme so the
// design direction can be judged on real-feeling content.
export default function ThemeMock({ t }: { t: ThemeTokens }) {
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow } as const

  return (
    <div className="min-h-screen" style={{ background: t.pageBg, color: t.text }}>
      {t.dot !== 'none' && (
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: `radial-gradient(circle, ${t.dot} 1px, transparent 1px)`, backgroundSize: '44px 44px',
        }} />
      )}

      {/* Nav with the star */}
      <nav className="relative z-10" style={{ background: t.navBg, borderBottom: `1px solid ${t.cardBorder}`, backdropFilter: 'blur(8px)' }}>
        <div className="max-w-3xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShapiCharacter mood="happy" size={30} tint={t.star} />
            <span className="font-black text-xl tracking-tighter" style={{
              background: t.logoGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>shapi</span>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <span style={{ color: t.navTextMuted }} className="hidden sm:block">Roles</span>
            <span style={{ color: t.navTextMuted }} className="hidden sm:block">Applications</span>
            <span className="font-bold px-4 py-1.5 rounded-full" style={{ background: t.buttonGradient, color: t.buttonText }}>Edit profile</span>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-8 space-y-4">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: t.accent }}>{t.name} — preview</p>

        {/* Header card */}
        <div className="rounded-2xl p-7" style={card}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl" style={{ background: t.buttonGradient, color: t.buttonText }}>A</div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Ana O. Barber</h1>
                <p style={{ color: t.textSec }} className="text-lg">Operations Director · NEOM</p>
                <p style={{ color: t.textMuted }} className="text-sm mt-0.5">📍 Dubai, UAE</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: t.trustSoft, color: t.trust }}>✓ Strongly Verified</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: t.accentSoft, color: t.accent }}>AI Builder</span>
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-4xl font-black" style={{ background: t.buttonGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>92%</div>
              <div style={{ color: t.textMuted }} className="text-xs">complete</div>
            </div>
          </div>
        </div>

        {/* AI Cross-Check */}
        <div className="rounded-2xl p-6" style={card}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${t.trust}, ${t.accent})` }} />
            <h2 className="font-black text-xl tracking-tight">AI Cross-Check</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.trustSoft, color: t.trust }}>✓ across 6 references</span>
          </div>
          <p style={{ color: t.textSec }} className="text-sm leading-relaxed mb-4 ml-4">Core claims — the $40M NEOM saving, proactive operational leadership, and closing major commercial deals — are corroborated by multiple independent referees across both employers.</p>
          <div className="grid sm:grid-cols-2 gap-4 ml-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: t.trust }}>✓ Confirmed</p>
              {['$40M saved at NEOM (2 referees)', 'Proactive ops partner to leadership', 'Closed a $5M Asian-market deal'].map((s, i) => (
                <p key={i} style={{ color: t.textSec }} className="text-xs leading-relaxed">· {s}</p>
              ))}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: t.accent }}>Most-cited strengths</p>
              <div className="flex flex-wrap gap-1.5">
                {['Problem-solving', 'Relentless drive', 'Deal-closing', 'Cost-saving'].map((s, i) => (
                  <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.accentSoft, color: t.accent }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Availability & salary */}
        <div className="rounded-2xl p-6" style={card}>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${t.accent}, ${t.trust})` }} />
            <h2 className="font-black text-xl tracking-tight">Availability & salary</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.cardBorder, color: t.textMuted }}>🔒 private</span>
          </div>
          <div className="ml-4 space-y-3">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: t.trust }} /><span className="text-sm font-bold" style={{ color: t.trust }}>Open to offers</span></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: t.textMuted }}>Primary · Operations</p>
              <p className="text-lg font-black">AED 35,000–48,000<span style={{ color: t.textMuted }} className="text-xs font-medium ml-2">/mo · negotiable</span></p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: t.textMuted }}>Looking for</p>
              <div className="flex flex-wrap gap-1.5">
                {['Chief of Staff', 'COO', 'Operations'].map((s, i) => <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.accentSoft, color: t.accent }}>{s}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* Skills + CTA */}
        <div className="rounded-2xl p-6" style={card}>
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: t.textMuted }}>Skills</p>
          <div className="flex flex-wrap gap-2">
            {['P&L management', 'Giga-project ops', 'Vendor management', 'Stakeholder leadership', 'Arabic / English', 'HSE frameworks'].map((s, i) => (
              <span key={i} className="text-xs px-3 py-1.5 rounded-full" style={{ background: t.cardBorder, color: t.textSec }}>{s}</span>
            ))}
          </div>
        </div>

        <button className="w-full py-4 rounded-full font-black text-sm" style={{ background: t.buttonGradient, color: t.buttonText }}>Download verified CV ↓</button>

        <div className="flex items-center justify-center gap-4 pt-2 text-sm">
          <Link href="/theme/dark" style={{ color: t.textMuted }}>Dark</Link>
          <Link href="/theme/warm" style={{ color: t.textMuted }}>Warm·Teal</Link>
          <Link href="/theme/warmv" style={{ color: t.textMuted }}>Warm·Violet</Link>
          <Link href="/theme/mono" style={{ color: t.textMuted }}>Mono</Link>
          <Link href="/theme" style={{ color: t.accent, fontWeight: 700 }}>Compare all →</Link>
        </div>
      </div>
    </div>
  )
}
