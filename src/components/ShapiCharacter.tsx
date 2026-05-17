'use client'

type Mood = 'idle' | 'thinking' | 'happy' | 'listening'

interface ShapiCharacterProps {
  mood?: Mood
  size?: number
  className?: string
}

export default function ShapiCharacter({ mood = 'idle', size = 80, className = '' }: ShapiCharacterProps) {
  const animations: Record<Mood, string> = {
    idle: 'animate-pulse',
    thinking: 'animate-bounce',
    happy: '',
    listening: 'animate-pulse',
  }

  const glowColour: Record<Mood, string> = {
    idle: 'rgba(34,211,238,0.25)',
    thinking: 'rgba(167,139,250,0.35)',
    happy: 'rgba(34,211,238,0.45)',
    listening: 'rgba(251,113,133,0.3)',
  }

  const eyeY = size * 0.42
  const eyeSpacing = size * 0.14
  const eyeR = size * 0.055
  const mouthY = size * 0.6

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* Glow ring */}
      <div className={`absolute inset-0 rounded-full ${animations[mood]}`} style={{
        background: `radial-gradient(circle, ${glowColour[mood]} 0%, transparent 70%)`,
        transform: 'scale(1.4)',
      }} />

      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="shapiBody" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="50%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#7C3AED" />
          </radialGradient>
          <radialGradient id="shapiSheen" cx="35%" cy="25%" r="40%">
            <stop offset="0%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <filter id="shapiGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Body */}
        <ellipse cx="50" cy="52" rx="38" ry="40" fill="url(#shapiBody)" filter="url(#shapiGlow)" />

        {/* Sheen */}
        <ellipse cx="50" cy="52" rx="38" ry="40" fill="url(#shapiSheen)" />

        {/* Eyes */}
        {mood === 'thinking' ? (
          // Squinting / thinking eyes
          <>
            <ellipse cx={50 - eyeSpacing * 1.8} cy={eyeY} rx={eyeR * 1.4} ry={eyeR * 0.5} fill="white" fillOpacity="0.95" />
            <ellipse cx={50 + eyeSpacing * 1.8} cy={eyeY} rx={eyeR * 1.4} ry={eyeR * 0.5} fill="white" fillOpacity="0.95" />
          </>
        ) : mood === 'happy' ? (
          // Happy arc eyes
          <>
            <path d={`M ${50 - eyeSpacing * 1.8 - eyeR} ${eyeY} Q ${50 - eyeSpacing * 1.8} ${eyeY - eyeR * 1.8} ${50 - eyeSpacing * 1.8 + eyeR} ${eyeY}`}
              stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.95" />
            <path d={`M ${50 + eyeSpacing * 1.8 - eyeR} ${eyeY} Q ${50 + eyeSpacing * 1.8} ${eyeY - eyeR * 1.8} ${50 + eyeSpacing * 1.8 + eyeR} ${eyeY}`}
              stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.95" />
          </>
        ) : (
          // Default dot eyes
          <>
            <circle cx={50 - eyeSpacing * 1.8} cy={eyeY} r={eyeR * 1.1} fill="white" fillOpacity="0.95" />
            <circle cx={50 + eyeSpacing * 1.8} cy={eyeY} r={eyeR * 1.1} fill="white" fillOpacity="0.95" />
          </>
        )}

        {/* Mouth */}
        {mood === 'happy' && (
          <path d={`M ${50 - 10} ${mouthY} Q 50 ${mouthY + 8} ${50 + 10} ${mouthY}`}
            stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
        )}
        {mood === 'thinking' && (
          <circle cx="62" cy={mouthY - 2} r="2.5" fill="white" fillOpacity="0.6" />
        )}
      </svg>
    </div>
  )
}
