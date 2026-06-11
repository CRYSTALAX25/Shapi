// ============================================================================
// scripts/seed-personas.mjs — RE-RUNNABLE live-DB seed for Ana's 6 test personas
// ============================================================================
//
// Writes to the LIVE Supabase project (juqgwcipbdzoegodiydh) using the SERVICE
// ROLE key. Run with:  node scripts/seed-personas.mjs
//
// Idempotent: re-running upserts (deterministic UUIDs / stable keys) and never
// duplicates. Auth users are resolved by email (paginated listUsers) and only
// created if missing — all auto-confirmed (email_confirm:true, no email sent).
//
// SPECIAL: the +company1 account is HARD-RESET on every run (pre-approved by the
// founder). Scope is guarded to the single resolved auth id — if the email
// resolves to 0 or >1 users the whole script ABORTS.
//
// See scripts/README.md for the persona map.
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ---------------------------------------------------------------------------
// 0. Tiny .env.local parser (never prints the key)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function loadEnv() {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[m[1]] = v
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'ShapiTest!2026'

// ---------------------------------------------------------------------------
// Deterministic UUIDs — stable across reruns so child rows upsert in place.
// Namespaced v4-shaped UUID derived from a label (not a real v5, but stable
// + valid uuid format, which is all Postgres needs).
// ---------------------------------------------------------------------------
function stableId(label) {
  const h = createHash('sha256').update('shapi-seed::' + label).digest('hex')
  // Format as a UUID. Force version nibble to 4 and variant to 8-b.
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(13, 16),
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-')
}

const EMAILS = {
  candA: 'ana.vbarber+test1@gmail.com',
  candB: 'ana.vbarber+test2@gmail.com',
  company1: 'ana.vbarber+company1@gmail.com',
  teamMember: 'ana.vbarber+test4@gmail.com',
  hrbp: 'ana.vbarber+test5@gmail.com',
  referee: 'ana.vbarber+test6@gmail.com',
}

// ---------------------------------------------------------------------------
// 1. Auth helpers
// ---------------------------------------------------------------------------
async function findAuthUsersByEmail(email) {
  const target = email.toLowerCase()
  const matches = []
  let page = 1
  const perPage = 1000
  // Paginate through all users.
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const users = data?.users || []
    for (const u of users) {
      if ((u.email || '').toLowerCase() === target) matches.push(u)
    }
    if (users.length < perPage) break
    page++
  }
  return matches
}

