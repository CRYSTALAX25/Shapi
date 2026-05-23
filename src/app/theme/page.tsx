import Link from 'next/link'
import { THEMES } from './themes'

export const metadata = { title: 'Theme options — Shapi' }

export default function ThemeIndex() {
  const themes = Object.values(THEMES)
  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black tracking-tighter mb-2">Pick a direction</h1>
        <p className="text-[#A6A6B4] text-sm mb-8">Same candidate profile, three theme worlds. Open each full-screen, then tell me which one.</p>

        <div className="grid sm:grid-cols-3 gap-4">
          {themes.map(t => (
            <Link key={t.key} href={`/theme/${t.key}`}
              className="rounded-2xl p-5 block transition-transform hover:-translate-y-1"
              style={{ background: t.pageBg, border: `1px solid ${t.cardBorder}` }}>
              {/* mini swatch */}
              <div className="rounded-xl p-4 mb-3" style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow }}>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: t.accent }} />
                  <span className="w-3 h-3 rounded-full" style={{ background: t.trust }} />
                  <span className="w-8 h-3 rounded-full" style={{ background: t.buttonGradient }} />
                </div>
                <div className="h-2 w-2/3 rounded-full mb-1.5" style={{ background: t.text, opacity: 0.85 }} />
                <div className="h-2 w-1/2 rounded-full" style={{ background: t.textSec }} />
              </div>
              <p className="font-black text-sm" style={{ color: t.text }}>{t.name}</p>
              <p className="text-xs mt-1" style={{ color: t.textSec }}>{t.blurb}</p>
              <p className="text-xs font-bold mt-3" style={{ color: t.accent }}>Open full screen →</p>
            </Link>
          ))}
        </div>

        <p className="text-[#6B6B78] text-xs mt-8">Preview only — nothing else changes until you choose. URLs: /theme/dark · /theme/warm · /theme/mono</p>
      </div>
    </div>
  )
}
