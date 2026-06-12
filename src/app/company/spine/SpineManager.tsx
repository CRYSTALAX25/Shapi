'use client'

// SpineManager — the org-data action bar + slide-over drawer.
//
// Founder feedback (2026-06): the spine page used to stack the org chart on top
// of four big always-open CRUD cards (Locations / Teams / People / Seats) plus a
// duplicate standalone CSV importer — messy, and it buried the chart. Now the
// chart is the hero and these management surfaces live behind a compact action
// bar pinned under the company name (same pattern as the candidate profile bar).
// Each button opens a right-side drawer with the relevant section. The CSV
// importer is NOT duplicated here — it lives per-location inside the Locations
// section (add a location, then upload its roster).

import { useEffect, useState } from 'react'
import { LocationsSection, TeamsSection, PersonsSection, SeatsSection } from './SpineForms'

type Section = 'locations' | 'teams' | 'people' | 'seats'

// Derive the row shapes from the section components so types stay in lockstep.
type Locations = React.ComponentProps<typeof LocationsSection>['locations']
type Teams = React.ComponentProps<typeof TeamsSection>['teams']
type Persons = React.ComponentProps<typeof PersonsSection>['persons']
type Seats = React.ComponentProps<typeof SeatsSection>['seats']

const ACCENT = '#9D8CFF'

export default function SpineManager({
  locations,
  teams,
  persons,
  seats,
  companyWebsite,
  planTier,
}: {
  locations: Locations
  teams: Teams
  persons: Persons
  seats: Seats
  companyWebsite: string | null
  planTier: string
}) {
  const [open, setOpen] = useState<Section | null>(null)

  // Escape closes the drawer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const items: { id: Section; label: string; icon: string; count: number }[] = [
    { id: 'locations', label: 'Locations', icon: '📍', count: locations.length },
    { id: 'teams', label: 'Teams', icon: '🧩', count: teams.length },
    { id: 'people', label: 'People', icon: '👤', count: persons.length },
    { id: 'seats', label: 'Seats', icon: '💺', count: seats.length },
  ]

  const titles: Record<Section, string> = {
    locations: 'Locations & rosters',
    teams: 'Teams',
    people: 'People',
    seats: 'Seats',
  }

  return (
    <>
      {/* Action bar — pills, mirrors the candidate profile bar. */}
      <div className="flex flex-wrap items-center gap-2">
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => setOpen(it.id)}
            className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition-colors"
            style={{
              background: 'rgba(157,140,255,0.10)',
              color: ACCENT,
              border: `1px solid ${ACCENT}40`,
            }}
          >
            <span className="text-sm leading-none">{it.icon}</span>
            <span>{it.label}</span>
            <span
              className="text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
            >
              {it.count}
            </span>
          </button>
        ))}
      </div>

      {/* Slide-over drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setOpen(null)}
          />
          <aside
            className="absolute top-0 right-0 bottom-0 w-full max-w-[520px] overflow-y-auto"
            style={{
              background: '#060609',
              borderLeft: `1px solid ${ACCENT}33`,
              boxShadow: '-24px 0 70px rgba(0,0,0,0.6)',
            }}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
              style={{ background: '#060609', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <h2 className="text-base font-black tracking-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {titles[open]}
              </h2>
              <button
                onClick={() => setOpen(null)}
                className="text-xs font-bold w-8 h-8 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              {open === 'locations' && (
                <LocationsSection locations={locations} companyWebsite={companyWebsite} planTier={planTier} />
              )}
              {open === 'teams' && <TeamsSection teams={teams} locations={locations} />}
              {open === 'people' && <PersonsSection persons={persons} />}
              {open === 'seats' && <SeatsSection seats={seats} teams={teams} persons={persons} />}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