// Resolve existing OR create the auth user. Returns the user id.
// metaType: 'candidate' | 'company' — used by the handle_new_user trigger.
async function ensureAuthUser(email, metaType) {
  const existing = await findAuthUsersByEmail(email)
  if (existing.length === 1) {
    // Make sure password + confirmation are in the known state.
    await db.auth.admin.updateUserById(existing[0].id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { type: metaType },
    })
    return { id: existing[0].id, created: false }
  }
  if (existing.length > 1) {
    throw new Error(`ABORT: ${email} resolves to ${existing.length} auth users (expected 1).`)
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { type: metaType },
  })
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`)
  return { id: data.user.id, created: true }
}

// ---------------------------------------------------------------------------
// 2. Schema-aware column filtering. The `profiles` and `roles` tables have
// drifted from the committed SQL (columns added ad-hoc in Supabase). We probe
// the live shape once and only write columns that actually exist, so a stray
// column never 400s the whole upsert.
// ---------------------------------------------------------------------------
const columnCache = {}
async function getColumns(table) {
  if (columnCache[table]) return columnCache[table]
  const { data, error } = await db.from(table).select('*').limit(1)
  if (error) {
    // Table may be empty (still returns []) — empty array has no keys, so fall
    // back to "accept all" (null) which means "don't filter".
    if (/does not exist|schema cache/i.test(error.message)) {
      columnCache[table] = null
      return null
    }
  }
  if (data && data.length > 0) {
    columnCache[table] = new Set(Object.keys(data[0]))
  } else {
    columnCache[table] = null // empty table: can't introspect via select, accept all
  }
  return columnCache[table]
}

function filterToColumns(obj, cols) {
  if (!cols) return obj
  const out = {}
  for (const k of Object.keys(obj)) if (cols.has(k)) out[k] = obj[k]
  return out
}

async function upsert(table, row, onConflict) {
  const cols = await getColumns(table)
  const payload = filterToColumns(row, cols)
  const opts = onConflict ? { onConflict } : undefined
  const { error } = await db.from(table).upsert(payload, opts)
  if (error) throw new Error(`upsert ${table} failed: ${error.message}\n  row keys: ${Object.keys(payload).join(', ')}`)
}

// Delete any of a candidate's references whose id isn't in keepIds. Keeps the
// per-candidate reference set EXACTLY the seeded rows even if earlier partial
// runs left debris (these candidates aren't hard-reset like company1).
async function reconcileReferences(candidateId, keepIds) {
  const { data, error } = await db.from('candidate_references')
    .select('id').eq('candidate_id', candidateId)
  if (error) return
  const stale = (data || []).map((r) => r.id).filter((id) => !keepIds.includes(id))
  if (stale.length) {
    await db.from('candidate_references').delete().in('id', stale)
  }
}

// Tables that may or may not exist in the live DB. We probe before touching.
async function tableExists(table) {
  const { error } = await db.from(table).select('*', { head: true, count: 'exact' }).limit(1)
  if (error && /does not exist|schema cache|find the table/i.test(error.message)) return false
  if (error) {
    // Some other error (RLS, etc.) — treat as exists so we surface it.
    return true
  }
  return true
}

async function countRows(table, companyId, col = 'company_id') {
  const { count, error } = await db
    .from(table)
    .select('*', { head: true, count: 'exact' })
    .eq(col, companyId)
  if (error) return { count: null, error: error.message }
  return { count: count ?? 0, error: null }
}

// ===========================================================================
// MAIN
// ===========================================================================
async function main() {
  console.log('='.repeat(76))
  console.log('SHAPI PERSONA SEED — live DB:', SUPABASE_URL.replace(/^https?:\/\//, ''))
  console.log('='.repeat(76))

  const report = []

  // -------------------------------------------------------------------------
  // Resolve / create every auth user up front (company1 resolved but NOT yet
  // recreated — reset happens first).
  // -------------------------------------------------------------------------
  const candA = await ensureAuthUser(EMAILS.candA, 'candidate')
  const candB = await ensureAuthUser(EMAILS.candB, 'candidate')
  const teamMember = await ensureAuthUser(EMAILS.teamMember, 'candidate')
  const hrbp = await ensureAuthUser(EMAILS.hrbp, 'company')
  const referee = await ensureAuthUser(EMAILS.referee, 'candidate')

  // =========================================================================
  // +company1 HARD RESET (scope-guarded to a single resolved id)
  // =========================================================================
  console.log('\n' + '-'.repeat(76))
  console.log('+company1 HARD RESET —', EMAILS.company1)
  console.log('-'.repeat(76))

  const c1matches = await findAuthUsersByEmail(EMAILS.company1)
  if (c1matches.length > 1) {
    throw new Error(`ABORT: ${EMAILS.company1} resolves to ${c1matches.length} users. Refusing to reset.`)
  }
  const company1Id = c1matches.length === 1 ? c1matches[0].id : null

  // All company-scoped tables, in FK-safe DELETE order (children first).
  const RESET_TABLES = [
    'organizational_decisions',
    'brain_entries',
    'brain_sources',
    'workload_delegations',
    'activity_catalogue',
    'employee_attendance_ledger',
    'hr_lifecycle_programs',
    'employee_hr_profiles',
    'role_share_tokens',
    'roles_seats',
    'persons',
    'teams',
    'locations',
    'jobs',
    'roles',
    'company_members',
  ]

  const before = {}
  const after = {}

  if (!company1Id) {
    console.log('  No existing auth user for +company1 — nothing to reset, will create fresh.')
  } else {
    console.log('  Resolved single auth id:', company1Id)
    console.log('\n  BEFORE counts:')
    // profiles row
    {
      const { count } = await db.from('profiles').select('*', { head: true, count: 'exact' }).eq('id', company1Id)
      before['profiles'] = count ?? 0
      console.log(`    profiles                       ${before['profiles']}`)
    }
    for (const t of RESET_TABLES) {
      if (!(await tableExists(t))) { before[t] = 'n/a'; console.log(`    ${t.padEnd(30)} n/a (table absent)`); continue }
      const { count, error } = await countRows(t, company1Id)
      before[t] = error ? `err:${error}` : count
      console.log(`    ${t.padEnd(30)} ${before[t]}`)
    }

    // DELETE children -> parents. Guard: only ever filter by company1Id.
    console.log('\n  Deleting (children -> parents)...')
    for (const t of RESET_TABLES) {
      if (before[t] === 'n/a') continue
      const { error } = await db.from(t).delete().eq('company_id', company1Id)
      if (error) console.log(`    ${t}: delete error -> ${error.message}`)
    }
    // profiles row
    await db.from('profiles').delete().eq('id', company1Id)
    // auth user
    const { error: delErr } = await db.auth.admin.deleteUser(company1Id)
    if (delErr) console.log('    deleteUser error ->', delErr.message)
    else console.log('    auth user deleted ->', company1Id)

    console.log('\n  AFTER counts (expect 0 / n/a):')
    {
      const { count } = await db.from('profiles').select('*', { head: true, count: 'exact' }).eq('id', company1Id)
      after['profiles'] = count ?? 0
      console.log(`    profiles                       ${after['profiles']}`)
    }
    for (const t of RESET_TABLES) {
      if (before[t] === 'n/a') { after[t] = 'n/a'; continue }
      const { count, error } = await countRows(t, company1Id)
      after[t] = error ? `err:${error}` : count
      console.log(`    ${t.padEnd(30)} ${after[t]}`)
    }
  }

  // Recreate company1 auth user fresh.
  const company1 = await ensureAuthUser(EMAILS.company1, 'company')
  console.log('  Recreated +company1 auth id:', company1.id)
  const C1 = company1.id

  // =========================================================================
  // PERSONA 3 — Company owner "Meridian Gulf" (Enterprise) + real org
  // =========================================================================
  console.log('\n' + '-'.repeat(76))
  console.log('PERSONA 3 — Company owner (Meridian Gulf, Enterprise)')
  console.log('-'.repeat(76))

  await upsert('profiles', {
    id: C1,
    type: 'company',
    company_name: 'Meridian Gulf',
    company_size: '201-500',
    industry: 'Financial Services',
    location: 'Dubai, UAE',
    headline: 'Investment & advisory group — Gulf restructuring',
    onboarding_complete: true,
    onboarding_step: 5,
    plan_tier: 'enterprise',
    subscription_tier: 'enterprise',
    subscription_status: 'active',
    subscription_started_at: new Date().toISOString(),
    paid: true,
    profile_live: true,
    completion_pct: 100,
  }, 'id')

  // --- Locations (Dubai HQ primary + Riyadh) ---
  const locDubai = stableId('loc:dubai')
  const locRiyadh = stableId('loc:riyadh')
  await upsert('locations', {
    id: locDubai, company_id: C1, name: 'Dubai HQ', country: 'AE',
    city: 'Dubai', timezone: 'Asia/Dubai', is_primary: true,
  }, 'id')
  await upsert('locations', {
    id: locRiyadh, company_id: C1, name: 'Riyadh Office', country: 'SA',
    city: 'Riyadh', timezone: 'Asia/Riyadh', is_primary: false,
  }, 'id')

  // --- Teams (~4) ---
  const teamExec = stableId('team:exec')
  const teamEng = stableId('team:eng')
  const teamSales = stableId('team:sales')
  const teamOps = stableId('team:ops')
  await upsert('teams', { id: teamExec, company_id: C1, location_id: locDubai, parent_team_id: null, name: 'Executive', function: 'other' }, 'id')
  await upsert('teams', { id: teamEng, company_id: C1, location_id: locDubai, parent_team_id: teamExec, name: 'Engineering', function: 'engineering' }, 'id')
  await upsert('teams', { id: teamSales, company_id: C1, location_id: locRiyadh, parent_team_id: teamExec, name: 'Sales', function: 'sales' }, 'id')
  await upsert('teams', { id: teamOps, company_id: C1, location_id: locDubai, parent_team_id: teamExec, name: 'Operations', function: 'ops' }, 'id')

  // --- Persons (~10) ---
  const personDefs = [
    ['p:ceo', 'Layla Haddad', 'layla.haddad@meridiangulf.example', 'active'],
    ['p:cto', 'Omar Farouk', 'omar.farouk@meridiangulf.example', 'active'],
    ['p:eng1', 'Priya Nair', 'priya.nair@meridiangulf.example', 'active'],
    ['p:eng2', 'Daniel Okafor', 'daniel.okafor@meridiangulf.example', 'active'],
    ['p:eng3', 'Sara Al-Mutairi', 'sara.almutairi@meridiangulf.example', 'active'],
    ['p:sales1', 'Khalid Aziz', 'khalid.aziz@meridiangulf.example', 'active'],
    ['p:sales2', 'Maria Santos', 'maria.santos@meridiangulf.example', 'active'],
    ['p:ops1', 'Yusuf Rahman', 'yusuf.rahman@meridiangulf.example', 'active'],
    ['p:ops2', 'Fatima Zahra', 'fatima.zahra@meridiangulf.example', 'on_leave'],
    ['p:ops3', 'James Carter', 'james.carter@meridiangulf.example', 'active'],
  ]
  const persons = {}
  for (const [label, name, email, status] of personDefs) {
    const id = stableId(label)
    persons[label] = id
    await upsert('persons', { id, company_id: C1, full_name: name, email, status }, 'id')
  }

  // --- Roles/Seats (~12), mixed status + Calibration Lens metrics ---
  // Calibration Lens colour drivers (gold/slate/crimson) come from
  // okr_completion_pct + absorbed_capacity_pct. We spread the range so all
  // three bands render: gold (high OKR, healthy capacity), slate (mid),
  // crimson (low OKR or overloaded).
  const seatDefs = [
    // label, team, person(label|null), title, seniority, status, ai_exp, okr, capacity, flight
    ['s:ceo',    teamExec,  'p:ceo',   'Chief Executive Officer',   'cxo',     'active',  10,  92,  85,  8],
    ['s:cto',    teamExec,  'p:cto',   'Chief Technology Officer',  'cxo',     'active',  20,  88,  95,  15],
    ['s:eng-lead', teamEng, 'p:eng1',  'Engineering Lead',          'lead',    'active',  35,  90, 110,  22],  // gold but overloaded
    ['s:eng-sr', teamEng,   'p:eng2',  'Senior Backend Engineer',   'senior',  'active',  55,  74, 120,  40],  // crimson: overload
    ['s:eng-mid',teamEng,   'p:eng3',  'Data Engineer',             'mid',     'active',  70,  58,  80,  35],  // crimson: low OKR
    ['s:eng-open',teamEng,  null,      'Frontend Engineer',         'mid',     'vacant',  60,  null, null, null],
    ['s:eng-plan',teamEng,  null,      'ML Engineer',               'senior',  'planned', 45,  null, null, null],
    ['s:sales-lead',teamSales,'p:sales1','Sales Director',          'director','active',  25,  81,  90,  18],  // gold
    ['s:sales-rep',teamSales,'p:sales2','Enterprise AE',            'senior',  'active',  40,  63,  70,  30],  // slate
    ['s:ops-mgr',teamOps,   'p:ops1',  'Operations Manager',        'manager', 'active',  30,  77,  88,  20],  // slate
    ['s:ops-an', teamOps,   'p:ops3',  'Ops Analyst',               'junior',  'active',  75,  49, 130,  55],  // crimson: both
    ['s:ops-leave',teamOps, 'p:ops2',  'Compliance Officer',        'mid',     'active',  50,  68,  60,  25],  // slate (person on leave)
  ]
  const seats = {}
  for (const [label, team, pl, title, seniority, status, aiExp, okr, cap, flight] of seatDefs) {
    const id = stableId(label)
    seats[label] = id
    await upsert('roles_seats', {
      id, company_id: C1, team_id: team,
      person_id: pl ? persons[pl] : null,
      title, seniority, function: null, status,
      ai_exposure_score: aiExp,
      okr_completion_pct: okr,
      absorbed_capacity_pct: cap,
      flight_risk_score: flight,
      flight_risk_updated_at: flight != null ? new Date().toISOString() : null,
      experienced_budget_sar: 30000, pivot_budget_sar: 22000,
      total_weekly_hours: cap != null ? Math.round(cap * 0.4) : null,
      fte_equivalent: cap != null ? Number((cap / 100).toFixed(2)) : null,
      current_okrs: JSON.stringify(okr != null ? [{ objective: 'Q2 delivery', progress: okr }] : []),
      primary_activities: status === 'active' ? ['planning', 'delivery'] : [],
    }, 'id')
  }

  // --- Activity catalogue (a few, so Activity sliders render non-empty) ---
  if (await tableExists('activity_catalogue')) {
    const actDefs = [
      ['act:eng-deliver', teamEng, 's:eng-sr', 'Ship backend services', 'core', 22, 60],
      ['act:eng-review', teamEng, 's:eng-lead', 'Code review & mentoring', 'leadership', 8, 10],
      ['act:sales-pipe', teamSales, 's:sales-rep', 'Manage enterprise pipeline', 'core', 25, 30],
      ['act:ops-report', teamOps, 's:ops-an', 'Weekly ops reporting', 'support', 12, 85],
    ]
    for (const [label, team, seat, name, cat, hrs, autom] of actDefs) {
      await upsert('activity_catalogue', {
        id: stableId(label), company_id: C1, team_id: team, seat_id: seats[seat],
        activity_name: name, category: cat, estimated_hours_per_week: hrs,
        automation_potential_pct: autom, source: 'industry_taxonomy',
      }, 'id')
    }
  }

  // --- Jobs (legacy table) + roles (active hiring table) — post 1-2 each ---
  await upsert('jobs', {
    id: stableId('job:1'), company_id: C1, title: 'Frontend Engineer',
    location: 'Dubai, UAE', remote: false, salary_min: 18000, salary_max: 28000,
    salary_currency: 'AED', description: 'Build the candidate-facing experience for Meridian Gulf.',
    requirements: ['React', 'TypeScript', 'Tailwind'], ai_tier_required: 'integrator',
    status: 'live', visa_sponsorship: true,
  }, 'id')

  // `roles` is the active-hiring table the company dashboard reads.
  let rolePostedId = null
  if (await tableExists('roles')) {
    const r1 = stableId('role:1')
    const r2 = stableId('role:2')
    await upsert('roles', {
      id: r1, company_id: C1, created_by: C1, title: 'ML Engineer',
      department: 'Engineering', location: 'Dubai, UAE', remote: false,
      salary_min: 25000, salary_max: 40000, salary_currency: 'AED',
      salary_visible: true, engagement_type: 'permanent', accepts_pivot_candidates: true,
      description: 'Own the matching + verification ML stack. You will work across the spine data model and the Company Brain embeddings.',
      requirements: '- 4+ yrs ML in production\n- Python + PyTorch\n- Vector search (pgvector)\n- Comfort with ambiguity',
      what_success_looks_like: 'Ship the v1 match-scoring model in 90 days.',
      team_context: 'Small senior engineering pod reporting to the CTO.',
      status: 'active', updated_at: new Date().toISOString(),
    }, 'id')
    await upsert('roles', {
      id: r2, company_id: C1, created_by: C1, title: 'Enterprise Account Executive',
      department: 'Sales', location: 'Riyadh, SA', remote: false,
      salary_min: 20000, salary_max: 35000, salary_currency: 'SAR',
      salary_visible: true, engagement_type: 'permanent', accepts_pivot_candidates: false,
      description: 'Close PIF-backed enterprise accounts across KSA.',
      requirements: '- 5+ yrs enterprise SaaS sales\n- Arabic + English\n- KSA network',
      status: 'active', updated_at: new Date().toISOString(),
    }, 'id')
    rolePostedId = r1
  }

  report.push({ email: EMAILS.company1, role: 'Company owner (Enterprise)', id: C1,
    rows: `Meridian Gulf · 2 locations · 4 teams · 10 persons · 12 seats · 2 roles + 1 job` })

  // =========================================================================
  // PERSONA 4 — Team member under company1 (accepted company_members)
  // =========================================================================
  console.log('\n' + '-'.repeat(76))
  console.log('PERSONA 4 — Team member under company1')
  console.log('-'.repeat(76))
  await upsert('company_members', {
    company_id: C1, email: EMAILS.teamMember, invited_by: C1,
    accepted_at: new Date().toISOString(), accepted_user_id: teamMember.id,
  }, 'company_id,email')
  // Minimal profile row (trigger may have made one as candidate; keep type).
  await upsert('profiles', { id: teamMember.id, type: 'candidate', full_name: 'Test Team Member', location: 'Dubai, UAE' }, 'id')
  report.push({ email: EMAILS.teamMember, role: 'Team member (company1)', id: teamMember.id,
    rows: 'company_members(accepted)' })

  // =========================================================================
  // PERSONA 5 — HRBP (Enterprise) attached to company1
  // =========================================================================
  console.log('\n' + '-'.repeat(76))
  console.log('PERSONA 5 — HRBP attached to company1')
  console.log('-'.repeat(76))

  // Attach HRBP as an accepted company_member so RLS lets them in.
  await upsert('company_members', {
    company_id: C1, email: EMAILS.hrbp, invited_by: C1,
    accepted_at: new Date().toISOString(), accepted_user_id: hrbp.id,
  }, 'company_id,email')
  await upsert('profiles', { id: hrbp.id, type: 'company', full_name: 'Test HRBP', company_name: 'Meridian Gulf (HRBP)', location: 'Dubai, UAE' }, 'id')

  // employee_hr_profiles for several persons, assigned to this HRBP.
  const hrProfileSeatMap = [
    ['p:eng2', 's:eng-sr', 35000, 12, 2, 'IN', 'work_permit'],
    ['p:eng3', 's:eng-mid', 28000, 18, 0, 'AE', 'residency'],
    ['p:ops3', 's:ops-an', 16000, 9, 4, 'GB', 'work_permit'],
    ['p:sales2', 's:sales-rep', 30000, 21, 1, 'PH', 'work_permit'],
    ['p:ops2', 's:ops-leave', 24000, 5, 6, 'MA', 'residency'],
  ]
  for (const [pl, sl, salary, annual, sick, nat, visa] of hrProfileSeatMap) {
    await upsert('employee_hr_profiles', {
      id: stableId('hrp:' + pl), company_id: C1, person_id: persons[pl],
      current_seat_id: seats[sl], base_salary_sar: salary, base_salary_currency: 'SAR',
      accrued_performance_bonus_sar: 4000, last_comp_review_at: '2026-01-15',
      annual_leave_balance_days: annual, sick_leave_taken_ytd_days: sick,
      parental_leave_balance_days: 0, nationality: nat, visa_type: visa,
      visa_expires_at: '2027-03-31', contract_type: 'full_time', start_date: '2023-06-01',
      assigned_hrbp_user_id: hrbp.id, reporting_manager_user_id: C1,
    }, 'company_id,person_id')
  }

  // Attendance ledger rows incl. one consented sick_leave.
  if (await tableExists('employee_attendance_ledger')) {
    const attDefs = [
      ['att:1', 'p:eng2', 'annual_leave', '2026-05-04', '2026-05-08', 5, false, 'dashboard'],
      ['att:2', 'p:ops3', 'sick_leave', '2026-05-19', '2026-05-20', 2, true, 'whatsapp'],
      ['att:3', 'p:sales2', 'annual_leave', '2026-04-14', '2026-04-18', 5, false, 'dashboard'],
      ['att:4', 'p:ops2', 'parental_leave', '2026-05-01', '2026-06-30', 43, false, 'dashboard'],
    ]
    for (const [label, pl, type, sd, ed, days, consent, via] of attDefs) {
      await upsert('employee_attendance_ledger', {
        id: stableId(label), company_id: C1, person_id: persons[pl], entry_type: type,
        start_date: sd, end_date: ed, days, medical_consent_logged: consent,
        logged_via: via, approved_at: new Date().toISOString(), approved_by: C1,
      }, 'id')
    }
  }

  // ONE PIP lifecycle program in-progress w/ 30/60/90 milestones.
  let pipPersonLabel = 'p:eng3'
  if (await tableExists('hr_lifecycle_programs')) {
    await upsert('hr_lifecycle_programs', {
      id: stableId('pip:1'), company_id: C1, person_id: persons[pipPersonLabel],
      source_seat_id: seats['s:eng-mid'], program_type: 'pip', status: 'in_progress',
      start_date: '2026-05-01', target_end_date: '2026-07-30',
      milestones_30d: JSON.stringify([{ goal: 'Close 4 open tickets/wk', status: 'on_track' }]),
      milestones_60d: JSON.stringify([{ goal: 'Lead one design doc', status: 'pending' }]),
      milestones_90d: JSON.stringify([{ goal: 'Sustain OKR > 75%', status: 'pending' }]),
      private_notes: 'Performance dip since Q1 reorg; capability present, focus is the gap.',
      legal_template_ref: 'UAE-MOL-PIP-v3',
      assigned_hrbp_user_id: hrbp.id, reporting_manager_user_id: C1,
    }, 'id')

    // Matching audit row in organizational_decisions.
    if (await tableExists('organizational_decisions')) {
      // organizational_decisions is insert-only/immutable — guard against dup.
      const { count } = await db.from('organizational_decisions')
        .select('*', { head: true, count: 'exact' })
        .eq('company_id', C1).eq('impacted_person_id', persons[pipPersonLabel]).eq('decision_type', 'restructure')
      if (!count) {
        const { error } = await db.from('organizational_decisions').insert({
          company_id: C1, decision_type: 'restructure',
          justification: 'Opened a 90-day PIP for the Data Engineer following sustained sub-75% OKR completion after the Q1 reorganization. Capability assessment positive; structured support plan with HRBP oversight.',
          decided_by_user_id: hrbp.id, impacted_seat_id: seats['s:eng-mid'],
          impacted_person_id: persons[pipPersonLabel], impacted_team_id: teamEng,
          state_snapshot: { okr_completion_pct: 58, absorbed_capacity_pct: 80, program: 'pip' },
        })
        if (error) console.log('  organizational_decisions insert error ->', error.message)
      }
    }
  }
  report.push({ email: EMAILS.hrbp, role: 'HRBP (Enterprise)', id: hrbp.id,
    rows: '5 hr_profiles · 4 attendance (1 consented sick) · 1 PIP (in_progress) · 1 decision audit' })

  // =========================================================================
  // PERSONA 1 — Candidate A (white-collar, fully verified) + 6 refs
  // =========================================================================
  console.log('\n' + '-'.repeat(76))
  console.log('PERSONA 1 — Candidate A (white-collar, verified)')
  console.log('-'.repeat(76))
  const A = candA.id
  await upsert('profiles', {
    id: A, type: 'candidate',
    full_name: 'Amira Hassan', headline: 'Senior Product Manager · Fintech',
    location: 'Dubai, UAE',
    summary: 'Product leader with 9 years building payments and lending products across MENA. Took two fintech products from 0→1 and scaled a third past 1M users.',
    skills: ['Product Management', 'Fintech', 'Payments', 'Roadmapping', 'SQL', 'Stakeholder Management', 'A/B Testing'],
    languages_spoken: JSON.stringify([{ language: 'English', level: 'C2' }, { language: 'Arabic', level: 'native' }, { language: 'French', level: 'B2' }]),
    native_language: 'Arabic', english_level: 'C2', nationality: 'EG', country_of_origin: 'Egypt',
    industry: 'Financial Services', matched_industries: ['Financial Services', 'Technology'],
    work_history: JSON.stringify([
      { company: 'PayMENA', title: 'Senior Product Manager', dates: '2021–present' },
      { company: 'LendGulf', title: 'Product Manager', dates: '2018–2021' },
      { company: 'SoukPay', title: 'Associate PM', dates: '2016–2018' },
    ]),
    linkedin_url: 'https://linkedin.com/in/amira-hassan-demo',
    ai_tier: 'integrator', completion_pct: 100, profile_live: true,
    onboarding_complete: true, onboarding_step: 5, paid: true,
    cv_parsed: true, cv_kit_purchased: true, cv_tier: 'pro',
    subscription_status: 'active', subscription_tier: 'starter',
    subscription_started_at: new Date().toISOString(),
    verification_tier: 'strong',
    verification_report: JSON.stringify({
      summary: 'All 6 references completed across 3 roles. Manager, peer and report perspectives corroborate leadership + delivery claims.',
      consistency: 'high', flags: [],
    }),
  }, 'id')

  // 6 references across 3 jobs: 2 managers / 2 peers / 2 reports — all completed.
  // job_slot caps at 1|2 in the schema, so map the 3 jobs into slots 1 & 2.
  // Persona 6 (referee) is wired as ref #1's referee.
  const refDefs = [
    // label, ref_type, job_slot, name, email(or referee.email), relationship, title, company
    ['ref:mgr1', 'manager', 1, 'Test Referee (Tomás Vega)', EMAILS.referee, 'Former direct manager', 'VP Product', 'PayMENA'],
    ['ref:mgr2', 'manager', 2, 'Rana Khoury', 'rana.khoury@example.com', 'Former manager', 'Head of Product', 'LendGulf'],
    ['ref:peer1', 'peer', 1, 'Nikhil Rao', 'nikhil.rao@example.com', 'Peer PM', 'Senior PM', 'PayMENA'],
    ['ref:peer2', 'colleague', 2, 'Hana Suzuki', 'hana.suzuki@example.com', 'Cross-functional peer', 'Eng Manager', 'LendGulf'],
    ['ref:rep1', 'stakeholder', 1, 'Lucas Pereira', 'lucas.pereira@example.com', 'Former direct report', 'Associate PM', 'PayMENA'],
    ['ref:rep2', 'stakeholder', 2, 'Aisha Bello', 'aisha.bello@example.com', 'Former direct report', 'Product Analyst', 'SoukPay'],
  ]
  for (const [label, refType, slot, name, email, rel, title, comp] of refDefs) {
    await upsert('candidate_references', {
      id: stableId(label + ':A'), candidate_id: A,
      referee_name: name, referee_email: email, referee_relationship: rel,
      referee_title: title, ref_type: refType, job_slot: slot,
      candidate_company: comp, candidate_job_title: 'Product Manager',
      status: 'completed', completed_at: new Date().toISOString(),
      outreach_channel: 'whatsapp+email',
      response_quality: 'Consistently one of the strongest PMs I have worked with — clear thinker, ships.',
      response_achievement: 'Led the wallet relaunch that lifted activation 31%.',
      response_skills: 'Product strategy, stakeholder alignment, data fluency.',
      response_would_rehire: 'Without hesitation.',
      response_anything_else: 'Calm under pressure, strong cross-functional partner.',
      extracted_skills: ['Product Strategy', 'Stakeholder Management', 'Data Analysis'],
      responses: JSON.stringify({ rehire: true, strengths: ['strategy', 'delivery'] }),
      response_channel: 'web_form', first_responded_at: new Date().toISOString(),
    }, 'id')
  }
  await reconcileReferences(A, refDefs.map(([label]) => stableId(label + ':A')))
  report.push({ email: EMAILS.candA, role: 'Candidate A (verified)', id: A,
    rows: 'profile(strong) · 6 references all completed · subscription active' })

  // =========================================================================
  // PERSONA 6 — Referee / hiring manager (wired to Candidate A ref #1)
  // + a role-share token so the magic-link surface is testable.
  // =========================================================================
  console.log('\n' + '-'.repeat(76))
  console.log('PERSONA 6 — Referee / hiring manager (magic links)')
  console.log('-'.repeat(76))
  await upsert('profiles', { id: referee.id, type: 'candidate', full_name: 'Tomás Vega', headline: 'VP Product (referee/hiring manager)', location: 'Dubai, UAE' }, 'id')

  // The reference magic-link token for ref:mgr1 already exists on that row
  // (candidate_references.token). Surface it in the report.
  const { data: refRow } = await db.from('candidate_references')
    .select('token').eq('id', stableId('ref:mgr1:A')).single()
  const refToken = refRow?.token || '(unavailable)'

  // role-share token pointing at one of company1's roles (magic-link review).
  let roleShareToken = '(roles table absent)'
  if (rolePostedId && await tableExists('role_share_tokens')) {
    roleShareToken = createHash('sha256').update('shapi-seed::roleshare:1').digest('base64url').slice(0, 32)
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    // token is the PK — upsert on it.
    const { error } = await db.from('role_share_tokens').upsert({
      token: roleShareToken, role_id: rolePostedId, company_id: C1, expires_at: expiresAt,
    }, { onConflict: 'token' })
    if (error) { roleShareToken = `(error: ${error.message})` }
  }
  report.push({ email: EMAILS.referee, role: 'Referee / hiring manager', id: referee.id,
    rows: `wired to Candidate A ref:mgr1 · reference magic-link token + role-share token` })

  // =========================================================================
  // PERSONA 2 — Candidate B (blue-collar/pivot, multilingual, voice CV)
  // refs mid-progress (3 of 6 completed)
  // =========================================================================
  console.log('\n' + '-'.repeat(76))
  console.log('PERSONA 2 — Candidate B (blue-collar/pivot, voice CV)')
  console.log('-'.repeat(76))
  const B = candB.id
  await upsert('profiles', {
    id: B, type: 'candidate',
    full_name: 'Imran Qureshi', headline: 'Site Supervisor → Facilities Coordinator (pivot)',
    location: 'Dubai, UAE',
    summary: 'Twelve years on construction sites in the UAE, last five as a site supervisor managing crews of 40+. Now pivoting into facilities/operations coordination.',
    skills: ['Site Supervision', 'Crew Management', 'Safety Compliance', 'Scheduling', 'Logistics'],
    languages_spoken: JSON.stringify([{ language: 'Hindi', level: 'native' }, { language: 'Urdu', level: 'native' }, { language: 'English', level: 'B1' }]),
    native_language: 'Urdu', english_level: 'B1', nationality: 'PK', country_of_origin: 'Pakistan',
    industry: 'Construction', matched_industries: ['Construction', 'Facilities Management'],
    work_history: JSON.stringify([
      { company: 'Gulf Build Contracting', title: 'Site Supervisor', dates: '2019–present' },
      { company: 'Al Noor Construction', title: 'Foreman', dates: '2014–2019' },
    ]),
    ai_tier: 'user', completion_pct: 55, profile_live: false,
    onboarding_complete: false, onboarding_step: 3, paid: false,
    cv_parsed: true,
    // Voice-note CV flavor:
    whatsapp_number: '+971500000002', whatsapp_conversation_active: true,
    whatsapp_language: 'ur', cv_language_preference: 'en',
    whatsapp_chat: JSON.stringify([
      { role: 'assistant', content: 'Send me a voice note about your last job.' },
      { role: 'user', content: '[voice note transcript] I managed a crew of forty on the marina towers project...' },
    ]),
    // voice_samples is a JSONB column on profiles, keyed by language.
    voice_samples: JSON.stringify({
      urdu: { transcript: 'I managed a crew of forty on the marina towers project, handling safety and scheduling.', duration_s: 47, recorded_at: new Date().toISOString() },
      english: { transcript: 'My English is okay for site work, I can talk to the engineers.', duration_s: 18, recorded_at: new Date().toISOString() },
    }),
    subscription_status: 'inactive',
    verification_tier: 'basic',
  }, 'id')

  // 6 references, only 3 completed (mid-progress).
  const refDefsB = [
    ['ref:mgr1', 'manager', 1, 'Bilal Ahmed', 'bilal.ahmed@example.com', 'Site manager', 'completed'],
    ['ref:peer1', 'colleague', 1, 'Sunil Kumar', 'sunil.kumar@example.com', 'Fellow supervisor', 'completed'],
    ['ref:rep1', 'stakeholder', 1, 'Ravi Das', 'ravi.das@example.com', 'Crew lead', 'completed'],
    ['ref:mgr2', 'manager', 2, 'Tariq Mahmood', 'tariq.mahmood@example.com', 'Project manager', 'sent'],
    ['ref:peer2', 'colleague', 2, 'Arjun Singh', 'arjun.singh@example.com', 'Foreman peer', 'contacted'],
    ['ref:rep2', 'stakeholder', 2, 'Mohan Lal', 'mohan.lal@example.com', 'Crew member', 'pending'],
  ]
  for (const [label, refType, slot, name, email, relationship, status] of refDefsB) {
    const done = status === 'completed'
    await upsert('candidate_references', {
      id: stableId(label + ':B'), candidate_id: B,
      referee_name: name, referee_email: email, referee_relationship: relationship,
      ref_type: refType, job_slot: slot,
      candidate_company: 'Gulf Build Contracting', candidate_job_title: 'Site Supervisor',
      status, outreach_channel: 'whatsapp',
      email_sent_at: status !== 'pending' ? new Date().toISOString() : null,
      completed_at: done ? new Date().toISOString() : null,
      response_quality: done ? 'Reliable, safety-first, crews respected him.' : null,
      response_would_rehire: done ? 'Yes.' : null,
    }, 'id')
  }
  await reconcileReferences(B, refDefsB.map(([label]) => stableId(label + ':B')))
  report.push({ email: EMAILS.candB, role: 'Candidate B (pivot, voice CV)', id: B,
    rows: 'multilingual profile(basic) · 3 of 6 references completed · voice-note flavor' })

  // =========================================================================
  // FINAL REPORT
  // =========================================================================
  console.log('\n' + '='.repeat(76))
  console.log('SEED COMPLETE')
  console.log('='.repeat(76))
  console.log('Shared password for all personas:', PASSWORD)
  console.log('\nPersonas:')
  for (const r of report) {
    console.log(`\n  ${r.email}`)
    console.log(`    role: ${r.role}`)
    console.log(`    id:   ${r.id}`)
    console.log(`    rows: ${r.rows}`)
  }

  console.log('\nMagic-link test tokens:')
  console.log('  reference (Candidate A → referee test6):', refToken)
  console.log('    URL: ' + (env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io') + '/reference/' + refToken)  // /reference/[token]
  console.log('  role-share (company1 ML Engineer role):', roleShareToken)
  console.log('    URL: ' + (env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io') + '/r/' + roleShareToken)

  console.log('\n+company1 RESET — BEFORE / AFTER:')
  if (!company1Id) {
    console.log('  (no prior +company1 user existed — created fresh)')
  } else {
    const keys = ['profiles', ...RESET_TABLES]
    console.log('  ' + 'table'.padEnd(30) + 'before'.padStart(8) + 'after'.padStart(8))
    for (const k of keys) {
      console.log('  ' + k.padEnd(30) + String(before[k]).padStart(8) + String(after[k]).padStart(8))
    }
  }
  console.log('\nDone. Re-run safe: node scripts/seed-personas.mjs')
}

main().catch((e) => {
  console.error('\nFATAL:', e.message)
  process.exit(1)
})
