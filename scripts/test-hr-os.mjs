// ============================================================================
// test-hr-os.mjs — non-destructive smoke test of the HR-OS RLS policies that
// the 2026-06-13 migration (blueprint_v4_05 + 06) just enabled.
//
// Signs in as the seeded Enterprise company (company1) and, AS THAT USER (so
// RLS is enforced — NOT the service role), exercises:
//   • employee_attendance_ledger  INSERT → UPDATE → DELETE
//   • organizational_decisions    INSERT (immutable audit; we leave it)
//
// Every row it creates in employee_attendance_ledger it deletes again. The one
// organizational_decisions row it inserts is intentionally left (the table is
// append-only by design) and clearly marked as a test row.
//
// Run: node scripts/test-hr-os.mjs
// ============================================================================
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// --- load .env.local (no dotenv dependency) --------------------------------
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EMAIL = 'ana.vbarber+company1@gmail.com'
const PASSWORD = 'ShapiTest!2026'

const pass = (m) => console.log(`  ✅ ${m}`)
const fail = (m, e) => { console.log(`  ❌ ${m}${e ? ' — ' + (e.message || e) : ''}`); process.exitCode = 1 }

const supabase = createClient(URL_, ANON, { auth: { persistSession: false } })

console.log('\n── HR-OS RLS smoke test ───────────────────────────────────────')

// 1. Sign in as the company owner.
const { data: auth, error: signInErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (signInErr || !auth?.user) {
  fail(`sign in as ${EMAIL}`, signInErr || 'no user — has seed-personas been run against this DB?')
  process.exit(1)
}
const companyId = auth.user.id
pass(`signed in as company owner (${companyId.slice(0, 8)}…)`)

// 2. Find a person belonging to this company to attach entries to.
const { data: persons, error: personsErr } = await supabase
  .from('persons').select('id, full_name').eq('company_id', companyId).limit(1)
if (personsErr) fail('read persons (RLS)', personsErr)
if (!persons?.length) { fail('company has at least one person', 'no persons found'); process.exit(1) }
const person = persons[0]
pass(`found person: ${person.full_name} (${person.id.slice(0, 8)}…)`)

// 3. INSERT an attendance entry as the owner (tests "attendance: owner+hrbp write").
const { data: ins, error: insErr } = await supabase
  .from('employee_attendance_ledger')
  .insert({
    company_id: companyId, person_id: person.id,
    entry_type: 'annual_leave', start_date: '2026-07-01', end_date: '2026-07-03',
    days: 3, notes: '[TEST] hr-os smoke test — safe to delete', logged_via: 'api',
  })
  .select('id, entry_type, days').single()
if (insErr) { fail('INSERT attendance entry as owner', insErr); }
else pass(`INSERT attendance entry (id ${ins.id.slice(0, 8)}…, ${ins.days}d ${ins.entry_type})`)

// 4. UPDATE it (tests PATCH route's underlying write path).
if (ins?.id) {
  const { error: updErr } = await supabase
    .from('employee_attendance_ledger').update({ days: 2, entry_type: 'sick_leave' }).eq('id', ins.id)
  if (updErr) fail('UPDATE attendance entry', updErr); else pass('UPDATE attendance entry (days 3→2, type→sick_leave)')
}

// 5. INSERT an organizational_decisions row (tests "decisions: company member insert").
const { data: dec, error: decErr } = await supabase
  .from('organizational_decisions')
  .insert({
    company_id: companyId, decision_type: 'restructure',
    justification: '[TEST] hr-os smoke test row — verifies the immutable audit insert policy works.',
    decided_by_user_id: companyId, impacted_person_id: person.id,
    state_snapshot: { event: 'hr_os_smoke_test', channel: 'test' },
  })
  .select('id').single()
if (decErr) fail('INSERT organizational_decisions as owner', decErr)
else pass(`INSERT organizational_decisions (id ${dec.id.slice(0, 8)}…)`)

// 6. Confirm immutability — UPDATE must be denied (no update policy).
if (dec?.id) {
  const { error: immErr, data: immData } = await supabase
    .from('organizational_decisions').update({ justification: 'tampered' }).eq('id', dec.id).select('id')
  // RLS denies silently (0 rows) rather than erroring.
  if (immErr || !immData?.length) pass('organizational_decisions is immutable (UPDATE denied)')
  else fail('organizational_decisions should be immutable but UPDATE succeeded')
}

// 7. Cleanup the attendance test row (DELETE — tests delete path).
if (ins?.id) {
  const { error: delErr } = await supabase.from('employee_attendance_ledger').delete().eq('id', ins.id)
  if (delErr) fail('DELETE attendance entry (cleanup)', delErr); else pass('DELETE attendance entry (cleanup)')
}

console.log('───────────────────────────────────────────────────────────────')
console.log(process.exitCode ? '❌ Some checks FAILED (see above)\n' : '✅ All HR-OS RLS checks passed\n')
await supabase.auth.signOut()
