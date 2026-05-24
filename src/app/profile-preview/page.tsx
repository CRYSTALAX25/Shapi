'use client'

// ───────────────────────────────────────────────────────────────────────────
// THEME PREVIEW ONLY — a self-contained white + neon mock of the profile page.
// Sample data, no auth/DB. Lets Ana compare "white + neon" against the live dark
// /profile side-by-side before deciding whether to switch themes.
// Safe to delete once a theme is chosen.
// ───────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import Link from 'next/link'

// White + neon palette (deep, saturated accents that POP on white — not the calm
// dark-theme accents, which wash out on a light canvas).
const HERO = 'linear-gradient(135deg,#06B6D4,#7C3AED)' // cyan → violet hero
const VIOLET = '#7C3AED'
const CYAN = '#0891B2'
const EMERALD = '#059669'
const CORAL = '#E11D48'
const AMBER = '#D97706'

const TABS = ['Overview', 'Verification', 'Experience', 'Learning', 'Events', 'Assessments']

export default function ProfileWhitePreview() {
  const [active, setActive] = useState(0)

  return (
    <div className="min-h-screen" style={{ background: '#F5F6FB' }}>
      <style>{`
        .wcard {
          background: #FFFFFF;
          border: 1px solid #ECEDF4;
          box-shadow: 0 1px 2px rgba(16,16,26,0.04), 0 12px 32px rgba(16,16,26,0.06);
        }
        .neon-cta {
          box-shadow: 0 8px 24px rgba(124,58,237,0.30);
        }
        .neon-ring {
          box-shadow: 0 0 0 4px rgba(124,58,237,0.10), 0 0 28px rgba(6,182,212,0.30);
        }
      `}</style>

      {/* preview banner */}
      <div className="text-center text-xs font-bold py-2" style={{ background: HERO, color: '#fff' }}>
        PREVIEW — white + neon mock ·{' '}
        <Link href="/profile" className="underline">open the dark /profile in another tab to compare →</Link>
      </div>

      {/* nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto border-b" style={{ borderColor: '#ECEDF4' }}>
        <span className="font-black text-xl tracking-tighter" style={{ background: HERO, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</span>
        <span className="text-sm" style={{ color: '#6B6B7B' }}>← Dashboard</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">

          {/* ── Identity panel ── */}
          <aside className="lg:sticky lg:top-6 space-y-4 self-start">
            <div className="wcard rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                {/* star mascot with neon halo */}
                <div className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-2xl neon-ring" style={{ background: HERO }}>
                  <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}>★</span>
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-black leading-tight" style={{ color: '#0E0E1A' }}>Ana O. Barber</h1>
                  <p className="text-sm" style={{ color: '#6B6B7B' }}>Operations & Growth Lead</p>
                </div>
              </div>

              <p className="text-sm mb-3" style={{ color: '#9A9AA8' }}>📍 Dubai, UAE</p>

              {/* completion */}
              <div className="flex items-center gap-3 mb-3">
                <div className="text-3xl font-black" style={{ background: HERO, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>82%</div>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EEEFF5' }}>
                    <div className="h-full rounded-full" style={{ width: '82%', background: HERO }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#9A9AA8' }}>profile strength</p>
                </div>
              </div>

              {/* badges */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(5,150,105,0.12)', color: EMERALD }}>✓ Live</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(217,119,6,0.12)', color: AMBER }}>🟡 Premium Verified</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.10)', color: VIOLET }}>AI Integrator</span>
              </div>

              {/* right to work */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#9A9AA8' }}>Right to work</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F2F3F8', color: '#3F3F4E' }}>✓ UAE · Citizen</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F2F3F8', color: '#3F3F4E' }}>✓ UK · Work Visa</span>
                </div>
              </div>

              {/* actions */}
              <div className="space-y-2">
                <button className="w-full text-center text-xs font-black py-2.5 rounded-xl text-white neon-cta" style={{ background: HERO }}>Open CV Kit →</button>
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-center text-xs font-bold py-2 rounded-xl border" style={{ color: '#3F3F4E', borderColor: '#ECEDF4' }}>Edit</span>
                  <span className="text-center text-xs font-bold py-2 rounded-xl border" style={{ color: '#3F3F4E', borderColor: '#ECEDF4' }}>View public</span>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Tabs + content ── */}
          <div>
            {/* tab bar */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {TABS.map((t, i) => {
                const on = i === active
                return (
                  <button key={t} onClick={() => setActive(i)}
                    className="text-sm font-bold px-3.5 py-1.5 rounded-full transition-all"
                    style={on
                      ? { background: HERO, color: '#fff', boxShadow: '0 4px 14px rgba(124,58,237,0.28)' }
                      : { background: '#FFFFFF', color: '#6B6B7B', border: '1px solid #ECEDF4' }}>
                    {t}
                  </button>
                )
              })}
            </div>

            {active === 0 && <OverviewPanel />}
            {active === 1 && <VerificationPanel />}
            {active === 3 && <LearningPanel />}
            {![0, 1, 3].includes(active) && (
              <div className="wcard rounded-2xl p-6">
                <p className="text-sm" style={{ color: '#6B6B7B' }}>“{TABS[active]}” content would render here — this mock focuses on Overview, Verification and Learning to show the white + neon palette across different content types.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Bar({ label, color, accent }: { label: string; color: string; accent: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold" style={{ color: '#3F3F4E' }}>{label}</span>
        <span className="text-xs font-black" style={{ color: accent }}>{color}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#EEEFF5' }}>
        <div className="h-full rounded-full" style={{ width: color, background: accent }} />
      </div>
    </div>
  )
}

function OverviewPanel() {
  return (
    <div className="space-y-4">
      {/* availability + salary */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="wcard rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#9A9AA8' }}>Availability</p>
          <p className="text-lg font-black" style={{ color: EMERALD }}>● Actively looking</p>
          <p className="text-xs mt-1" style={{ color: '#6B6B7B' }}>Open to full-time + contract</p>
        </div>
        <div className="wcard rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#9A9AA8' }}>Salary expectation</p>
          <p className="text-lg font-black" style={{ color: '#0E0E1A' }}>AED 28–34k<span className="text-sm font-bold" style={{ color: '#9A9AA8' }}> /mo</span></p>
          <p className="text-xs mt-1" style={{ color: '#6B6B7B' }}>Private — matched companies only</p>
        </div>
      </div>

      {/* summary */}
      <div className="wcard rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-1.5 h-6 rounded-full" style={{ background: HERO }} />
          <h2 className="font-black text-xl tracking-tight" style={{ color: '#0E0E1A' }}>Summary</h2>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: '#3F3F4E' }}>
          Growth-focused operations lead with 8+ years scaling marketplaces across the GCC. Builds verified, data-led teams and loves turning messy early-stage processes into something that actually runs without me.
        </p>
      </div>

      {/* skill snapshot */}
      <div className="wcard rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-1.5 h-6 rounded-full" style={{ background: HERO }} />
          <h2 className="font-black text-xl tracking-tight" style={{ color: '#0E0E1A' }}>Skill snapshot</h2>
        </div>
        <div className="space-y-3">
          <Bar label="Operations" color="92%" accent={VIOLET} />
          <Bar label="Growth / Marketing" color="84%" accent={CYAN} />
          <Bar label="Data & Analytics" color="71%" accent={EMERALD} />
          <Bar label="Leadership" color="88%" accent={AMBER} />
        </div>
      </div>
    </div>
  )
}

function VerificationPanel() {
  return (
    <div className="space-y-4">
      <div className="wcard rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-6 rounded-full" style={{ background: HERO }} />
            <h2 className="font-black text-xl tracking-tight" style={{ color: '#0E0E1A' }}>AI Cross-check</h2>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(217,119,6,0.12)', color: AMBER }}>🟡 Premium Verified</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.18)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: EMERALD }}>✓ Justified & confirmed</p>
            <p className="text-xs leading-relaxed" style={{ color: '#3F3F4E' }}>Title, tenure and scope independently confirmed by 3 references — no conflicts with the CV.</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: VIOLET }}>★ Most cited strengths</p>
            <p className="text-xs leading-relaxed" style={{ color: '#3F3F4E' }}>“Calm under pressure”, “owns outcomes end-to-end”, “lifts the people around her”.</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="wcard rounded-2xl p-5 text-center">
          <p className="text-3xl font-black" style={{ color: VIOLET }}>3</p>
          <p className="text-xs font-bold mt-1" style={{ color: '#6B6B7B' }}>References verified</p>
        </div>
        <div className="wcard rounded-2xl p-5 text-center">
          <p className="text-3xl font-black" style={{ color: CYAN }}>5</p>
          <p className="text-xs font-bold mt-1" style={{ color: '#6B6B7B' }}>Evidence items</p>
        </div>
      </div>
    </div>
  )
}

function LearningPanel() {
  return (
    <div className="space-y-4">
      <div className="wcard rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-1.5 h-6 rounded-full" style={{ background: HERO }} />
          <h2 className="font-black text-xl tracking-tight" style={{ color: '#0E0E1A' }}>Learning</h2>
        </div>
        <p className="text-xs mb-5 ml-4" style={{ color: '#9A9AA8' }}>Sharpen your current field — and learn for your pivot.</p>

        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 rounded-full" style={{ background: HERO }} />
          <h3 className="text-base font-black" style={{ color: '#0E0E1A' }}>🎯 Sharpen your current field</h3>
        </div>
        <div className="space-y-2">
          {[['Financial modelling', 'high', CORAL], ['SQL for analytics', 'medium', AMBER]].map(([skill, pr, c]) => (
            <div key={skill as string} className="flex items-center justify-between rounded-xl p-3" style={{ background: '#F7F8FC', border: '1px solid #ECEDF4' }}>
              <span className="font-bold text-sm" style={{ color: '#0E0E1A' }}>{skill}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: `${c}1f`, color: c as string }}>{pr}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-6 mb-3">
          <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg,#7C3AED,#E11D48)' }} />
          <h3 className="text-base font-black" style={{ color: '#0E0E1A' }}>↗️ Learn for your pivot</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['Product strategy', 'UX research', 'Roadmapping'].map(g => (
            <span key={g} className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.10)', color: VIOLET, border: '1px solid rgba(124,58,237,0.18)' }}>{g} ↗</span>
          ))}
        </div>
      </div>
    </div>
  )
}
