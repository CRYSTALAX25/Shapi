'use client'

import { useMemo, useState } from 'react'
import { computeLedger, defaultSeverance, type SeatAction, type NewHire } from '@/lib/workforce-pl'

export type SeatInput = { id: string; title: string; annualCost: number }

type Row = { id: string; title: string; annualCost: number; action: SeatAction; severance: number; upskilling: number }

const OCEAN = '#38BDF8'
const EMERALD = '#34D399'
const CORAL = '#FB7185'
const AMBER = '#FBBF24'

const ACTION_META: Record<SeatAction, { label: string; color: string }> = {
  keep: { label: 'Keep', color: '#7E7E8E' },
  cut: { label: 'Cut', color: CORAL },
  redeploy: { label: 'Redeploy', color: AMBER },
}

const fieldStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  padding: '6px 8px', fontSize: 12, color: '#F4F4F7', outline: 'none', width: '100%',
}

export default function WorkforcePLClient({ seats, companyName }: { seats: SeatInput[]; companyName: string }) {
  const [currency, setCurrency] = useState('SAR')
  const [rows, setRows] = useState<Row[]>(() =>
    seats.map(s => ({ id: s.id, title: s.title, annualCost: s.annualCost, action: 'keep', severance: defaultSeverance(s.annualCost), upskilling: 8000 })),
  )
  const [hires, setHires] = useState<NewHire[]>([])

  const ledger = useMemo(() => computeLedger(rows, hires), [rows, hires])

  const fmt = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`
  const patch = (id: string, p: Partial<Row>) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...p } : r)))
  const addHire = () => setHires(hs => [...hs, { id: `h${hs.length}-${hs.length}`, title: '', annualCost: 0, recruitmentFee: 0 }])
  const patchHire = (id: string, p: Partial<NewHire>) => setHires(hs => hs.map(h => (h.id === id ? { ...h, ...p } : h)))

  return (
    <div>
      {/* ── The 3 headline KPI blocks ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Kpi label="Total capital cost" value={fmt(ledger.totalCapitalCost)} sub="one-off: severance + upskilling + hiring" color={AMBER} />
        <Kpi
          label="Annual net saving"
          value={fmt(ledger.annualNetSavings)}
          sub={ledger.annualNetSavings >= 0 ? 'run-rate reduction, every year' : 'run-rate increase'}
          color={ledger.annualNetSavings >= 0 ? EMERALD : CORAL}
        />
        <Kpi
          label="Break-even"
          value={ledger.breakEvenMonths == null ? '—' : `${ledger.breakEvenMonths} mo`}
          sub={ledger.breakEvenMonths == null ? 'no payback (cost ≥ saving)' : 'until the restructure pays for itself'}
          color={OCEAN}
        />
      </div>

      {/* Currency + run-rate summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs" style={{ color: '#A6A6B4' }}>
        <span>
          Run-rate: <strong style={{ color: '#F4F4F7' }}>{fmt(ledger.currentRunRate)}</strong> → <strong style={{ color: ledger.targetRunRate <= ledger.currentRunRate ? EMERALD : CORAL }}>{fmt(ledger.targetRunRate)}</strong>
          <span className="ml-2 text-[#5C5C6A]">· {ledger.cutCount} cut · {ledger.redeployCount} redeploy · {ledger.addCount} new · {ledger.keepCount} kept</span>
        </span>
        <label className="flex items-center gap-1.5">
          Currency
          <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...fieldStyle, width: 'auto', padding: '4px 6px' }}>
            {['SAR', 'AED', 'USD', 'GBP', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {/* ── Seat scenario table ── */}
      {rows.length === 0 ? (
        <div className="rounded-2xl p-6 mb-6 text-sm" style={{ background: '#0D0C14', border: '1px dashed rgba(56,189,248,0.4)', color: '#A6A6B4' }}>
          No seats on your org spine yet. Build it at <a href="/company/spine" className="font-black" style={{ color: OCEAN }}>the spine →</a> and they&apos;ll appear here. You can still model new hires below.
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7E7E8E', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="col-span-5">Seat</span>
            <span className="col-span-3">Annual cost</span>
            <span className="col-span-2">Action</span>
            <span className="col-span-2">One-off</span>
          </div>
          {rows.map(r => (
            <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="col-span-5 text-sm truncate" style={{ color: r.action === 'cut' ? '#7E7E8E' : '#F4F4F7', textDecoration: r.action === 'cut' ? 'line-through' : 'none' }}>{r.title}</span>
              <div className="col-span-3">
                <input type="number" value={r.annualCost || ''} onChange={e => patch(r.id, { annualCost: Number(e.target.value), severance: r.severance || defaultSeverance(Number(e.target.value)) })} style={fieldStyle} placeholder="0" />
              </div>
              <div className="col-span-2">
                <select value={r.action} onChange={e => patch(r.id, { action: e.target.value as SeatAction })} style={{ ...fieldStyle, color: ACTION_META[r.action].color, fontWeight: 700 }}>
                  <option value="keep">Keep</option>
                  <option value="cut">Cut</option>
                  <option value="redeploy">Redeploy</option>
                </select>
              </div>
              <div className="col-span-2">
                {r.action === 'cut' && <input type="number" value={r.severance || ''} onChange={e => patch(r.id, { severance: Number(e.target.value) })} style={fieldStyle} placeholder="severance" title="Severance" />}
                {r.action === 'redeploy' && <input type="number" value={r.upskilling || ''} onChange={e => patch(r.id, { upskilling: Number(e.target.value) })} style={fieldStyle} placeholder="upskilling" title="Upskilling cost" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New hires ── */}
      <div className="rounded-2xl p-4 mb-6" style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#7E7E8E' }}>Roles you&apos;ll open</p>
          <button onClick={addHire} className="text-[11px] font-bold" style={{ color: OCEAN }}>+ Add a hire</button>
        </div>
        {hires.length === 0 ? (
          <p className="text-xs" style={{ color: '#5C5C6A' }}>No new hires in this scenario.</p>
        ) : (
          <div className="space-y-2">
            {hires.map(h => (
              <div key={h.id} className="grid grid-cols-12 gap-2 items-center">
                <input className="col-span-5" value={h.title} onChange={e => patchHire(h.id, { title: e.target.value })} style={fieldStyle} placeholder="Role title" />
                <input className="col-span-4" type="number" value={h.annualCost || ''} onChange={e => patchHire(h.id, { annualCost: Number(e.target.value) })} style={fieldStyle} placeholder="annual cost" />
                <input className="col-span-3" type="number" value={h.recruitmentFee || ''} onChange={e => patchHire(h.id, { recruitmentFee: Number(e.target.value) })} style={fieldStyle} placeholder="hiring fee" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── The ledger breakdown ── */}
      <div className="rounded-2xl p-5" style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#7E7E8E' }}>The ledger</p>
        <LedgerLine label="Severance payouts" value={fmt(ledger.severanceTotal)} debit />
        <LedgerLine label="Upskilling / redeployment" value={fmt(ledger.upskillingTotal)} debit />
        <LedgerLine label="Recruitment fees" value={fmt(ledger.recruitmentTotal)} debit />
        <div className="my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
        <LedgerLine label="Total capital cost" value={fmt(ledger.totalCapitalCost)} bold />
        <div className="my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
        <LedgerLine label="Eliminated payroll (annual)" value={fmt(ledger.currentRunRate - ledger.targetRunRate + 0)} credit />
        <LedgerLine label="Annual net saving" value={fmt(ledger.annualNetSavings)} bold credit={ledger.annualNetSavings >= 0} debit={ledger.annualNetSavings < 0} />
        <p className="text-[11px] leading-relaxed mt-4" style={{ color: '#5C5C6A' }}>
          {ledger.breakEvenMonths == null
            ? `At this scenario the one-off cost isn't recovered by run-rate savings — adjust the cuts or hires above.`
            : `${companyName} recovers the ${fmt(ledger.totalCapitalCost)} capital cost in ${ledger.breakEvenMonths} months, then saves ${fmt(ledger.annualNetSavings)} every year after.`}
        </p>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#0D0C14', border: `1px solid ${color}33` }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
      <p className="text-2xl font-black tracking-tight" style={{ color: '#F4F4F7' }}>{value}</p>
      <p className="text-[10px] mt-1" style={{ color: '#7E7E8E' }}>{sub}</p>
    </div>
  )
}

function LedgerLine({ label, value, debit, credit, bold }: { label: string; value: string; debit?: boolean; credit?: boolean; bold?: boolean }) {
  const color = bold ? '#F4F4F7' : debit ? CORAL : credit ? EMERALD : '#A6A6B4'
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs" style={{ color: bold ? '#F4F4F7' : '#A6A6B4', fontWeight: bold ? 800 : 400 }}>{label}</span>
      <span className="text-sm tabular-nums" style={{ color, fontWeight: bold ? 900 : 600 }}>{debit ? '−' : credit ? '+' : ''}{value}</span>
    </div>
  )
}
