'use client'

// Shapi's mark — a North Star / compass. Conveys guidance + trust ("Shape
// what's next") rather than a generic AI blob. A 4-point star inside a faint
// compass ring, brand-gradient filled, with a soft glow that shifts by mood.

type Mood = 'idle' | 'thinking' | 'happy' | 'listening'

interface ShapiCharacterProps {
  mood?: Mood
  size?: number
  className?: string
}

export default function ShapiCharacter({ mood = 'idle', size = 80, className = '' }: ShapiCharacterProps) {
  const glow: Record<Mood, string> = {
    idle: 'rgba(34,211,238,0.30)',
    thinking: 'rgba(167,139,250,0.40)',
    happy: 'rgba(34,211,238,0.50)',
    listening: 'rgba(251,113,133,0.32)',
  }
  // The star itself: a 4-point compass star centred in a 100×100 viewBox.
  const starPath = 'M50 6 L60.6 39.4 L94 50 L60.6 60.6 L50 94 L39.4 60.6 L6 50 L39.4 39.4 Z'

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <style>{`
        @keyframes shapiSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shapiPulse { 0%,100% { opacity: .55; transform: scale(1.25); } 50% { opacity: .9; transform: scale(1.5); } }
        @keyframes shapiTwinkle { 0%,100% { opacity: .4; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.1); } }
      `}</style>

      {/* Glow */}
      <div className="absolute inset-0 rounded-full" style={{
        background: `radial-gradient(circle, ${glow[mood]} 0%, transparent 70%)`,
        animation: 'shapiPulse 3.2s ease-in-out infinite',
      }} />

      <svg
        width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'relative' }}
      >
        <defs>
          <linearGradient id="shapiStar" x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="55%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <filter id="shapiBlur">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Compass ring — slowly rotates when "thinking" (searching for the way) */}
        <g style={mood === 'thinking' ? { animation: 'shapiSpin 14s linear infinite', transformOrigin: '50px 50px' } : undefined}>
          <circle cx="50" cy="50" r="44" stroke="url(#shapiStar)" strokeWidth="1.4" strokeOpacity="0.35" fill="none" />
          {/* N/E/S/W tick marks */}
          {[0, 90, 180, 270].map(deg => {
            const rad = (deg * Math.PI) / 180
            const x1 = 50 + 44 * Math.sin(rad), y1 = 50 - 44 * Math.cos(rad)
            const x2 = 50 + 39 * Math.sin(rad), y2 = 50 - 39 * Math.cos(rad)
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#shapiStar)" strokeWidth="2" strokeOpacity="0.5" strokeLinecap="round" />
          })}
        </g>

        {/* The North Star */}
        <path d={starPath} fill="url(#shapiStar)" filter="url(#shapiBlur)" />
        {/* Inner sheen for depth */}
        <path d="M50 18 L57 43 L82 50 L57 57 L50 82 L43 57 L18 50 L43 43 Z" fill="white" fillOpacity="0.12" />
        {/* Centre point */}
        <circle cx="50" cy="50" r="3" fill="white" fillOpacity="0.85" />

        {/* Happy: a little twinkle off the top-right point */}
        {mood === 'happy' && (
          <g style={{ animation: 'shapiTwinkle 1.6s ease-in-out infinite', transformOrigin: '78px 24px' }}>
            <path d="M78 18 L80 23 L85 24 L80 25 L78 30 L76 25 L71 24 L76 23 Z" fill="#67E8F9" />
          </g>
        )}
      </svg>
    </div>
  )
}
