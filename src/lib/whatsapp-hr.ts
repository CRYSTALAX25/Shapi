// ============================================================================
// whatsapp-hr.ts — WhatsApp HR intents: leave logging + manager bonus approval
// ============================================================================
//
// This is the intent-PARSING + DB-WRITE core for the two HR intents the
// WhatsApp webhook gained in this wave. It is deliberately decoupled from the
// Twilio send path so it's unit-testable without live credentials:
//
//   • parseLeaveIntent(text)    — pure: classify "sick today", "annual leave
//                                  12-15 June", "parental leave from 1 July"
//   • parseBonusApprovalIntent  — pure: classify "approve bonus for Sara 5000"
//   • parseYes(text)            — pure: did the manager confirm?
//   • resolvePersonByPhone(...) — DB read: phone → person row (+ company scope)
//   • applyLeaveLog(...)        — DB write: insert employee_attendance_ledger,
//                                  decrement balance, return remaining balance
//   • createPendingBonus / confirmPendingBonus — the 2-step bonus flow
//
// All DB helpers take a Supabase client (the webhook passes the service-role
// admin client — it runs unauthenticated as a webhook, so RLS is bypassed; we
// scope every write to the resolved person's company_id ourselves).
//
// PDPL note: sick_leave rows are stamped medical_consent_logged=true here.
// Per blueprint_v4_05, that flag makes the row HRBP/owner-only (a reporting
// manager who is NOT the assigned HRBP cannot read it). Logging your own sick
// day over WhatsApp IS the consent act, so we set it true for sick leave only.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Phone normalisation ──────────────────────────────────────────────────────
// The webhook already strips "whatsapp:" and spaces, but persons.whatsapp_number
// is free-text (CSV import / manual entry) and may contain spaces, dashes,
// parens, or a leading "00" instead of "+". Normalise both sides to a bare
// digit string with a single optional leading + so matching is robust.
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return ''
  let s = String(raw).replace(/^whatsapp:/i, '').trim()
  // Keep digits and a leading +; drop everything else (spaces, dashes, parens).
  const hasPlus = s.trim().startsWith('+') || s.trim().startsWith('00')
  s = s.replace(/[^\d]/g, '')
  // "00966..." international prefix → treat as "+966..."
  if (s.startsWith('00')) s = s.slice(2)
  return hasPlus ? `+${s}` : s
}

// Two numbers match if their digit tails match (handles "+966…" vs "966…" vs
// "00966…"). We compare the last 9 digits to tolerate inconsistent country-code
// entry — 9 is enough to be specific without false-positives in a single tenant.
export function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhone(a).replace(/^\+/, '')
  const db = normalizePhone(b).replace(/^\+/, '')
  if (!da || !db) return false
  if (da === db) return true
  const tailA = da.slice(-9)
  const tailB = db.slice(-9)
  return tailA.length >= 7 && tailA === tailB
}

// ── Leave intent parsing ─────────────────────────────────────────────────────
export type LeaveEntryType = 'annual_leave' | 'sick_leave' | 'parental_leave'

