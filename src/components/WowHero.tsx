'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import ShapiCharacter from '@/components/ShapiCharacter'
import { useTranslation } from '@/lib/i18n/LocaleContext'

// WOW hero — an animated treatment that WRAPS the existing dual-audience hero.
// It does NOT change any copy (all text still comes from the same t() keys, so
// all 9 locales + RTL keep working) and it preserves both signup CTAs and the
// candidate/company chooser. The motion is brand-driven: an aurora gradient
// mesh in violet→emerald→coral (Violet Mint palette — violet leads, emerald is
// the proof-glow, coral the rare punch), a "constellation" of North-Star nodes connecting
// (Shapi's matching cue), staggered fade-up of the headline, and a magnetic /
// springy hover on the two CTAs.
//
// prefers-reduced-motion: every animation here is gated behind useReducedMotion.
// When a user prefers reduced motion, the aurora + constellation render as a
// static (non-animating) layer and the staggered entrance collapses to plain,
// instantly-visible content — no transforms, no opacity tweens, no float.

export default function WowHero() {
  const { t } = useTranslation()
  const reduce = useReducedMotion()

  // Staggered container — children fade-up in sequence. With reduced motion the
  // stagger/offset are zeroed so everything is visible immediately.
  const container: Variants = {
    hidden: {},
    show: {
      transition: reduce
        ? {}
        : { staggerChildren: 0.09, delayChildren: 0.05 },
    },
  }

  const item: Variants = reduce
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 22 },
        show: {
          opacity: 1,
          y: 0,
          transition: { type: 'spring', stiffness: 90, damping: 16 },
        },
      }

  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-12 overflow-visible">
      <AuroraMesh reduce={!!reduce} />
      <Constellation reduce={!!reduce} />

      <motion.div
        className="relative text-center max-w-5xl mx-auto"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Breathing North-Star mark */}
        <motion.div className="flex justify-center mb-5" variants={item}>
          <motion.div
            animate={reduce ? undefined : { y: [0, -8, 0] }}
            transition={
              reduce
                ? undefined
                : { duration: 6, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <ShapiCharacter size={76} mood="happy" />
          </motion.div>
        </motion.div>

        {/* Status badge */}
        <motion.div
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-4"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          variants={item}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
          <span className="text-[#A6A6B4] text-xs font-medium">{t('home.hero.badgeDate')}</span>
          <span className="text-white/15">·</span>
          <span className="text-xs font-bold" style={{ color: '#FB7185' }}>{t('home.hero.badgeAccess')}</span>
        </motion.div>

        {/* Audience chooser — preserved. Candidates land here by default;
            companies tap through to the dedicated workforce-intelligence page. */}
        <motion.div className="flex flex-wrap justify-center gap-2 mb-8 text-xs font-bold" variants={item}>
          <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(157,140,255,0.15)', color: 'var(--accent)', border: '1px solid rgba(157,140,255,0.30)' }}>
            {t('home.chooser.candidate')}
          </span>
          <Link href="/for-companies" className="px-3 py-1.5 rounded-full hover:bg-white/[0.06] transition-colors" style={{ color: '#A6A6B4', border: '1px solid rgba(255,255,255,0.10)' }}>
            {t('home.chooser.company')}
          </Link>
        </motion.div>

        {/* Headline — line 1 plain, line 2 in the brand gradient ("Shape what's next.") */}
        <motion.h1 className="text-6xl md:text-[88px] font-black leading-[0.92] tracking-tighter mb-7" variants={item}>
          <span className="block">{t('home.hero.headlineLine1')}</span>
          <span
            className="block"
            style={{
              background: 'linear-gradient(135deg, #9D8CFF, #34D399, #FB7185, #9D8CFF)',
              backgroundSize: '300% 300%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: reduce ? undefined : 'wowGradientShift 7s ease infinite',
            }}
          >
            {t('home.hero.headlineLine2')}
          </span>
        </motion.h1>

        <motion.p className="text-lg md:text-xl text-[#A6A6B4] max-w-2xl mx-auto leading-relaxed mb-10" variants={item}>
          {t('home.hero.subhead')}
        </motion.p>

        {/* Dual CTAs — preserved routing + magnetic spring hover */}
        <motion.div className="flex flex-col sm:flex-row gap-3 justify-center mb-16" variants={item}>
          <MagneticCTA href="/signup?type=candidate" reduce={!!reduce} className="font-black">
            {t('home.hero.ctaBuild')}
          </MagneticCTA>
          <MagneticCTA href="/signup?type=company" reduce={!!reduce} className="font-bold">
            {t('home.hero.ctaHire')}
          </MagneticCTA>
        </motion.div>

        {/* Floating verified-profile card — the real product */}
        <motion.div className="relative max-w-md mx-auto" variants={item}>
          <div className="hidden lg:block">
            <FloatChip text={t('home.hero.chipRefs')} color="#9D8CFF" pos="-left-28 top-2" reduce={!!reduce} delay={0} />
            <FloatChip text={t('home.hero.chipCrossCheck')} color="#34D399" pos="-right-28 top-8" reduce={!!reduce} delay={1.2} />
          </div>
          <motion.div
            animate={reduce ? undefined : { y: [0, -10, 0] }}
            transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="rounded-2xl p-6 text-start" style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)',
            }}>
              {/* identity */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black text-white flex-shrink-0" style={{ background: 'var(--grad)' }}>A</div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-black text-[#F4F4F7]">{t('home.hero.cardName')}</div>
                  <div className="text-xs text-[#7E7E8E]">{t('home.hero.cardRole')}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#34D399]/15 text-[#34D399] flex-shrink-0">{t('home.hero.cardVerifiedBadge')}</span>
              </div>
              {/* profile strength */}
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl font-black" style={{ color: 'var(--verified)' }}>94%</div>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'var(--verified)' }}
                      initial={reduce ? { width: '94%' } : { width: '0%' }}
                      animate={{ width: '94%' }}
                      transition={reduce ? undefined : { duration: 1.1, ease: 'easeOut', delay: 0.5 }}
                    />
                  </div>
                  <p className="text-[#7E7E8E] text-[10px] mt-1">{t('home.hero.cardScoreLabel')}</p>
                </div>
              </div>
              {/* the USPs */}
              <div className="space-y-2.5">
                {[
                  [t('home.hero.cardItem1Label'), t('home.hero.cardItem1Sub')],
                  [t('home.hero.cardItem2Label'), t('home.hero.cardItem2Sub')],
                  [t('home.hero.cardItem3Label'), t('home.hero.cardItem3Sub')],
                  [t('home.hero.cardItem4Label'), t('home.hero.cardItem4Sub')],
                  [t('home.hero.cardItem5Label'), t('home.hero.cardItem5Sub')],
                ].map(([label, sub], i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52,211,153,0.14)' }}>
                      <svg className="w-3 h-3 text-[#34D399]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <div className="min-w-0 text-xs">
                      <span className="font-bold text-[#F4F4F7]">{label}</span>
                      <span className="text-[#7E7E8E]"> — {sub}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.08]">
                <span className="text-xs text-[#7E7E8E]">{t('home.hero.cardFooterText')}</span>
                <span className="text-xs font-black" style={{ color: 'var(--verified)' }}>{t('home.hero.cardFooterTrust')}</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* keyframes scoped to the hero */}
      <style>{`
        @keyframes wowGradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes wowAurora { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(0,-4%,0) scale(1.12); } }
      `}</style>
    </section>
  )
}

