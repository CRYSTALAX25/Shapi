// /profile/positioning — the candidate's Verified Positioning CV, built from
// their deep-dive. If they haven't done it yet, this is where they start it.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PositioningStatement, type CVData, type Axis } from '@/components/cv/positioning'
import StartDeepDiveButton from './StartDeepDiveButton'
import { GenerateFromCvButton, PrintButton } from './Actions'

type RawProof = { axis?: string; number?: string; outcome?: string; context?: string; verifier?: string | null; confidence?: string; verification?: string }
type Result = { headline?: string; roleLabel?: string; narrative?: string; proofs?: RawProof[] }
type Deepdive = { status?: string; result?: Result } | null

const AXES: Axis[] = ['Head', 'Hands', 'Spark', 'Heart']
function asAxis(s: string | undefined): Axis {
  const m = AXES.find(a => a.toLowerCase() === String(s || '').toLowerCase())
  return m || 'Head'
}

function tierLabel(vt: string | null | undefined): CVData['tier'] {
  return vt === 'premium' ? 'Premium' : vt === 'strong' ? 'Strongly' : vt === 'basic' ? 'Basic' : undefined
}

// Honest verification mapping: nothing claims ✓ Verified until the reference
// engine confirms it. Deep-dive/CV proofs are ◆ Shapi-assessed; thin ones ○ self.
function proofV(p: RawProof): 'verified' | 'assessed' | 'self' {
  // The extractor sets this honestly (✓ only when references confirm the claim).
  if (p.verification === 'verified' || p.verification === 'assessed' || p.verification === 'self') return p.verification
  // Fallback if absent: never claim verified.
  if (p.confidence === 'low' || !p.number) return 'self'
  return 'assessed'
}

const ARCHETYPE: Record<Axis, string> = {
  Head: 'The Strategist', Hands: 'The Grafter', Spark: 'The Builder', Heart: 'The People-Builder',
}
const AXIS_BAR: Record<Axis, string> = {
  Head: 'Head — judgement & strategy', Hands: 'Hands — the craft & delivery',
  Spark: 'Spark — building new', Heart: 'Heart — people',
}

function buildExpertise(sq: unknown): CVData['expertise'] {
  const q = (sq && typeof sq === 'object' ? sq : {}) as Record<string, number>
  const scores: { axis: Axis; v: number }[] = [
    { axis: 'Head', v: Number(q.head) || 0 },
    { axis: 'Hands', v: Number(q.hands) || 0 },
    { axis: 'Spark', v: Number(q.spark) || 0 },
    { axis: 'Heart', v: Number(q.heart) || 0 },
  ].sort((a, b) => b.v - a.v)
  const hasData = scores.some(s => s.v > 0)
  return {
    label: hasData ? ARCHETYPE[scores[0].axis] : 'Your working style',
    bars: scores.map(s => ({ name: AXIS_BAR[s.axis], v: hasData ? Math.round(s.v * 10) : 50 })),
  }
}

function prettyEngagement(e: string): string {
  const map: Record<string, string> = { permanent: 'Permanent', temp: 'Temp / Shifts', shift: 'Shifts', fractional: 'Fractional', contract: 'Contract', freelance: 'Freelance', advisory: 'Advisory', parttime: 'Part-time' }
  return map[String(e).toLowerCase().replace(/[^a-z]/g, '')] || (e.charAt(0).toUpperCase() + e.slice(1))
}

function normalizeRTW(rtw: unknown): string[] {
  if (Array.isArray(rtw)) return rtw.map(String).filter(Boolean)
  if (typeof rtw === 'string' && rtw.trim()) return [rtw.trim()]
  if (rtw && typeof rtw === 'object') return Object.values(rtw as Record<string, unknown>).map(String).filter(Boolean)
  return []
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060609]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/cv-ready" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">← CV</Link>
      </nav>
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-20">{children}</div>
    </div>
  )
}

