import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

export const metadata = { title: 'HR Portal · Shapi' }

// ────────────────────────────────────────────────────────────────────────────
// /company/people/[personId] — the per-employee HR portal (Enterprise HR-OS).
//
// Server component. Auth pattern copied exactly from spine/page.tsx. Read-only:
// no mutation endpoints in this lane. Uses the normal server createClient so
// RLS applies — employee_hr_profiles, employee_attendance_ledger and
// hr_lifecycle_programs are HRBP/manager/owner-gated at the row level. The
// medical-consent privacy gate is honoured TWICE: at the DB (RLS strips
// medical rows from non-HRBP managers) and at the UI (we never render medical
// detail beyond the entry type — see Tile 3).
//
// SIX TILES (FEATURE_STATUS task #94): Lifecycle · Comp · Time off ·
// Performance · Training · WhatsApp logging. Tables are empty pre-seed, so
// every tile carries a polished, informative empty state.
// ────────────────────────────────────────────────────────────────────────────

const ACCENT = '#9D8CFF'
const PURPLE = '#9D8CFF'
const BG = '#060609'
const CARD = '#0D0C14'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }
const HAIRLINE = '1px solid rgba(255,255,255,0.06)'

// ── Types (only the columns we read) ────────────────────────────────────────
type Person = {
  id: string
  full_name: string
  preferred_name: string | null
  email: string | null
  whatsapp_number: string | null
  status: string
}

type Seat = {
  id: string
  title: string
  team_id: string
  okr_completion_pct: number | null
  absorbed_capacity_pct: number | null
  ai_exposure_score: number | null
}

type HrProfile = {
  base_salary_sar: number | null
  base_salary_currency: string | null
  accrued_performance_bonus_sar: number | null
  last_comp_review_at: string | null
  annual_leave_balance_days: number | null
  sick_leave_taken_ytd_days: number | null
  parental_leave_balance_days: number | null
  current_seat_id: string | null
}

type AttendanceEntry = {
  id: string
  entry_type: string
  start_date: string
  end_date: string
  days: number
  notes: string | null
  medical_consent_logged: boolean
  logged_via: string
  approved_at: string | null
  created_at: string
}

type LifecycleProgram = {
  id: string
  program_type: string
  status: string
  start_date: string
  target_end_date: string | null
  actual_end_date: string | null
  milestones_30d: unknown
  milestones_60d: unknown
  milestones_90d: unknown
}

