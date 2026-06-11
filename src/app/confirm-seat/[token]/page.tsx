import { createAdminClient } from '@/lib/supabase/admin'
import ConfirmSeatClient from './ConfirmSeatClient'

// PUBLIC seat-confirmation page — the employee side of VERIFIED ORG.
// No login (same pattern as /reference/[token]): the unguessable token IS the
// auth. We load everything server-side with the service role, then hand a
// plain props object to the client component. Mobile-first — most employees
// open this from a WhatsApp message.

export const metadata = { title: 'Confirm your role · Shapi' }
export const dynamic = 'force-dynamic'

// Seniority rank used to surface a best-effort "manager" name from the same
// team's most senior occupied seat (the spine has no explicit reporting line
// yet — this is advisory context on the confirm card, nothing more).
const MANAGER_RANK: Record<string, number> = {
  cxo: 6, vp: 5, director: 4, manager: 3, lead: 2,
}

export default async function ConfirmSeatPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from('seat_confirmation_tokens')
    .select('id, token, company_id, person_id, seat_id, status, sent_via, expires_at, response')
    .eq('token', token)
    .maybeSingle()

  // Invalid token (or migration not run yet — table missing reads as error).
  if (error || !row) {
    return <ConfirmSeatClient token={token} initial={{ state: 'invalid' }} />
  }

  const expired = row.status === 'expired' ||
    (row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false)
  if (expired) {
    return <ConfirmSeatClient token={token} initial={{ state: 'expired' }} />
  }

  // Load the seat + person + company context for the confirm card.
  const [{ data: seat }, { data: person }, { data: companyProfile }] = await Promise.all([
    row.seat_id
      ? admin.from('roles_seats').select('id, title, team_id, person_id, seniority').eq('id', row.seat_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.person_id
      ? admin.from('persons').select('id, full_name, preferred_name').eq('id', row.person_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('profiles').select('company_name').eq('id', row.company_id).maybeSingle(),
  ])

  if (!seat) {
    // Seat was deleted after the link went out — treat as invalid.
    return <ConfirmSeatClient token={token} initial={{ state: 'invalid' }} />
  }

  // Team name + best-effort manager name (most senior other occupied seat on
  // the same team).
  let teamName: string | null = null
  let managerName: string | null = null
  if (seat.team_id) {
    const [{ data: team }, { data: teamSeats }] = await Promise.all([
      admin.from('teams').select('id, name').eq('id', seat.team_id).maybeSingle(),
      admin
        .from('roles_seats')
        .select('id, person_id, seniority')
        .eq('team_id', seat.team_id)
        .not('person_id', 'is', null)
        .neq('id', seat.id),
    ])
    teamName = team?.name || null

    const ranked = (teamSeats || [])
      .map(s => ({ s, rank: MANAGER_RANK[s.seniority || ''] || 0 }))
      .filter(x => x.rank > (MANAGER_RANK[seat.seniority || ''] || 0))
      .sort((a, b) => b.rank - a.rank)
    const mgrSeat = ranked[0]?.s
    if (mgrSeat?.person_id) {
      const { data: mgr } = await admin
        .from('persons')
        .select('full_name, preferred_name')
        .eq('id', mgrSeat.person_id)
        .maybeSingle()
      managerName = mgr ? (mgr.preferred_name || mgr.full_name) : null
    }
  }

  const personName = person ? (person.preferred_name || person.full_name) : null

  return (
    <ConfirmSeatClient
      token={token}
      initial={{
        state: row.status === 'confirmed' ? 'confirmed'
          : row.status === 'disputed' ? 'disputed'
          : 'pending',
        personName,
        companyName: companyProfile?.company_name || 'Your company',
        seatTitle: seat.title,
        teamName,
        managerName,
      }}
    />
  )
}
