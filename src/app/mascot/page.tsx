'use client'

// MASCOT PREVIEW — "Shapi" the North-Star character, in the directions from the
// brand brainstorm: a morphing plasma star (adaptability), a friendly celestial
// scout, a premium geometric navigator, and a hi-tech AI drone. Blue-led palette.
// Safe to delete once a direction is chosen.

import Link from 'next/link'

// Blue gradient stops (gently shifting) — no purple/pink.
function BlueStops({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="20" y1="10" x2="100" y2="110" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="#8FC2FF"><animate attributeName="stop-color" values="#8FC2FF;#6AA8F5;#A9D0FF;#8FC2FF" dur="7s" repeatCount="indefinite" /></stop>
      <stop offset="55%" stopColor="#6AA8F5"><animate attributeName="stop-color" values="#6AA8F5;#4F8FE8;#6AA8F5;#6AA8F5" dur="7s" repeatCount="indefinite" /></stop>
      <stop offset="100%" stopColor="#4F8FE8"><animate attributeName="stop-color" values="#4F8FE8;#6AA8F5;#8FC2FF;#4F8FE8" dur="7s" repeatCount="indefinite" /></stop>
    </linearGradient>
  )
}

// Cute face shared by the friendlier variants.
function Face({ eyeY = 58, mouth = 'M52 66 Q60 73 68 66' }: { eyeY?: number; mouth?: string }) {
  return (
    <g>
      <circle cx="49" cy={eyeY + 5} r="3" fill="#FB7185" opacity="0.45" />
      <circle cx="71" cy={eyeY + 5} r="3" fill="#FB7185" opacity="0.45" />
      <g style={{ animation: 'mBlink 4.5s ease-in-out infinite', transformOrigin: `60px ${eyeY}px` }}>
        <circle cx="51" cy={eyeY} r="5" fill="#14142A" />
        <circle cx="69" cy={eyeY} r="5" fill="#14142A" />
        <circle cx="52.5" cy={eyeY - 1.6} r="1.6" fill="#fff" />
        <circle cx="70.5" cy={eyeY - 1.6} r="1.6" fill="#fff" />
      </g>
      <path d={mouth} stroke="#14142A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </g>
  )
}

const STAR = 'M60 8 L81 39 L112 60 L81 81 L60 112 L39 81 L8 60 L39 39 Z'

// 1 — Plasma Shapi: soft, glowing, morphing star (adaptability = superpower).
function PlasmaStar({ size = 150 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(106,168,245,0.45) 0%, transparent 66%)', animation: 'mGlow 3s ease-in-out infinite' }} />
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ position: 'relative' }}>
        <defs>
          <BlueStops id="pg" />
          <filter id="psoft"><feGaussianBlur stdDeviation="1.4" /><feComponentTransfer><feFuncA type="linear" slope="1.4" /></feComponentTransfer><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g style={{ animation: 'mMorph 4s ease-in-out infinite', transformOrigin: '60px 60px' }}>
          <path d={STAR} fill="url(#pg)" stroke="url(#pg)" strokeWidth="16" strokeLinejoin="round" filter="url(#psoft)" />
          <path d="M60 24 L72 48 L96 60 L72 72 L60 96 L48 72 L24 60 L48 48 Z" fill="#fff" fillOpacity="0.12" />
          <Face />
        </g>
      </svg>
    </div>
  )
}

// 2 — Celestial Scout: friendly star with a utility belt + raised pointing arm.
function ScoutStar({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <defs><BlueStops id="sg" /></defs>
      {/* raised pointing arm */}
      <g style={{ animation: 'mPoint 2.6s ease-in-out infinite', transformOrigin: '92px 44px' }}>
        <rect x="92" y="40" width="20" height="7" rx="3.5" fill="url(#sg)" transform="rotate(-30 92 44)" />
        <circle cx="111" cy="33" r="3" fill="#FBBF24" />
      </g>
      {/* legs/boots */}
      <rect x="48" y="104" width="8" height="10" rx="3" fill="url(#sg)" />
      <rect x="64" y="104" width="8" height="10" rx="3" fill="url(#sg)" />
      <path d={STAR} fill="url(#sg)" stroke="url(#sg)" strokeWidth="13" strokeLinejoin="round" />
      {/* utility belt */}
      <path d="M34 74 Q60 84 86 74" stroke="#14142A" strokeOpacity="0.5" strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="55" y="73" width="10" height="8" rx="2" fill="#FBBF24" />
      <Face eyeY={54} />
    </svg>
  )
}

