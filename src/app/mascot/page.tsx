'use client'

// MASCOT PREVIEW ONLY — bolder "statement character" options for the Shapi star,
// so Ana can pick the direction (Holo-style presence). Safe to delete once chosen.

import Link from 'next/link'

const GRAD = ['#06B6D4', '#7C3AED'] // brand cyan → violet

// Big expressive face shared by all variants (viewBox 0..120, centred ~60,60).
function Face({ cx = 60, eyeY = 60, scale = 1 }: { cx?: number; eyeY?: number; scale?: number }) {
  const dx = 11 * scale
  const er = 6 * scale
  return (
    <g>
      <circle cx={cx - dx} cy={eyeY + 6 * scale} r={3 * scale} fill="#FB7185" opacity="0.55" />
      <circle cx={cx + dx} cy={eyeY + 6 * scale} r={3 * scale} fill="#FB7185" opacity="0.55" />
      <g style={{ animation: 'mBlink 4.5s ease-in-out infinite', transformOrigin: `${cx}px ${eyeY}px` }}>
        <circle cx={cx - dx} cy={eyeY} r={er} fill="#14142A" />
        <circle cx={cx + dx} cy={eyeY} r={er} fill="#14142A" />
        <circle cx={cx - dx + er * 0.35} cy={eyeY - er * 0.4} r={er * 0.32} fill="#fff" />
        <circle cx={cx + dx + er * 0.35} cy={eyeY - er * 0.4} r={er * 0.32} fill="#fff" />
      </g>
      <path d={`M${cx - 9 * scale} ${eyeY + 10 * scale} Q${cx} ${eyeY + 19 * scale} ${cx + 9 * scale} ${eyeY + 10 * scale}`} stroke="#14142A" strokeWidth={3 * scale} strokeLinecap="round" fill="none" />
    </g>
  )
}

// Variant 1 — Bold Star: chunky, rounded-tip North Star, solid gradient + face.
function BoldStar({ size = 150 }: { size?: number }) {
  const id = 'bg1'
  const star = 'M60 8 L81 39 L112 60 L81 81 L60 112 L39 81 L8 60 L39 39 Z'
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <defs><linearGradient id={id} x1="20" y1="10" x2="100" y2="110" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={GRAD[0]} /><stop offset="100%" stopColor={GRAD[1]} />
      </linearGradient></defs>
      <path d={star} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth="14" strokeLinejoin="round" />
      <path d="M60 22 L74 46 L98 60 L74 74 L60 98 L46 74 L22 60 L46 46 Z" fill="#fff" fillOpacity="0.12" />
      <Face />
    </svg>
  )
}

// Variant 2 — Soft Blob Star: heavily inflated/plush star with little waving arms.
function BlobStar({ size = 150 }: { size?: number }) {
  const id = 'bg2'
  const star = 'M60 18 L76 44 L104 60 L76 76 L60 104 L44 76 L16 60 L44 44 Z'
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <defs><linearGradient id={id} x1="20" y1="10" x2="100" y2="110" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={GRAD[0]} /><stop offset="100%" stopColor={GRAD[1]} />
      </linearGradient></defs>
      {/* little arms */}
      <g style={{ animation: 'mWaveL 2.4s ease-in-out infinite', transformOrigin: '26px 70px' }}>
        <rect x="14" y="66" width="16" height="8" rx="4" fill={`url(#${id})`} />
      </g>
      <rect x="90" y="66" width="16" height="8" rx="4" fill={`url(#${id})`} />
      <path d={star} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth="26" strokeLinejoin="round" />
      <path d="M60 30 L70 50 L90 60 L70 70 L60 90 L50 70 L30 60 L50 50 Z" fill="#fff" fillOpacity="0.12" />
      <Face eyeY={61} />
    </svg>
  )
}

// Variant 3 — Hero Star: bold star + glow aura + orbiting sparkle, a confident statement.
function HeroStar({ size = 150 }: { size?: number }) {
  const id = 'bg3'
  const star = 'M60 8 L81 39 L112 60 L81 81 L60 112 L39 81 L8 60 L39 39 Z'
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${GRAD[1]}55 0%, transparent 68%)`, animation: 'mGlow 3s ease-in-out infinite' }} />
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ position: 'relative' }}>
        <defs><linearGradient id={id} x1="20" y1="10" x2="100" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67E8F9" /><stop offset="55%" stopColor="#A78BFA" /><stop offset="100%" stopColor={GRAD[1]} />
        </linearGradient></defs>
        <g style={{ animation: 'mBreathe 3.5s ease-in-out infinite', transformOrigin: '60px 60px' }}>
          <path d={star} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth="12" strokeLinejoin="round" />
          <path d="M60 22 L74 46 L98 60 L74 74 L60 98 L46 74 L22 60 L46 46 Z" fill="#fff" fillOpacity="0.12" />
          <Face />
        </g>
        <g style={{ animation: 'mSpin 7s linear infinite', transformOrigin: '60px 60px' }}>
          <path d="M60 6 L63 13 L70 16 L63 19 L60 26 L57 19 L50 16 L57 13 Z" fill="#67E8F9" />
        </g>
      </svg>
    </div>
  )
}

export default function MascotPreview() {
  const variants = [
    { name: '1 · Bold Star', desc: 'Chunky, rounded-tip star. Clean and confident.', node: BoldStar },
    { name: '2 · Soft Blob Star', desc: 'Plush, inflated star with little waving arms — most Holo-like.', node: BlobStar },
    { name: '3 · Hero Star', desc: 'Bold star + glow aura + orbiting sparkle. A statement.', node: HeroStar },
  ]
  return (
    <div className="min-h-screen bg-[#F5F6FB] text-[#0E0E1A]">
      <style>{`
        @keyframes mBlink { 0%,90%,100%{transform:scaleY(1);} 95%{transform:scaleY(0.12);} }
        @keyframes mBreathe { 0%,100%{transform:scale(1);} 50%{transform:scale(1.05);} }
        @keyframes mGlow { 0%,100%{opacity:.5;transform:scale(1.25);} 50%{opacity:.9;transform:scale(1.5);} }
        @keyframes mSpin { from{transform:rotate(0);} to{transform:rotate(360deg);} }
        @keyframes mWaveL { 0%,100%{transform:rotate(0);} 50%{transform:rotate(-22deg);} }
      `}</style>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tighter mb-1">Shapi mascot — pick a direction</h1>
          <p className="text-[#5A5A6E] text-sm">Bolder, bigger “statement character” options. Each shown on white and on dark. Tell me the number you like (or mix ideas).</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {variants.map((v) => {
            const Node = v.node
            return (
              <div key={v.name} className="rounded-2xl bg-white border border-[#0E0E1A]/[0.08] p-5" style={{ boxShadow: '0 10px 30px rgba(14,14,26,0.06)' }}>
                <p className="font-black mb-1">{v.name}</p>
                <p className="text-[#5A5A6E] text-xs mb-4 min-h-[32px]">{v.desc}</p>
                <div className="rounded-xl flex items-center justify-center py-6 mb-3" style={{ background: '#F2F3F8' }}><Node /></div>
                <div className="rounded-xl flex items-center justify-center py-6" style={{ background: '#0E0E13' }}><Node /></div>
              </div>
            )
          })}
        </div>
        <p className="text-[#8A8A99] text-xs mt-8"><Link href="/" className="underline">← back home</Link> · once you pick, I’ll wire it in everywhere (nav, hero, profile).</p>
      </div>
    </div>
  )
}
