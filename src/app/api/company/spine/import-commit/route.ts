import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseHQ } from '@/lib/parseHQ'

// POST /api/company/spine/import-commit
//
// Body: { rows: [{ full_name, email?, role_title, team_name, location_name?,
//                  manager_email?, seniority? }] }
//
// Idempotent bulk insert in this order:
//   1. locations (match by name; create if new; subject to free-tier trigger)
//   2. teams     (match by name + location; create if new)
//   3. persons   (match by email if provided, else full_name+company)
//   4. roles_seats (one per row; assign person; status='active')
//
// Returns counts of new vs reused entities per table.

const SENIORITY_VALUES = new Set([
  'intern', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'vp', 'cxo',
])

type ImportRow = {
  full_name: string
  email?: string
  role_title: string
  team_name: string
  location_name?: string
  manager_email?: string
  seniority?: string
}

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('type, company_name, location, plan_tier')
      .eq('id', user.id)
      .single()
    if (!profile || profile.type !== 'company') {
      return NextResponse.json({ error: 'Company account required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : []
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    // Use the admin client for the writes — RLS would allow these as the
    // owner, but admin sidesteps any cookie-context race during a heavy
    // multi-table write.
    const admin = createAdminClient()

    // ── 1. LOCATIONS ──────────────────────────────────────────────────────
    // Get existing locations once.
    const { data: existingLocs } = await admin
      .from('locations')
      .select('id, name')
      .eq('company_id', user.id)
    const locByName = new Map<string, string>(
      (existingLocs || []).map(l => [l.name.toLowerCase().trim(), l.id])
    )

    // Default location = profile.location (HQ from onboarding) if a row has
    // no location_name. If the user has no locations at all (very rare path),
    // we'll create a fallback "HQ" entry.
    const fallbackLocationName = profile.location || profile.company_name || 'Head office'

    // Collect unique location names across all rows.
    const wantedLocations = new Set<string>()
    for (const row of rows) {
      const name = (row.location_name || fallbackLocationName).trim()
      if (name) wantedLocations.add(name)
    }

    // Create missing locations. Note: free-tier 1-location DB trigger may
    // reject the second insert here; in that case we surface a clean error
    // up to the caller so the UI can prompt upgrade.
    let newLocations = 0
    for (const name of wantedLocations) {
      const key = name.toLowerCase().trim()
      if (locByName.has(key)) continue
      const parsed = parseHQ(name)
      const insertRes = await admin
        .from('locations')
        .insert({
          company_id: user.id,
          name,
          country: parsed.country || 'XX',
          city: parsed.city || null,
          timezone: parsed.timezone || null,
          is_primary: locByName.size === 0 && newLocations === 0,
        })
        .select('id, name')
        .single()
      if (insertRes.error) {
        // Free-tier trigger trips here as 'free_tier_location_limit_exceeded'.
        const msg = insertRes.error.message || ''
        if (msg.includes('free_tier_location_limit_exceeded') || insertRes.error.code === 'P0001') {
          return NextResponse.json({
            error: 'free_tier_location_limit_exceeded',
            message: 'CSV has more than one location but your plan supports only one. Upgrade to Pro for multi-location.',
            partial_results: {
              locations_new: newLocations,
              teams_new: 0, persons_new: 0, seats_new: 0,
            },
          }, { status: 402 })
        }
        console.error('[import-commit] location insert error:', msg)
        continue
      }
      if (insertRes.data) {
        locByName.set(insertRes.data.name.toLowerCase().trim(), insertRes.data.id)
        newLocations++
      }
    }

    // ── 2. TEAMS ──────────────────────────────────────────────────────────
    const { data: existingTeams } = await admin
      .from('teams')
      .select('id, name, location_id')
      .eq('company_id', user.id)
    const teamKey = (name: string, locId: string) => `${name.toLowerCase().trim()}::${locId}`
    const teamMap = new Map<string, string>(
      (existingTeams || []).map(t => [teamKey(t.name, t.location_id), t.id])
    )

    let newTeams = 0
    for (const row of rows) {
      const locName = (row.location_name || fallbackLocationName).trim()
      const locId = locByName.get(locName.toLowerCase().trim())
      if (!locId) continue                                 // location creation must have failed
      const key = teamKey(row.team_name, locId)
      if (teamMap.has(key)) continue
      const insertRes = await admin
        .from('teams')
        .insert({
          company_id: user.id,
          location_id: locId,
          name: row.team_name,
        })
        .select('id, name, location_id')
        .single()
      if (insertRes.error) { console.error('[import-commit] team insert error:', insertRes.error.message); continue }
      if (insertRes.data) {
        teamMap.set(teamKey(insertRes.data.name, insertRes.data.location_id), insertRes.data.id)
        newTeams++
      }
    }

    // ── 3. PERSONS ────────────────────────────────────────────────────────
    const { data: existingPersons } = await admin
      .from('persons')
      .select('id, full_name, email')
      .eq('company_id', user.id)
    const personByEmail = new Map<string, string>()
    const personByName = new Map<string, string>()
    for (const p of existingPersons || []) {
      if (p.email) personByEmail.set(p.email.toLowerCase().trim(), p.id)
      personByName.set(p.full_name.toLowerCase().trim(), p.id)
    }

    let newPersons = 0
    const rowPersonIds = new Map<number, string>()
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const emailKey = row.email ? row.email.toLowerCase().trim() : ''
      const nameKey = row.full_name.toLowerCase().trim()
      let personId = (emailKey && personByEmail.get(emailKey)) || personByName.get(nameKey) || null
      if (!personId) {
        const insertRes = await admin
          .from('persons')
          .insert({
            company_id: user.id,
            full_name: row.full_name,
            email: row.email || null,
          })
          .select('id')
          .single()
        if (insertRes.error) { console.error('[import-commit] person insert error:', insertRes.error.message); continue }
        if (insertRes.data) {
          personId = insertRes.data.id
          if (emailKey) personByEmail.set(emailKey, personId)
          personByName.set(nameKey, personId)
          newPersons++
        }
      }
      if (personId) rowPersonIds.set(i, personId)
    }

    // ── 4. ROLES_SEATS ────────────────────────────────────────────────────
    let newSeats = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const personId = rowPersonIds.get(i)
      if (!personId) continue
      const locName = (row.location_name || fallbackLocationName).trim()
      const locId = locByName.get(locName.toLowerCase().trim())
      if (!locId) continue
      const teamId = teamMap.get(teamKey(row.team_name, locId))
      if (!teamId) continue

      const seniority = row.seniority && SENIORITY_VALUES.has(row.seniority.toLowerCase())
        ? row.seniority.toLowerCase()
        : null

      const insertRes = await admin
        .from('roles_seats')
        .insert({
          company_id: user.id,
          team_id: teamId,
          title: row.role_title,
          seniority,
          person_id: personId,
          status: 'active',
        })
        .select('id')
      if (insertRes.error) { console.error('[import-commit] seat insert error:', insertRes.error.message); continue }
      if (insertRes.data && insertRes.data.length > 0) newSeats++
    }

    return NextResponse.json({
      success: true,
      locations_new: newLocations,
      teams_new: newTeams,
      persons_new: newPersons,
      seats_new: newSeats,
      rows_processed: rows.length,
    })
  } catch (err) {
    console.error('[import-commit] Unhandled error:', err)
    return NextResponse.json({
      error: 'commit_failed',
      message: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