// 3 — Geometric Navigator: faceted glass star, premium + stable.
function NavigatorStar({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ animation: 'mBreathe 4s ease-in-out infinite', transformOrigin: '60px 60px' }}>
      <defs><BlueStops id="ng" /></defs>
      <path d={STAR} fill="url(#ng)" stroke="url(#ng)" strokeWidth="8" strokeLinejoin="round" />
      {/* facets */}
      <path d="M60 8 L60 60 L39 39 Z" fill="#fff" fillOpacity="0.18" />
      <path d="M112 60 L60 60 L81 39 Z" fill="#fff" fillOpacity="0.10" />
      <path d="M60 112 L60 60 L81 81 Z" fill="#fff" fillOpacity="0.16" />
      <path d="M8 60 L60 60 L39 81 Z" fill="#000" fillOpacity="0.10" />
      <path d="M60 8 L60 60 L81 39 Z" fill="#000" fillOpacity="0.08" />
      <Face eyeY={56} mouth="M53 64 Q60 69 67 64" />
    </svg>
  )
}

// 4 — AI Drone: sleek hovering star-drone with a screen face + LED lines.
function DroneStar({ size = 150 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(106,168,245,0.4) 0%, transparent 66%)', animation: 'mGlow 3s ease-in-out infinite' }} />
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ position: 'relative', animation: 'mHover 3s ease-in-out infinite' }}>
        <defs><BlueStops id="dg" /></defs>
        <path d={STAR} fill="url(#dg)" stroke="url(#dg)" strokeWidth="11" strokeLinejoin="round" />
        {/* LED lines */}
        <path d="M40 44 L52 44 M68 44 L80 44" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
        {/* dark screen face */}
        <rect x="40" y="50" width="40" height="26" rx="9" fill="#0B1020" />
        <g style={{ animation: 'mBlink 4s ease-in-out infinite', transformOrigin: '60px 63px' }}>
          <rect x="48" y="58" width="6" height="10" rx="3" fill="#7DD3FC" />
          <rect x="66" y="58" width="6" height="10" rx="3" fill="#7DD3FC" />
        </g>
      </svg>
    </div>
  )
}

export default function MascotPreview() {
  const variants = [
    { name: '1 · Plasma Shapi', desc: 'Soft, glowing star that gently morphs — "adaptability is the superpower". The brainstorm’s hero idea.', node: PlasmaStar },
    { name: '2 · Celestial Scout', desc: 'Friendly guide with a utility belt + pointing to the horizon. Most human / approachable.', node: ScoutStar },
    { name: '3 · Geometric Navigator', desc: 'Faceted glass star — premium, stable, executive. Subtle breathing.', node: NavigatorStar },
    { name: '4 · AI Drone', desc: 'Sleek hovering star-drone with a screen face + LED lines. Hi-tech / automated.', node: DroneStar },
  ]
  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <style>{`
        @keyframes mBlink { 0%,90%,100%{transform:scaleY(1);} 95%{transform:scaleY(0.12);} }
        @keyframes mBreathe { 0%,100%{transform:scale(1);} 50%{transform:scale(1.05);} }
        @keyframes mGlow { 0%,100%{opacity:.5;transform:scale(1.25);} 50%{opacity:.9;transform:scale(1.5);} }
        @keyframes mMorph { 0%,100%{transform:scale(1);} 33%{transform:scale(1.06,0.95);} 66%{transform:scale(0.96,1.05);} }
        @keyframes mHover { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
        @keyframes mPoint { 0%,100%{transform:rotate(0);} 50%{transform:rotate(-14deg);} }
      `}</style>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tighter mb-1">Shapi mascot — brainstorm directions</h1>
          <p className="text-[#A6A6B4] text-sm">Four takes on the North-Star character, blue-led. Tell me a number (or mix — e.g. "Plasma shape with the Scout’s friendliness").</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {variants.map((v) => {
            const Node = v.node
            return (
              <div key={v.name} className="rounded-2xl p-5" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }}>
                <p className="font-black mb-1">{v.name}</p>
                <p className="text-[#A6A6B4] text-xs mb-4 min-h-[32px]">{v.desc}</p>
                <div className="rounded-xl flex items-center justify-center py-8" style={{ background: '#0B0B10', border: '1px solid rgba(255,255,255,0.06)' }}><Node /></div>
              </div>
            )
          })}
        </div>
        <p className="text-[#7E7E8E] text-xs mt-8"><Link href="/" className="underline">← back home</Link> · once you pick, I’ll wire it in everywhere (nav, hero, profile) and retire the others.</p>
      </div>
    </div>
  )
}