export interface ParsedLeave {
  entry_type: LeaveEntryType
  start_date: string   // YYYY-MM-DD
  end_date: string     // YYYY-MM-DD
  days: number
  raw_dates_text?: string
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

function pad(n: number): string { return String(n).padStart(2, '0') }
function toISO(y: number, m: number, d: number): string { return `${y}-${pad(m)}-${pad(d)}` }

// Inclusive day count between two ISO dates.
export function daysBetween(startISO: string, endISO: string): number {
  const s = new Date(startISO + 'T00:00:00Z').getTime()
  const e = new Date(endISO + 'T00:00:00Z').getTime()
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1
  return Math.round((e - s) / 86_400_000) + 1
}

// Resolve a (day, monthName?) pair into an ISO date, defaulting the year to the
// next occurrence (today or future) so "12 June" logged in May → this year,
// logged in July → next year. Keeps leave logging forward-looking.
function resolveDate(day: number, month: number | null, ref: Date): string {
  const refY = ref.getUTCFullYear()
  const refM = ref.getUTCMonth() + 1
  const refD = ref.getUTCDate()
  const m = month ?? refM
  let y = refY
  // If the month/day is clearly in the past this year, roll to next year — but
  // only when a month was explicitly given (bare day numbers stay in-month).
  if (month != null && (m < refM || (m === refM && day < refD))) y = refY + 1
  return toISO(y, m, day)
}

// Classify a leave message. Returns null if it isn't a leave intent.
// Supported shapes (case-insensitive):
//   "sick" / "sick today" / "off sick" / "i'm sick"            → sick, today
//   "sick 12 june" / "sick leave 12-15 june"                   → sick, range
//   "annual leave 12-15 June" / "annual leave from 12 to 15 June"
//   "annual leave 3 days from 1 July"
//   "parental leave from 1 July" / "parental leave 1-30 July"
//   "on leave tomorrow"                                        → annual, tomorrow
export function parseLeaveIntent(text: string, now: Date = new Date()): ParsedLeave | null {
  const t = (text || '').toLowerCase().trim()
  if (!t) return null

  let entry_type: LeaveEntryType | null = null
  if (/\b(parental|paternity|maternity)\b/.test(t)) entry_type = 'parental_leave'
  else if (/\bsick\b|\bunwell\b|\bill\b(?!\s*\b)/.test(t) || /\boff sick\b/.test(t)) entry_type = 'sick_leave'
  else if (/\bannual leave\b|\bvacation\b|\bholiday\b|\bon leave\b|\btime off\b|\bpto\b/.test(t)) entry_type = 'annual_leave'
  // Bare "leave" with a date also counts as annual.
  else if (/\bleave\b/.test(t)) entry_type = 'annual_leave'
  if (!entry_type) return null

  const refToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // "today" / "tomorrow" — single-day, no explicit dates.
  if (/\btoday\b/.test(t) && !/\d/.test(t.replace(/\b(19|20)\d\d\b/g, ''))) {
    const iso = toISO(refToday.getUTCFullYear(), refToday.getUTCMonth() + 1, refToday.getUTCDate())
    return { entry_type, start_date: iso, end_date: iso, days: 1, raw_dates_text: 'today' }
  }
  if (/\btomorrow\b/.test(t)) {
    const tm = new Date(refToday.getTime() + 86_400_000)
    const iso = toISO(tm.getUTCFullYear(), tm.getUTCMonth() + 1, tm.getUTCDate())
    return { entry_type, start_date: iso, end_date: iso, days: 1, raw_dates_text: 'tomorrow' }
  }

  // Range with a shared month: "12-15 June" / "12 to 15 June" / "June 12-15"
  const monthName = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'

  // day1 (sep) day2 (sep) monthName    e.g. "12-15 june", "12 to 15 of june"
  let m = t.match(new RegExp(`\\b(\\d{1,2})\\s*(?:-|–|to|until|till|through)\\s*(\\d{1,2})\\b(?:\\s+(?:of\\s+)?${monthName})?`))
  if (m) {
    const d1 = parseInt(m[1], 10), d2 = parseInt(m[2], 10)
    const mon = m[3] ? MONTHS[m[3]] : null
    const start = resolveDate(d1, mon, refToday)
    const end = resolveDate(d2, mon, refToday)
    return { entry_type, start_date: start, end_date: end, days: daysBetween(start, end), raw_dates_text: m[0] }
  }

  // monthName day1 - day2          e.g. "june 12-15"
  m = t.match(new RegExp(`\\b${monthName}\\s+(\\d{1,2})\\s*(?:-|–|to|until|till|through)\\s*(\\d{1,2})\\b`))
  if (m) {
    const mon = MONTHS[m[1]]
    const d1 = parseInt(m[2], 10), d2 = parseInt(m[3], 10)
    const start = resolveDate(d1, mon, refToday)
    const end = resolveDate(d2, mon, refToday)
    return { entry_type, start_date: start, end_date: end, days: daysBetween(start, end), raw_dates_text: m[0] }
  }

  // "from <day> <month>" with an optional "N days" span anchored to it.
  // "from 1 July" → 1 day starting that date. "3 days from 1 July" → 3-day span
  // starting that date. "from July 1" / "on 12 June" also supported.
  m = t.match(new RegExp(`\\b(?:from|on|starting)\\s+(?:(\\d{1,2})\\s+(?:of\\s+)?${monthName}|${monthName}\\s+(\\d{1,2}))`))
  if (m) {
    const day = m[1] ? parseInt(m[1], 10) : parseInt(m[4], 10)
    const mon = m[2] ? MONTHS[m[2]] : (m[3] ? MONTHS[m[3]] : null)
    const start = resolveDate(day, mon, refToday)
    // Honour an explicit "N days" span if present (e.g. "3 days from 1 July").
    const spanMatch = t.match(/\b(\d{1,2})\s*days?\b/)
    const span = spanMatch ? Math.max(1, parseInt(spanMatch[1], 10)) : 1
    const startMs = new Date(start + 'T00:00:00Z').getTime()
    const endISO = toISO(
      new Date(startMs + (span - 1) * 86_400_000).getUTCFullYear(),
      new Date(startMs + (span - 1) * 86_400_000).getUTCMonth() + 1,
      new Date(startMs + (span - 1) * 86_400_000).getUTCDate(),
    )
    return { entry_type, start_date: start, end_date: endISO, days: span, raw_dates_text: m[0] }
  }

  // "<day> <month>" single date (no range, no from): "12 june" / "june 12"
  m = t.match(new RegExp(`\\b(\\d{1,2})\\s+(?:of\\s+)?${monthName}\\b`))
    || t.match(new RegExp(`\\b${monthName}\\s+(\\d{1,2})\\b`))
  if (m) {
    // Figure out which capture group held the day vs month across the two shapes.
    const a = m[1], b = m[2]
    let day: number, mon: number
    if (/^\d+$/.test(a)) { day = parseInt(a, 10); mon = MONTHS[b] }
    else { mon = MONTHS[a]; day = parseInt(b, 10) }
    const iso = resolveDate(day, mon, refToday)
    return { entry_type, start_date: iso, end_date: iso, days: 1, raw_dates_text: m[0] }
  }

  // "X days" with no anchor date → starts today, spans X days.
  m = t.match(/\b(\d{1,2})\s*days?\b/)
  if (m) {
    const n = Math.max(1, parseInt(m[1], 10))
    const start = toISO(refToday.getUTCFullYear(), refToday.getUTCMonth() + 1, refToday.getUTCDate())
    const endMs = refToday.getTime() + (n - 1) * 86_400_000
    const end = new Date(endMs)
    const endISO = toISO(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate())
    return { entry_type, start_date: start, end_date: endISO, days: n, raw_dates_text: m[0] }
  }

  // Sick/parental with no date at all → default to today (single day).
  if (entry_type === 'sick_leave' || entry_type === 'parental_leave') {
    const iso = toISO(refToday.getUTCFullYear(), refToday.getUTCMonth() + 1, refToday.getUTCDate())
    return { entry_type, start_date: iso, end_date: iso, days: 1, raw_dates_text: 'today (assumed)' }
  }

  // Annual leave with no parseable date — don't guess; let the caller ask.
  return { entry_type, start_date: '', end_date: '', days: 0, raw_dates_text: undefined }
}

// ── Bonus approval intent parsing ────────────────────────────────────────────
export interface ParsedBonusApproval {
  person_query: string   // the name fragment the manager typed
  amount: number
  currency: string
}

// "approve bonus for Sara 5000", "approve a bonus for Sara Khan of AED 5,000",
// "bonus for Sara 5000 aed", "approve 5000 bonus for Sara"
export function parseBonusApprovalIntent(text: string): ParsedBonusApproval | null {
  const t = (text || '').trim()
  if (!/\bbonus\b/i.test(t)) return null
  if (!/\bapprove|grant|award|give\b/i.test(t)) {
    // Require an action verb so plain "bonus for Sara?" (a question) doesn't fire.
    if (!/^bonus\b/i.test(t)) return null
  }

  // Currency: AED / SAR / USD / £ / $ etc. Default SAR (KSA-first per CLAUDE.md).
  let currency = 'SAR'
  const curMatch = t.match(/\b(AED|SAR|USD|EUR|GBP|QAR|KWD|BHD|OMR)\b/i)
  if (curMatch) currency = curMatch[1].toUpperCase()
  else if (/[£]/.test(t)) currency = 'GBP'
  else if (/[€]/.test(t)) currency = 'EUR'
  else if (/[$]/.test(t)) currency = 'USD'

  // Amount: first number with optional thousands separators / decimals.
  const amtMatch = t.match(/(\d[\d,]*(?:\.\d+)?)/)
  if (!amtMatch) return null
  const amount = parseFloat(amtMatch[1].replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null

  // Person: text between "for" and the amount/currency, else strip known tokens.
  let person_query = ''
  const forMatch = t.match(/\bfor\s+(.+)$/i)
  if (forMatch) person_query = forMatch[1]
  else person_query = t

  person_query = person_query
    .replace(/\b(approve|approved|grant|award|give|a|the|of|bonus|performance)\b/gi, ' ')
    .replace(/\b(AED|SAR|USD|EUR|GBP|QAR|KWD|BHD|OMR)\b/gi, ' ')
    .replace(/[£€$]/g, ' ')
    .replace(/\d[\d,]*(?:\.\d+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!person_query || person_query.length < 2) return null
  return { person_query, amount, currency }
}

// Did the manager confirm the pending bonus?
export function parseYes(text: string): boolean {
  return /^(yes|y|yep|yeah|confirm|confirmed|approve|approved|ok|okay|do it|go|go ahead|👍)\b/i.test((text || '').trim())
}
export function parseNo(text: string): boolean {
  return /^(no|n|nope|cancel|stop|abort|don'?t|nevermind|never mind)\b/i.test((text || '').trim())
}

// ── Person resolution ────────────────────────────────────────────────────────
export interface ResolvedPerson {
  id: string
  company_id: string
  full_name: string
  preferred_name: string | null
  linked_user_id: string | null
  whatsapp_number: string | null
  status: string
}

// Resolve the WhatsApp sender to a person record by matching whatsapp_number.
// Returns ALL matches (a phone could appear in more than one tenant); caller
// decides. We pull a bounded set and match in-app because persons.whatsapp_number
// is free-text and we need tolerant matching (see phonesMatch).
export async function resolvePersonsByPhone(
  admin: SupabaseClient,
  phone: string,
): Promise<ResolvedPerson[]> {
  const norm = normalizePhone(phone)
  const tail = norm.replace(/^\+/, '').slice(-9)
  if (!tail) return []
  // Narrow with an ILIKE on the digit tail to avoid scanning every person,
  // then verify precisely in-app. ilike '%123456789%' tolerates +/spaces.
  const { data } = await admin
    .from('persons')
    .select('id, company_id, full_name, preferred_name, linked_user_id, whatsapp_number, status')
    .ilike('whatsapp_number', `%${tail}%`)
    .limit(50)
  return (data || []).filter(p => phonesMatch(p.whatsapp_number || '', phone)) as ResolvedPerson[]
}

// Find a person in a company by a loose name query (first name, full name, or
// preferred name). Used for bonus approval ("for Sara"). Returns the best match
// or null; if ambiguous (>1 equally-good), returns { ambiguous: true }.
export async function findPersonByName(
  admin: SupabaseClient,
  companyId: string,
  query: string,
): Promise<{ person?: ResolvedPerson; ambiguous?: ResolvedPerson[] }> {
  const q = query.toLowerCase().trim()
  const { data } = await admin
    .from('persons')
    .select('id, company_id, full_name, preferred_name, linked_user_id, whatsapp_number, status')
    .eq('company_id', companyId)
    .neq('status', 'archived')
    .limit(500)
  const people = (data || []) as ResolvedPerson[]
  const exact = people.filter(p =>
    (p.full_name || '').toLowerCase() === q ||
    (p.preferred_name || '').toLowerCase() === q,
  )
  if (exact.length === 1) return { person: exact[0] }
  if (exact.length > 1) return { ambiguous: exact }
  // First-name / contains match.
  const partial = people.filter(p => {
    const full = (p.full_name || '').toLowerCase()
    const pref = (p.preferred_name || '').toLowerCase()
    const first = full.split(/\s+/)[0]
    return first === q || full.includes(q) || pref.includes(q) || (pref && pref.split(/\s+/)[0] === q)
  })
  if (partial.length === 1) return { person: partial[0] }
  if (partial.length > 1) return { ambiguous: partial }
  return {}
}

// ── Authority check for bonus approval ───────────────────────────────────────
// A manager can approve a bonus for a target person if they are EITHER:
//   • the company owner (their phone matches the company profile's whatsapp), OR
//   • the assigned_hrbp_user_id / reporting_manager_user_id on the TARGET's
//     employee_hr_profiles row (resolved via the approver's persons.linked_user_id).
// Returns the approver's auth user id when known (for approved_by stamping).
export async function checkBonusAuthority(
  admin: SupabaseClient,
  opts: {
    companyId: string
    approverPhone: string
    approverPersons: ResolvedPerson[]   // approver resolved in this company
    targetPersonId: string
  },
): Promise<{ authorized: boolean; approverUserId: string | null; reason?: string }> {
  const { companyId, approverPhone, approverPersons, targetPersonId } = opts

  // (1) Company owner — the company profile's whatsapp_number matches sender.
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('id, whatsapp_number')
    .eq('id', companyId)
    .maybeSingle()
  if (ownerProfile && phonesMatch((ownerProfile.whatsapp_number as string) || '', approverPhone)) {
    return { authorized: true, approverUserId: companyId, reason: 'company_owner' }
  }

  // (2) Manager / HRBP anchor on the target's HR profile. The approver must be a
  // person in this company with a linked_user_id that matches one of the anchors.
  const approverUserIds = approverPersons
    .filter(p => p.company_id === companyId && p.linked_user_id)
    .map(p => p.linked_user_id as string)
  if (approverUserIds.length > 0) {
    const { data: hp } = await admin
      .from('employee_hr_profiles')
      .select('assigned_hrbp_user_id, reporting_manager_user_id')
      .eq('company_id', companyId)
      .eq('person_id', targetPersonId)
      .maybeSingle()
    if (hp) {
      const anchors = [hp.assigned_hrbp_user_id, hp.reporting_manager_user_id].filter(Boolean) as string[]
      const hit = approverUserIds.find(uid => anchors.includes(uid))
      if (hit) return { authorized: true, approverUserId: hit, reason: 'manager_or_hrbp' }
    }
  }

  return { authorized: false, approverUserId: approverUserIds[0] || null, reason: 'not_authorized' }
}

// ── Leave: apply the log + decrement balance ─────────────────────────────────
export interface LeaveResult {
  ok: boolean
  entry_type: LeaveEntryType
  days: number
  start_date: string
  end_date: string
  // Remaining balance AFTER this entry, for the relevant bucket.
  remaining_annual?: number | null
  sick_ytd?: number | null
  remaining_parental?: number | null
  error?: string
}

// Insert the attendance ledger row (scoped to the person's company) and update
// the matching balance bucket on employee_hr_profiles. Sick leave stamps
// medical_consent_logged=true (the PDPL gate). Returns the new remaining balance.
export async function applyLeaveLog(
  admin: SupabaseClient,
  opts: { person: ResolvedPerson; leave: ParsedLeave },
): Promise<LeaveResult> {
  const { person, leave } = opts
  const { entry_type, start_date, end_date, days } = leave

  const insertRow = {
    company_id: person.company_id,
    person_id: person.id,
    entry_type,
    start_date,
    end_date,
    days,
    medical_consent_logged: entry_type === 'sick_leave',   // PDPL gate for medical data
    logged_via: 'whatsapp' as const,
  }

  const { error: insErr } = await admin.from('employee_attendance_ledger').insert(insertRow)
  if (insErr) return { ok: false, entry_type, days, start_date, end_date, error: insErr.message }

  // Update the relevant balance bucket on employee_hr_profiles. Read-modify-write
  // (the column types are plain numerics, no atomic decrement RPC). Scope by
  // (company_id, person_id) — the table's unique key.
  const { data: hp } = await admin
    .from('employee_hr_profiles')
    .select('id, annual_leave_balance_days, sick_leave_taken_ytd_days, parental_leave_balance_days')
    .eq('company_id', person.company_id)
    .eq('person_id', person.id)
    .maybeSingle()

  const result: LeaveResult = { ok: true, entry_type, days, start_date, end_date }

  if (!hp) {
    // No HR profile yet — the ledger row still landed (that's the source of
    // truth). Balances are simply unknown; surface that to the caller.
    result.remaining_annual = null
    result.sick_ytd = null
    result.remaining_parental = null
    return result
  }

  if (entry_type === 'annual_leave') {
    const cur = Number(hp.annual_leave_balance_days ?? 0)
    const next = Math.max(0, cur - days)
    await admin.from('employee_hr_profiles').update({ annual_leave_balance_days: next }).eq('id', hp.id)
    result.remaining_annual = next
  } else if (entry_type === 'sick_leave') {
    const cur = Number(hp.sick_leave_taken_ytd_days ?? 0)
    const next = cur + days   // sick is TAKEN-ytd, accumulates upward
    await admin.from('employee_hr_profiles').update({ sick_leave_taken_ytd_days: next }).eq('id', hp.id)
    result.sick_ytd = next
  } else if (entry_type === 'parental_leave') {
    const cur = Number(hp.parental_leave_balance_days ?? 0)
    const next = Math.max(0, cur - days)
    await admin.from('employee_hr_profiles').update({ parental_leave_balance_days: next }).eq('id', hp.id)
    result.remaining_parental = next
  }

  return result
}

// ── Bonus: 2-step create + confirm ───────────────────────────────────────────
export async function createPendingBonus(
  admin: SupabaseClient,
  opts: {
    approverPhone: string
    approverUserId: string | null
    companyId: string
    person: ResolvedPerson
    amount: number
    currency: string
  },
): Promise<{ ok: boolean; error?: string }> {
  // Supersede any earlier un-consumed pending row for this approver so a stale
  // one can't be confirmed by accident.
  await admin
    .from('whatsapp_hr_pending')
    .update({ consumed_at: new Date().toISOString() })
    .eq('approver_phone', normalizePhone(opts.approverPhone))
    .is('consumed_at', null)

  const { error } = await admin.from('whatsapp_hr_pending').insert({
    action: 'bonus_approval',
    approver_phone: normalizePhone(opts.approverPhone),
    approver_user_id: opts.approverUserId,
    company_id: opts.companyId,
    person_id: opts.person.id,
    person_name: opts.person.full_name,
    amount: opts.amount,
    currency: opts.currency,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

const PENDING_TTL_MS = 10 * 60 * 1000   // 10 minutes

export interface ConfirmBonusResult {
  ok: boolean
  applied?: boolean
  person_name?: string
  amount?: number
  currency?: string
  new_accrued?: number | null
  error?: string
  expired?: boolean
  none?: boolean
}

// Apply the most-recent un-consumed pending bonus for this approver. Marks the
// pending row consumed and bumps employee_hr_profiles.accrued_performance_bonus_sar.
export async function confirmPendingBonus(
  admin: SupabaseClient,
  approverPhone: string,
): Promise<ConfirmBonusResult> {
  const { data: rows } = await admin
    .from('whatsapp_hr_pending')
    .select('*')
    .eq('approver_phone', normalizePhone(approverPhone))
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  const pending = rows?.[0]
  if (!pending) return { ok: true, none: true }

  // Expiry guard.
  if (Date.now() - new Date(pending.created_at).getTime() > PENDING_TTL_MS) {
    await admin.from('whatsapp_hr_pending').update({ consumed_at: new Date().toISOString() }).eq('id', pending.id)
    return { ok: true, expired: true, person_name: pending.person_name, amount: pending.amount, currency: pending.currency }
  }

  // Consume first (idempotency: a duplicate "YES" won't double-apply).
  await admin.from('whatsapp_hr_pending').update({ consumed_at: new Date().toISOString() }).eq('id', pending.id)

  // Look up the HR profile and bump accrued bonus. Scope by (company_id, person_id).
  const { data: hp } = await admin
    .from('employee_hr_profiles')
    .select('id, accrued_performance_bonus_sar')
    .eq('company_id', pending.company_id)
    .eq('person_id', pending.person_id)
    .maybeSingle()

  if (!hp) {
    // Create a minimal HR profile so the bonus has somewhere to live.
    const { data: created, error: createErr } = await admin
      .from('employee_hr_profiles')
      .insert({
        company_id: pending.company_id,
        person_id: pending.person_id,
        accrued_performance_bonus_sar: pending.amount,
      })
      .select('accrued_performance_bonus_sar')
      .maybeSingle()
    if (createErr) return { ok: false, error: createErr.message }
    return {
      ok: true, applied: true, person_name: pending.person_name,
      amount: pending.amount, currency: pending.currency,
      new_accrued: Number(created?.accrued_performance_bonus_sar ?? pending.amount),
    }
  }

  const cur = Number(hp.accrued_performance_bonus_sar ?? 0)
  const next = cur + Number(pending.amount)
  const { error: updErr } = await admin
    .from('employee_hr_profiles')
    .update({ accrued_performance_bonus_sar: next })
    .eq('id', hp.id)
  if (updErr) return { ok: false, error: updErr.message }

  return {
    ok: true, applied: true, person_name: pending.person_name,
    amount: pending.amount, currency: pending.currency, new_accrued: next,
  }
}

// Is there a live (un-expired) pending bonus for this approver? Used by the
// webhook to decide whether a "YES" should be treated as a bonus confirmation.
export async function hasLivePendingBonus(
  admin: SupabaseClient,
  approverPhone: string,
): Promise<boolean> {
  const { data: rows } = await admin
    .from('whatsapp_hr_pending')
    .select('created_at')
    .eq('approver_phone', normalizePhone(approverPhone))
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  const pending = rows?.[0]
  if (!pending) return false
  return Date.now() - new Date(pending.created_at).getTime() <= PENDING_TTL_MS
}

// ── Confirmation / reply copy ────────────────────────────────────────────────
export function leaveLabel(t: LeaveEntryType): string {
  return t === 'annual_leave' ? 'annual leave' : t === 'sick_leave' ? 'sick leave' : 'parental leave'
}

export function fmtAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US')}`
}
