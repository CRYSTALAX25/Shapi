// 4-axis radar chart for the Skill Quadrant — Hands · Heart · Head · Spark.
// Pure SVG, no external dependency. Each axis is 0-10.

type SkillQuadrant = {
  hands: number
  heart: number
  head: number
  spark: number
  reasoning?: string
}

const AXES = [
  { key: 'head' as const, label: 'Head', sub: 'analytical · technical', icon: '🧠' },
  { key: 'spark' as const, label: 'Spark', sub: 'creative · strategic', icon: '✨' },
  { key: 'heart' as const, label: 'Heart', sub: 'interpersonal · leadership', icon: '❤️' },
  { key: 'hands' as const, label: 'Hands', sub: 'practical · physical', icon: '🔧' },
]

export default function SkillRadar({
  data,
  size = 280,
  showLabels = true,
  showReasoning = true,
}: {
  data: SkillQuadrant | null
  size?: number
  showLabels?: boolean
  showReasoning?: boolean
}) {
  if (!data) return null

  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.38

  // 4 axes: top (Head), right (Spark), bottom (Heart), left (Hands)
  // Angles in radians (0 = right, π/2 = down in SVG coords)
  const angles = {
    head: -Math.PI / 2,    // top
    spark: 0,              // right
    heart: Math.PI / 2,    // bottom
    hands: Math.PI,        // left
  }

  // Compute the 4 data points on each axis
  const point = (key: keyof typeof angles, value: number) => {
    const r = (value / 10) * maxR
    const angle = angles[key]
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), value }
  }

  const pts = {
    head: point('head', Math.max(0, Math.min(10, data.head))),
    spark: point('spark', Math.max(0, Math.min(10, data.spark))),
    heart: point('heart', Math.max(0, Math.min(10, data.heart))),
    hands: point('hands', Math.max(0, Math.min(10, data.hands))),
  }

  // Filled shape path (top → right → bottom → left → close)
  const pathD = `M ${pts.head.x} ${pts.head.y} L ${pts.spark.x} ${pts.spark.y} L ${pts.heart.x} ${pts.heart.y} L ${pts.hands.x} ${pts.hands.y} Z`

  // Grid rings — 4 concentric squares at 25/50/75/100%
  const ringPaths = [0.25, 0.5, 0.75, 1].map(r => {
    const rad = r * maxR
    return `M ${cx} ${cy - rad} L ${cx + rad} ${cy} L ${cx} ${cy + rad} L ${cx - rad} ${cy} Z`
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        {/* Grid rings */}
        {ringPaths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        ))}
        {/* Axes — light gridlines through center */}
        <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="rgba(255,255,255,0.12)" />
        <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="rgba(255,255,255,0.12)" />
        {/* (gridlines above are dark-on-white) */}

        {/* Data shape */}
        <defs>
          <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <path d={pathD} fill="url(#radarFill)" stroke="#38BDF8" strokeWidth={2} strokeLinejoin="round" />

        {/* Data point dots */}
        {Object.values(pts).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="#38BDF8" stroke="#0D0C14" strokeWidth={1.5} />
        ))}

        {/* Axis labels */}
        {showLabels && AXES.map(({ key, label, icon }) => {
          const angle = angles[key]
          const labelR = maxR + 24
          const lx = cx + labelR * Math.cos(angle)
          const ly = cy + labelR * Math.sin(angle)
          return (
            <g key={key}>
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#C7C7D1"
                fontSize={13}
                fontWeight={700}
                style={{ userSelect: 'none' }}
              >
                {icon} {label}
              </text>
              <text
                x={lx}
                y={ly + 16}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#38BDF8"
                fontSize={14}
                fontWeight={900}
                style={{ userSelect: 'none' }}
              >
                {Math.round(data[key])}
              </text>
            </g>
          )
        })}
      </svg>

      {showReasoning && data.reasoning && (
        <p className="text-[#A6A6B4] text-xs leading-relaxed text-center max-w-sm">{data.reasoning}</p>
      )}
    </div>
  )
}

// Compact axes-only summary (e.g. for cards) — no SVG, just text chips
export function SkillSummary({ data }: { data: SkillQuadrant | null }) {
  if (!data) return null
  return (
    <div className="flex flex-wrap gap-2">
      {AXES.map(({ key, label, icon }) => {
        const score = Math.round(data[key])
        const highlight = score >= 7
        return (
          <span
            key={key}
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{
              background: highlight ? 'rgba(56, 189, 248, 0.10)' : 'rgba(255,255,255,0.05)',
              color: highlight ? '#38BDF8' : '#A6A6B4',
              border: `1px solid ${highlight ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {icon} {label} {score}
          </span>
        )
      })}
    </div>
  )
}