/* ---------- Aurora gradient mesh ---------- */
function AuroraMesh({ reduce }: { reduce: boolean }) {
  // Three brand-coloured radial blobs, GPU-friendly (transform/opacity only).
  const blobs = [
    { c: 'rgba(157,140,255,0.20)', cls: 'top-[-6rem] left-1/4 w-[600px] h-[600px]', dur: 11 },
    { c: 'rgba(52,211,153,0.14)', cls: 'top-10 right-1/4 w-[520px] h-[520px]', dur: 13 },
    { c: 'rgba(251,113,133,0.10)', cls: '-bottom-24 left-1/2 -translate-x-1/2 w-[440px] h-[440px]', dur: 15 },
  ]
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${b.cls}`}
          style={{ background: `radial-gradient(circle, ${b.c} 0%, transparent 70%)`, filter: 'blur(8px)' }}
          animate={reduce ? undefined : { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7], y: [0, -16, 0] }}
          transition={reduce ? undefined : { duration: b.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 1.5 }}
        />
      ))}
    </div>
  )
}

/* ---------- Constellation (North-Star matching motif) ---------- */
function Constellation({ reduce }: { reduce: boolean }) {
  // Deterministic node layout so SSR + client match (no hydration flicker).
  const nodes = useMemo(
    () => [
      { x: 12, y: 22 }, { x: 26, y: 64 }, { x: 40, y: 18 },
      { x: 58, y: 70 }, { x: 72, y: 30 }, { x: 86, y: 60 },
      { x: 48, y: 44 }, { x: 90, y: 16 },
    ],
    []
  )
  // Edges that "connect" candidates to companies — the matching cue.
  const edges: [number, number][] = [
    [0, 2], [2, 6], [6, 3], [3, 1], [4, 6], [4, 5], [4, 7],
  ]
  // Violet leads; emerald is the proof-glow accent (every third node).
  const colors = ['#9D8CFF', '#9D8CFF', '#34D399']

  return (
    <svg
      className="absolute inset-0 -z-10 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {edges.map(([a, b], i) => (
        <motion.line
          key={`e${i}`}
          x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="url(#wowEdge)"
          strokeWidth={0.18}
          initial={reduce ? { pathLength: 1, opacity: 0.35 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: reduce ? 0.35 : [0, 0.5, 0.25] }}
          transition={
            reduce
              ? undefined
              : { duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: i * 0.4 }
          }
        />
      ))}
      {nodes.map((n, i) => (
        <motion.circle
          key={`n${i}`}
          cx={n.x} cy={n.y}
          r={0.55}
          fill={colors[i % colors.length]}
          initial={reduce ? { opacity: 0.7 } : { opacity: 0.3 }}
          animate={reduce ? { opacity: 0.7 } : { opacity: [0.3, 0.9, 0.3], scale: [1, 1.5, 1] }}
          transition={reduce ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
        />
      ))}
      <defs>
        <linearGradient id="wowEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9D8CFF" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/* ---------- Magnetic / spring CTA button ---------- */
function MagneticCTA({
  href,
  children,
  className = '',
  reduce,
}: {
  href: string
  children: React.ReactNode
  className?: string
  reduce: boolean
}) {
  return (
    <motion.div
      whileHover={reduce ? undefined : { scale: 1.05, y: -2 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      className="inline-block"
    >
      <Link
        href={href}
        className={`block px-8 py-4 rounded-full text-sm transition-colors ${className}`}
        style={{ background: '#0B0B0F', color: '#F4F4F7', border: '1px solid rgba(255,255,255,0.12)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg,#9D8CFF,#34D399)'
          e.currentTarget.style.borderColor = 'transparent'
          e.currentTarget.style.color = '#fff'
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(157,140,255,0.34)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#0B0B0F'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
          e.currentTarget.style.color = '#F4F4F7'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {children}
      </Link>
    </motion.div>
  )
}

/* ---------- Floating side chips ---------- */
function FloatChip({
  text,
  color,
  pos,
  reduce,
  delay,
}: {
  text: string
  color: string
  pos: string
  reduce: boolean
  delay: number
}) {
  return (
    <motion.div
      className={`absolute z-20 ${pos} rounded-full pl-2 pr-3 py-1.5 flex items-center gap-2 whitespace-nowrap`}
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
      animate={reduce ? undefined : { y: [0, -10, 0] }}
      transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs font-bold text-[#C7C7D1]">{text}</span>
    </motion.div>
  )
}
