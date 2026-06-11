'use client'

import { useMemo, useState } from 'react'
import RoleInterestButton from './RoleInterestButton'
import { getPrestigeForCompany, topAccolade } from '@/lib/company-prestige'

export type ScoredRole = {
  id: string
  title: string
  department: string | null
  location: string | null
  remote: boolean
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_visible: boolean
  description: string | null
  status: string
  created_at: string
  company_id: string
  engagement_type: string | null
  accepts_pivot_candidates: boolean | null
  match_score: number
}

export type CompanyInfo = {
  name: string
  glassdoor?: number
  trust?: { avg: number; count: number }
}

export default function RolesList({
  roles,
  companyMap,
  interestedRoleIds,
  blurred = false,
}: {
  roles: ScoredRole[]
  companyMap: Record<string, CompanyInfo>
  interestedRoleIds: string[]
  // When true: this list is the free 3-role preview. Description text is
  // CSS-blurred and the Interest button is replaced by an unlock CTA.
  blurred?: boolean
}) {
  const [pivotOnly, setPivotOnly] = useState(false)

  const interestedSet = useMemo(() => new Set(interestedRoleIds), [interestedRoleIds])
  const pivotCount = useMemo(() => roles.filter(r => r.accepts_pivot_candidates).length, [roles])
  const visibleRoles = pivotOnly ? roles.filter(r => r.accepts_pivot_candidates) : roles

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[#A6A6B4] text-sm">
          {visibleRoles.length} verified company role{visibleRoles.length !== 1 ? 's' : ''} · ranked by match to your profile · click to express interest
        </p>
        <label className="flex items-center gap-2.5 cursor-pointer flex-shrink-0">
          <span className="text-[#A6A6B4] text-sm">🌱 Pivot-friendly only</span>
          <div
            onClick={() => setPivotOnly(!pivotOnly)}
            className={`w-10 h-6 rounded-full transition-colors relative ${pivotOnly ? 'bg-[#9D8CFF]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${pivotOnly ? 'left-5' : 'left-1'}`} />
          </div>
          {pivotCount > 0 && (
            <span className="text-[#7E7E8E] text-xs">{pivotCount}</span>
          )}
        </label>
      </div>

      {visibleRoles.length === 0 ? (
        <div className="gradient-border-card rounded-2xl p-16 text-center">
          <p className="text-[#A6A6B4] font-bold">{pivotOnly ? 'No Train-to-Hire roles yet' : 'No active roles yet'}</p>
          <p className="text-[#5C5C6A] text-sm mt-2">
            {pivotOnly ? 'Try turning off the Pivot-friendly filter to see all open roles.' : 'Companies are onboarding now — check back soon.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleRoles.map(role => {
            const company = companyMap[role.company_id] || { name: 'Company' }
            const isInterested = interestedSet.has(role.id)
            const matchColor = role.match_score >= 60 ? '#9D8CFF' : role.match_score >= 40 ? '#9D8CFF' : '#9D8CFF'
            const matchLabel = role.match_score >= 60 ? 'Strong match' : role.match_score >= 40 ? 'Good match' : 'Possible'

            return (
              <div key={role.id} className="gradient-border-card card-hover rounded-2xl p-6 transition-all duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <h3 className="text-[#F4F4F7] font-black text-lg">{role.title}</h3>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: `${matchColor}18`, color: matchColor }}>
                        {matchLabel}
                      </span>
                      {role.accepts_pivot_candidates && (
                        <span
                          title="This employer is open to career-changers and will train on the job."
                          className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(157, 140, 255, 0.14)', color: '#9D8CFF' }}>
                          🌱 Train-to-Hire
                        </span>
                      )}
                      {role.remote && (
                        <span className="bg-[rgba(255,255,255,0.05)] text-[#A6A6B4] text-xs px-2.5 py-1 rounded-full">Remote OK</span>
                      )}
                      {role.engagement_type && role.engagement_type !== 'permanent' && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize"
                          style={{ background: 'rgba(157, 140, 255, 0.14)', color: '#9D8CFF' }}>
                          {role.engagement_type === 'temp' ? 'Temp / Shift' : 'Contract'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-[#C7C7D1] text-sm">{company.name}</p>
                      {(() => {
                        const prestige = getPrestigeForCompany(company.name)
                        if (!prestige) return null
                        const accolade = topAccolade(prestige)
                        if (!accolade) return null
                        const toneColors = {
                          gold:   { bg: 'rgba(251,191,36,0.13)', fg: '#D97706' },
                          teal:   { bg: 'rgba(157, 140, 255, 0.12)', fg: '#9D8CFF' },
                          purple: { bg: 'rgba(157, 140, 255, 0.13)', fg: '#9D8CFF' },
                        }[accolade.tone]
                        return (
                          <span
                            title={accolade.tooltip}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full cursor-help"
                            style={{ background: toneColors.bg, color: toneColors.fg }}
                          >
                            ★ {accolade.label}
                          </span>
                        )
                      })()}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#7E7E8E] mb-3 flex-wrap">
                      {role.department && <span>{role.department}</span>}
                      {role.location && <span>📍 {role.location}</span>}
                      {(() => {
                        // Use curated glassdoor first (more reliable), fall back to company-provided
                        const prestige = getPrestigeForCompany(company.name)
                        const score = prestige?.glassdoor ?? company.glassdoor
                        return score ? <span>⭐ {score} Glassdoor</span> : null
                      })()}
                      {company.trust && company.trust.count > 0 && (
                        <span className="font-bold" style={{ color: '#9D8CFF' }}>✓ {company.trust.avg}/5 Shapi trust ({company.trust.count})</span>
                      )}
                      <span>Posted {new Date(role.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    {role.salary_visible && role.salary_min && role.salary_max && (
                      <p className="text-[#9D8CFF] text-sm font-bold mb-3">
                        {role.salary_currency} {role.salary_min.toLocaleString()} – {role.salary_max.toLocaleString()}
                      </p>
                    )}
                    {role.description && (
                      <p
                        className="text-[#A6A6B4] text-xs leading-relaxed line-clamp-2"
                        style={blurred ? { filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' } : undefined}
                      >
                        {role.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-2xl font-black" style={{ color: matchColor }}>{role.match_score}%</div>
                      <div className="text-[#5C5C6A] text-[10px]">match</div>
                    </div>
                    {blurred ? (
                      <a
                        href="/pay?product=roles_board_monthly"
                        className="px-3 py-2 rounded-full text-[11px] font-black text-white whitespace-nowrap"
                        style={{ background: 'linear-gradient(135deg,#9D8CFF, #34D399)' }}
                      >
                        Unlock · $19/mo
                      </a>
                    ) : (
                      <RoleInterestButton roleId={role.id} initialInterested={isInterested} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
