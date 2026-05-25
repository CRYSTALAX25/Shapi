'use client'

// PREVIEW ONLY — shows the candidate 3D mascot images in the real homepage-hero
// context so Ana can see how they'd feel on the site. The PNGs still have their
// original backgrounds (need transparent cut-outs for production). Safe to delete.

import Link from 'next/link'

function HeroMock({ src, label }: { src: string; label: string }) {
  return (
    <div className="rounded-3xl overflow-hidden mb-10" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* mini nav with mascot as logo mark */}
      <div className="flex items-center justify-between px-5 py-3" style={{ background: 'rgba(22,22,31,0.9)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <img src={src} alt="" className="w-8 h-8 rounded-full object-cover" />
          <span className="font-black text-lg tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</span>
        </div>
        <span className="text-[#A6A6B4] text-xs">AI risk check · Why Shapi · Pricing</span>
      </div>

      {/* hero */}
      <div className="relative px-6 py-12 text-center" style={{ background: '#0E0E13' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative">
          <img src={src} alt={label} className="mx-auto mb-6 object-contain" style={{
            height: 230,
            WebkitMaskImage: 'radial-gradient(ellipse 62% 72% at 50% 44%, #000 50%, transparent 70%)',
            maskImage: 'radial-gradient(ellipse 62% 72% at 50% 44%, #000 50%, transparent 70%)',
            filter: 'drop-shadow(0 12px 30px rgba(106,168,245,0.25))',
          }} />
          <h1 className="text-4xl md:text-5xl font-black leading-[0.95] tracking-tighter mb-4">
            <span className="block text-[#F4F4F7]">Hiring that actually</span>
            <span className="block" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>works for humans.</span>
          </h1>
          <p className="text-[#A6A6B4] text-sm max-w-md mx-auto mb-6">The verification layer for hiring — references sourced independently, skills proven by evidence.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <span className="px-6 py-3 rounded-full text-sm font-black text-[#F4F4F7]" style={{ background: '#0B0B0F', border: '1px solid rgba(255,255,255,0.12)' }}>Build my verified profile →</span>
            <span className="px-6 py-3 rounded-full text-sm font-bold text-[#F4F4F7]" style={{ background: '#0B0B0F', border: '1px solid rgba(255,255,255,0.12)' }}>I&apos;m hiring →</span>
          </div>
        </div>
      </div>
      <p className="text-center text-[#7E7E8E] text-xs py-3" style={{ background: '#16161F' }}>{label}</p>
    </div>
  )
}

export default function MascotOnSite() {
  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-black tracking-tighter mb-1">Mascot, in context</h1>
        <p className="text-[#A6A6B4] text-sm mb-2">A rough look at the 3D star on the homepage hero + as the nav logo mark.</p>
        <p className="text-[#7E7E8E] text-xs mb-8">⚠️ These still have their original photo backgrounds — for real use we&apos;d need transparent cut-outs (then the square edges disappear). This is just to feel the vibe.</p>

        <HeroMock src="/mascot/vest.png" label="Option 2 — hi-vis vest (blue + white collar)" />
        <HeroMock src="/mascot/suit.png" label="Option 1 — suit (corporate)" />

        <p className="text-[#7E7E8E] text-xs"><Link href="/" className="underline">← back home</Link></p>
      </div>
    </div>
  )
}