export default async function PositioningCVPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, verification_tier, skill_quadrant, open_to_engagement, languages_spoken, right_to_work, positioning_deepdive')
    .eq('id', user.id)
    .single()

  const dd = (profile?.positioning_deepdive as Deepdive) || null
  const result = dd?.result

  // ── Has a built CV → render it ──
  if (result && Array.isArray(result.proofs) && result.proofs.length > 0) {
    const eng = Array.isArray(profile?.open_to_engagement) ? (profile!.open_to_engagement as string[]) : []
    const langs = Array.isArray(profile?.languages_spoken) ? (profile!.languages_spoken as Array<{ language?: string; level?: string }>) : []
    const data: CVData = {
      name: profile?.full_name || 'You',
      roleLabel: result.roleLabel || (profile?.headline as string) || '',
      tier: tierLabel(profile?.verification_tier as string | null),
      headline: result.headline || '',
      narrative: result.narrative || '',
      proofs: result.proofs.filter(p => p?.number).map(p => ({
        axis: asAxis(p.axis), number: String(p.number), outcome: String(p.outcome || ''), context: String(p.context || ''), v: proofV(p),
      })),
      expertise: buildExpertise(profile?.skill_quadrant),
      waysToWork: eng.length ? eng.map(prettyEngagement) : ['Permanent'],
      languages: langs.length ? langs.map(l => ({ name: l.language || 'Language', verified: false })) : [{ name: 'English' }],
      rightToWork: normalizeRTW(profile?.right_to_work),
      profileUrl: `shapi.io/p/${user.id.slice(0, 8)}`,
    }
    return (
      <Shell>
        <style>{`@media print { nav, .no-print, .fixed { display: none !important } body { background: #060609 !important } }`}</style>
        <div className="mb-6 flex items-start justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl font-black text-[#F4F4F7] mb-1">Your Verified Positioning CV</h1>
            <p className="text-[#7E7E8E] text-sm">As your references come back, more proofs move from ◆ Shapi-assessed to ✓ Verified.</p>
          </div>
          <div className="flex-shrink-0"><PrintButton /></div>
        </div>
        <div className="flex justify-center mb-8"><PositioningStatement d={data} /></div>
        <div className="flex justify-center no-print"><StartDeepDiveButton restart label="Redo my deep-dive →" /></div>
      </Shell>
    )
  }

  // ── In progress on WhatsApp ──
  if (dd?.status === 'in_progress') {
    return (
      <Shell>
        <div className="rounded-2xl p-6" style={{ background: '#0D0C14', border: '1px solid rgba(56,189,248,0.25)' }}>
          <p className="text-[#38BDF8] text-xs font-bold uppercase tracking-wider mb-2">Deep-dive in progress</p>
          <h1 className="text-2xl font-black text-[#F4F4F7] mb-2">Check WhatsApp — we&apos;re talking right now.</h1>
          <p className="text-[#A6A6B4] text-sm leading-relaxed">Answer the questions on WhatsApp (voice notes welcome, in any language). When we&apos;re done, your Verified Positioning CV builds itself and appears here.</p>
        </div>
      </Shell>
    )
  }

  // ── Completed but result still extracting ──
  if (dd?.status === 'completed') {
    return (
      <Shell>
        <div className="rounded-2xl p-6 text-center" style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h1 className="text-2xl font-black text-[#F4F4F7] mb-2">Building your CV from your answers…</h1>
          <p className="text-[#A6A6B4] text-sm">This takes a few seconds. Refresh in a moment.</p>
        </div>
      </Shell>
    )
  }

  // ── Not started — the pitch + start ──
  return (
    <Shell>
      <div className="text-center mb-8">
        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#7E7E8E]">A new kind of CV</span>
        <h1 className="text-3xl font-black text-[#F4F4F7] mt-3 mb-3">The CV is dead. Here&apos;s what replaces it.</h1>
        <p className="text-[#A6A6B4] text-sm leading-relaxed max-w-md mx-auto">
          A short WhatsApp chat — five minutes, voice notes welcome, any language — and we surface the proof that
          makes you undeniable. Including the things that never make it onto a CV: the thing you built, the people
          you lifted, the job no one else could do.
        </p>
      </div>
      <div className="rounded-2xl p-6 mb-6" style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[#C7C7D1] text-sm font-bold mb-3">What we&apos;ll find together</p>
        <ul className="space-y-2 text-sm text-[#A6A6B4]">
          <li>🏆 Your strongest proof on each of four ways you create value — with a real number on each.</li>
          <li>💎 The off-CV achievement you&apos;re proudest of (these are usually the best).</li>
          <li>✓ Who can vouch for each — so we can verify it, not just take your word.</li>
        </ul>
      </div>
      <div className="flex flex-col items-center gap-3">
        <StartDeepDiveButton />
        <GenerateFromCvButton />
      </div>
    </Shell>
  )
}