// ── Small presentational helpers ────────────────────────────────────────────
function Tile({
  icon,
  title,
  badge,
  children,
}: {
  icon: string
  title: string
  badge?: { label: string; color: string; bg: string }
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl p-5" style={{ background: CARD, border: HAIRLINE }}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <h2 className="text-sm font-black" style={HEADING_STYLE}>
          {title}
        </h2>
        {badge && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)' }}
    >
      <p className="text-xs leading-relaxed" style={BODY_STYLE}>
        {children}
      </p>
    </div>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function fmtMoney(amount: number | null, currency: string | null): string {
  if (amount === null || amount === undefined) return '—'
  const cur = currency || 'SAR'
  return `${cur} ${amount.toLocaleString()}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

const ENTRY_TYPE_LABEL: Record<string, string> = {
  annual_leave: 'Annual leave',
  sick_leave: 'Sick leave',
  parental_leave: 'Parental leave',
  bereavement: 'Bereavement',
  personal: 'Personal',
  unpaid: 'Unpaid',
  public_holiday: 'Public holiday',
}

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  onboarding: 'Onboarding',
  pip: 'Performance plan (PIP)',
  separation: 'Separation',
  redeploy: 'Redeployment',
  reskill: 'Reskill',
  augment: 'Augmentation',
}

const PROGRAM_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open: { bg: 'rgba(157, 140, 255, 0.14)', color: ACCENT },
  in_progress: { bg: 'rgba(157, 140, 255, 0.14)', color: PURPLE },
  completed: { bg: 'rgba(52,211,153,0.12)', color: '#34D399' },
  abandoned: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' },
  escalated: { bg: 'rgba(251, 113, 133, 0.12)', color: '#FB7185' },
}

function milestoneCount(m: unknown): number {
  return Array.isArray(m) ? m.length : 0
}

export default async function PersonHrPortalPage({
  params,
}: {
  params: Promise<{ personId: string }>
}) {
  const { personId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, plan_tier, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (!profile || profile.type !== 'company') redirect('/dashboard')
  if (!profile.onboarding_complete) redirect('/company/onboarding')

  // Load the person scoped to this company. RLS also enforces company_id, but
  // we filter explicitly for clarity and a clean 404.
  const { data: personData } = await supabase
    .from('persons')
    .select('id, full_name, preferred_name, email, whatsapp_number, status')
    .eq('company_id', user.id)
    .eq('id', personId)
    .maybeSingle()

  if (!personData) notFound()
  const person = personData as Person

  // Load the rest in parallel. The HR profile + attendance + lifecycle are
  // RBAC-gated: if the viewer isn't owner / assigned HRBP / reporting manager,
  // RLS returns nothing and the tiles show their empty states.
  const [hrProfileResult, attendanceResult, lifecycleResult] = await Promise.all([
    supabase
      .from('employee_hr_profiles')
      .select(
        'base_salary_sar, base_salary_currency, accrued_performance_bonus_sar, last_comp_review_at, annual_leave_balance_days, sick_leave_taken_ytd_days, parental_leave_balance_days, current_seat_id'
      )
      .eq('company_id', user.id)
      .eq('person_id', personId)
      .maybeSingle(),
    supabase
      .from('employee_attendance_ledger')
      .select(
        'id, entry_type, start_date, end_date, days, notes, medical_consent_logged, logged_via, approved_at, created_at'
      )
      .eq('company_id', user.id)
      .eq('person_id', personId)
      .order('start_date', { ascending: false })
      .limit(20),
    supabase
      .from('hr_lifecycle_programs')
      .select(
        'id, program_type, status, start_date, target_end_date, actual_end_date, milestones_30d, milestones_60d, milestones_90d'
      )
      .eq('company_id', user.id)
      .eq('person_id', personId)
      .order('start_date', { ascending: false }),
  ])

  const hrProfile = (hrProfileResult.data || null) as HrProfile | null
  const attendance = (attendanceResult.data || []) as AttendanceEntry[]
  const lifecycle = (lifecycleResult.data || []) as LifecycleProgram[]

  // Resolve the current seat for the Performance tile (Calibration metrics).
  // Prefer the seat referenced by the HR profile; fall back to whichever seat
  // points at this person.
  let seat: Seat | null = null
  if (hrProfile?.current_seat_id) {
    const { data: seatData } = await supabase
      .from('roles_seats')
      .select('id, title, team_id, okr_completion_pct, absorbed_capacity_pct, ai_exposure_score')
      .eq('company_id', user.id)
      .eq('id', hrProfile.current_seat_id)
      .maybeSingle()
    seat = (seatData || null) as Seat | null
  }
  if (!seat) {
    const { data: seatData } = await supabase
      .from('roles_seats')
      .select('id, title, team_id, okr_completion_pct, absorbed_capacity_pct, ai_exposure_score')
      .eq('company_id', user.id)
      .eq('person_id', personId)
      .limit(1)
      .maybeSingle()
    seat = (seatData || null) as Seat | null
  }

  // WhatsApp-logged entries (Tile 6) are a subset of the attendance ledger.
  const whatsappEntries = attendance.filter((a) => a.logged_via === 'whatsapp')

  const displayName = person.preferred_name || person.full_name
  const planTier = (profile as { plan_tier?: string | null }).plan_tier || 'free'

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14" style={{ background: BG }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/company/people" className="text-xs font-bold mb-4 inline-block" style={{ color: ACCENT }}>
          ← People
        </Link>

        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            HR Portal · {planTier === 'enterprise' ? 'Enterprise' : 'Preview'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-1" style={HEADING_STYLE}>
            {displayName}
          </h1>
          <p className="text-sm leading-relaxed" style={BODY_STYLE}>
            {seat ? seat.title : 'No current seat on the spine'}
            {person.email ? ` · ${person.email}` : ''}
          </p>
        </header>

        {/* Privacy banner — the PDPL gate is part of the product story. */}
        <div
          className="mb-6 p-4 rounded-xl text-xs leading-relaxed"
          style={{ background: 'rgba(157, 140, 255, 0.08)', border: `1px solid ${ACCENT}33`, color: '#c9d2f5' }}
        >
          <strong style={{ color: 'rgba(255,255,255,0.9)' }}>RBAC + PDPL floor.</strong> This record is visible
          only to the company owner, the assigned HRBP, and the reporting manager — enforced at the
          database row level. Medical (sick-leave) entries logged with consent are extra-gated and
          shown here as consent-logged only, never with clinical detail.
        </div>

        <div className="space-y-4">
          {/* ── Tile 1 · Lifecycle ───────────────────────────────────────── */}
          <Tile icon="🛤️" title="Lifecycle">
            <div className="mb-3">
              <Link
                href={`/company/people/${personId}/lifecycle`}
                className="inline-block text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(157, 140, 255, 0.14)', color: ACCENT }}
              >
                Open Lifecycle Playbooks (PIP / Separation) →
              </Link>
            </div>
            {lifecycle.length === 0 ? (
              <EmptyState>
                No active lifecycle programs. When you start an onboarding, PIP, redeployment,
                reskill or separation for {displayName}, it appears here with 30 / 60 / 90-day
                milestone tracking and a country-specific legal template reference.
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {lifecycle.map((p) => {
                  const s = PROGRAM_STATUS_STYLE[p.status] || PROGRAM_STATUS_STYLE.open
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl p-3"
                      style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <p className="text-xs font-bold" style={HEADING_STYLE}>
                          {PROGRAM_TYPE_LABEL[p.program_type] || p.program_type}
                        </p>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {p.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px]" style={BODY_STYLE}>
                        Started {fmtDate(p.start_date)}
                        {p.target_end_date ? ` · target ${fmtDate(p.target_end_date)}` : ''}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {[
                          { label: '30d', n: milestoneCount(p.milestones_30d) },
                          { label: '60d', n: milestoneCount(p.milestones_60d) },
                          { label: '90d', n: milestoneCount(p.milestones_90d) },
                        ].map((m) => (
                          <span
                            key={m.label}
                            className="text-[10px] px-2 py-1 rounded-md"
                            style={{ background: 'rgba(157, 140, 255, 0.10)', color: ACCENT }}
                          >
                            {m.label}: {m.n} milestone{m.n === 1 ? '' : 's'}
                          </span>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Tile>

          {/* ── Tile 2 · Comp ────────────────────────────────────────────── */}
          <Tile
            icon="💰"
            title="Compensation"
            badge={{ label: 'Sensitive', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' }}
          >
            {!hrProfile ? (
              <EmptyState>
                No HR profile on file for {displayName} yet. Once their compensation record is
                created, base salary, accrued performance bonus and the last comp-review date show
                here — visible to owner and assigned HRBP only.
              </EmptyState>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={BODY_STYLE}>
                    Base salary
                  </p>
                  <p className="text-sm font-black" style={HEADING_STYLE}>
                    {fmtMoney(hrProfile.base_salary_sar, hrProfile.base_salary_currency)}
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={BODY_STYLE}>
                    Accrued bonus
                  </p>
                  <p className="text-sm font-black" style={HEADING_STYLE}>
                    {fmtMoney(hrProfile.accrued_performance_bonus_sar, hrProfile.base_salary_currency)}
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={BODY_STYLE}>
                    Last comp review
                  </p>
                  <p className="text-sm font-black" style={HEADING_STYLE}>
                    {fmtDate(hrProfile.last_comp_review_at)}
                  </p>
                </div>
              </div>
            )}
          </Tile>

          {/* ── Tile 3 · Time off ────────────────────────────────────────── */}
          <Tile icon="🌴" title="Time off">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Annual', value: hrProfile?.annual_leave_balance_days, suffix: 'days left' },
                { label: 'Sick (YTD)', value: hrProfile?.sick_leave_taken_ytd_days, suffix: 'days taken' },
                { label: 'Parental', value: hrProfile?.parental_leave_balance_days, suffix: 'days left' },
              ].map((b) => (
                <div
                  key={b.label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}
                >
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={BODY_STYLE}>
                    {b.label}
                  </p>
                  <p className="text-lg font-black" style={HEADING_STYLE}>
                    {b.value ?? '—'}
                  </p>
                  <p className="text-[10px]" style={BODY_STYLE}>
                    {b.suffix}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: ACCENT }}>
              Recent entries
            </p>
            {attendance.length === 0 ? (
              <EmptyState>
                No leave logged yet. Entries appear here as staff log time off — including via
                WhatsApp (&quot;I&apos;m sick today&quot;), which stamps the entry and notifies the
                manager.
              </EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {attendance.map((a) => {
                  const isMedical = a.medical_consent_logged
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                      style={{
                        background: isMedical ? 'rgba(251, 113, 133, 0.06)' : 'rgba(255,255,255,0.02)',
                        border: isMedical ? '1px solid rgba(251, 113, 133, 0.25)' : HAIRLINE,
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold" style={HEADING_STYLE}>
                          {ENTRY_TYPE_LABEL[a.entry_type] || a.entry_type}
                          <span className="font-normal" style={BODY_STYLE}>
                            {' '}· {a.days} day{a.days === 1 ? '' : 's'}
                          </span>
                        </p>
                        <p className="text-[10px]" style={BODY_STYLE}>
                          {fmtDate(a.start_date)} → {fmtDate(a.end_date)}
                          {a.logged_via === 'whatsapp' ? ' · via WhatsApp' : ''}
                        </p>
                        {/* PDPL gate: for consent-logged medical rows we deliberately
                            do NOT render notes/clinical detail — only the masked label. */}
                        {isMedical ? (
                          <p className="text-[10px] mt-0.5 font-bold" style={{ color: '#FB7185' }}>
                            🔒 Medical — consent-logged, HRBP-visible only
                          </p>
                        ) : (
                          a.notes && (
                            <p className="text-[10px] mt-0.5 truncate" style={BODY_STYLE}>
                              {a.notes}
                            </p>
                          )
                        )}
                      </div>
                      <span
                        className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={
                          a.approved_at
                            ? { background: 'rgba(52,211,153,0.12)', color: '#34D399' }
                            : { background: 'rgba(251,191,36,0.12)', color: '#FBBF24' }
                        }
                      >
                        {a.approved_at ? 'Approved' : 'Pending'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Tile>

          {/* ── Tile 4 · Performance (Calibration metrics from roles_seats) ── */}
          <Tile icon="📈" title="Performance">
            {!seat ? (
              <EmptyState>
                No seat metrics yet. Once {displayName} occupies a seat on the spine, the
                Calibration Lens surfaces OKR completion, absorbed capacity and the seat&apos;s
                AI-exposure score here.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {[
                  {
                    label: 'OKR completion',
                    value: seat.okr_completion_pct,
                    max: 100,
                    color: '#34D399',
                    suffix: '%',
                  },
                  {
                    label: 'Absorbed capacity',
                    value: seat.absorbed_capacity_pct,
                    max: 250,
                    color: PURPLE,
                    suffix: '%',
                  },
                  {
                    label: 'AI-exposure score',
                    value: seat.ai_exposure_score,
                    max: 100,
                    color: '#FBBF24',
                    suffix: '/100',
                  },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold" style={HEADING_STYLE}>
                        {m.label}
                      </p>
                      <p className="text-xs font-black" style={{ color: m.color }}>
                        {m.value === null || m.value === undefined ? '—' : `${m.value}${m.suffix}`}
                      </p>
                    </div>
                    {m.value === null || m.value === undefined ? (
                      <p className="text-[10px]" style={BODY_STYLE}>
                        Not yet calibrated for this seat.
                      </p>
                    ) : (
                      <ProgressBar value={m.value} max={m.max} color={m.color} />
                    )}
                  </div>
                ))}
                <p className="text-[10px] leading-relaxed" style={BODY_STYLE}>
                  Absorbed capacity can exceed 100% to flag overload. These are per-seat signals
                  from the Calibration Lens — they travel with the seat, not the person.
                </p>
              </div>
            )}
          </Tile>

          {/* ── Tile 5 · Training (placeholder) ──────────────────────────── */}
          <Tile
            icon="🎓"
            title="Training"
            badge={{ label: 'Coming next', color: PURPLE, bg: 'rgba(157, 140, 255, 0.12)' }}
          >
            <EmptyState>
              No training records yet. Courses, certifications and skill paths will populate from
              delegated-deliverable skill extraction — the Company Brain reads what {displayName}
              actually ships (WhatsApp, desktop chat, uploads) and infers verified skills, instead
              of asking them to self-report a CV.
            </EmptyState>
          </Tile>

          {/* ── Tile 6 · WhatsApp logging ────────────────────────────────── */}
          <Tile icon="💬" title="WhatsApp logging">
            <p className="text-xs leading-relaxed mb-3" style={BODY_STYLE}>
              Staff log leave, sick days and bonuses straight from WhatsApp — &quot;I&apos;m sick
              today&quot; or &quot;approve Layla&apos;s Q2 bonus&quot;. Shapi stamps the entry,
              applies the PDPL consent gate for medical notes, and notifies the manager. Entries
              logged this way are flagged below.
            </p>
            {whatsappEntries.length === 0 ? (
              <EmptyState>
                No WhatsApp-logged entries yet for {displayName}. Once the WhatsApp handler is
                connected, anything they log by message lands here with a full audit trail.
              </EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {whatsappEntries.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold" style={HEADING_STYLE}>
                        {ENTRY_TYPE_LABEL[a.entry_type] || a.entry_type}
                      </p>
                      <p className="text-[10px]" style={BODY_STYLE}>
                        Logged {fmtDate(a.created_at)} via WhatsApp
                      </p>
                    </div>
                    {a.medical_consent_logged && (
                      <span
                        className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(251, 113, 133, 0.12)', color: '#FB7185' }}
                      >
                        🔒 Consent-logged
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Tile>
        </div>
      </div>
    </main>
  )
}
