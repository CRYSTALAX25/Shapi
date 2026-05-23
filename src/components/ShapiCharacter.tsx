'use client'

import { useId } from 'react'

// Shapi's mark — a North Star / compass. Conveys guidance + trust ("Shape
// what's next") rather than a generic AI blob. A 4-point star inside a slowly
// rotating compass ring, brand-gradient filled, with a pulsing glow, a
// breathing star, and a sparkle that orbits the ring — always gently in motion.

type Mood = 'idle' | 'thinking' | 'happy' | 'listening'

interface ShapiCharacterProps {
  mood?: Mood
  size?: number
  className?: string
  // Optional theme tint — overrides the default brand gradient + glow so the
  // star can live in any colour world.
  tint?: { from: string; to: string; glow?: string }
}

export default function ShapiCharacter({ mood = 'idle', size = 80, className = '', tint }: ShapiCharacterProps) {
  const uid = useId().replace(/:/g, '')
  const gradId = `shapiStar-${uid}`
  const blurId = `shapiBlur-${uid}`

  const defaultGlow: Record<Mood, string> = {
    idle: 'rgba(34,211,238,0.40)',
    thinking: 'rgba(167,139,250,0.50)',
    happy: 'rgba(34,211,238,0.60)',
    listening: 'rgba(251,113,133,0.42)',
  }
  const glowColor = tint?.glow || defaultGlow[mood]
  // Ring spins faster while "thinking" (actively searching for direction).
  const ringSpin = mood === 'thinking' ? 8 : 24
  const starPath = 'M50 6 L60.6 39.4 L94 50 L60.6 60.6 L50 94 L39.4 60.6 L6 50 L39.4 39.4 Z'

  const stops = tint
    ? [{ o: '0%', c: tint.from }, { o: '100%', c: tint.to }]
    : [{ o: '0%', c: '#67E8F9' }, { o: '55%', c: '#A78BFA' }, { o: '100%', c: '#7C3AED' }]

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <style>{`
        @keyframes shapiSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shapiSpinR { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes shapiGlow { 0%,100% { opacity:.55; transform: scale(1.3); } 50% { opacity:1; transform: scale(1.6); } }
        @keyframes shapiBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes shapiOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Pulsing glow */}
      <div className="absolute inset-0 rounded-full" style={{
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 68%)`,
        animation: 'shapiGlow 3s ease-in-out infinite',
      }} />

      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'relative' }}>
        <defs>
          <linearGradient id={gradId} x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
            {stops.map((s, i) => <stop key={i} offset={s.o} stopColor={s.c} />)}
          </linearGradient>
          <filter id={blurId}>
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Compass ring — always slowly rotating (faster when thinking) */}
        <g style={{ animation: `shapiSpin ${ringSpin}s linear infinite`, transformOrigin: '50px 50px' }}>
          <circle cx="50" cy="50" r="45" stroke={`url(#${gradId})`} strokeWidth="1.4" strokeOpacity="0.4" fill="none" />
          {[0, 90, 180, 270].map(deg => {
            const rad = (deg * Math.PI) / 180
            const x1 = 50 + 45 * Math.sin(rad), y1 = 50 - 45 * Math.cos(rad)
            const x2 = 50 + 39 * Math.sin(rad), y2 = 50 - 39 * Math.cos(rad)
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`url(#${gradId})`} strokeWidth="2.2" strokeOpacity="0.55" strokeLinecap="round" />
          })}
          {/* Orbiting sparkle on the ring — constant gentle motion */}
          <circle cx="50" cy="5" r="2.2" fill={tint?.from || '#67E8F9'} />
        </g>

        {/* The North Star — gently breathing */}
        <g style={{ animation: 'shapiBreathe 3.5s ease-in-out infinite', transformOrigin: '50px 50px' }}>
          <path d={starPath} fill={`url(#${gradId})`} filter={`url(#${blurId})`} />
          <path d="M50 18 L57 43 L82 50 L57 57 L50 82 L43 57 L18 50 L43 43 Z" fill="white" fillOpacity="0.14" />
          <circle cx="50" cy="50" r="3" fill="white" fillOpacity="0.9" />
        </g>

        {/* Happy: a second twinkle that counter-orbits */}
        {mood === 'happy' && (
          <g style={{ animation: 'shapiSpinR 6s linear infinite', transformOrigin: '50px 50px' }}>
            <path d="M50 12 L52 18 L58 20 L52 22 L50 28 L48 22 L42 20 L48 18 Z" fill={tint?.from || '#67E8F9'} />
          </g>
        )}
      </svg>
    </div>
  )
}
