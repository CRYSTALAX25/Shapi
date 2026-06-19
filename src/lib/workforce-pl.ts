// Workforce P&L Ledger — translate an org restructure into a balanced financial
// ledger (the spec's §4.4, the "replace McKinsey" headline). Pure computation:
// given a scenario (which seats are kept / cut / redeployed + new hires + the
// cost assumptions), return the three header KPIs + the debit/credit breakdown.
//
//   Total Capital Cost     = severance + upskilling + recruitment (one-off debits)
//   Annual Net Savings     = current payroll run-rate − target payroll run-rate
//   Break-Even Horizon (mo)= Total Capital Cost ÷ (Annual Net Savings ÷ 12)
//
// No DB / React here — just the math, so it's testable and reused by the page.

export type SeatAction = 'keep' | 'cut' | 'redeploy'

export type ScenarioSeat = {
  id: string
  title: string
  annualCost: number   // current annual payroll for this seat
  action: SeatAction
  severance: number    // one-off, only when action = 'cut'
  upskilling: number   // one-off, only when action = 'redeploy'
}

export type NewHire = {
  id: string
  title: string
  annualCost: number       // added to the target run-rate
  recruitmentFee: number   // one-off debit
}

export type Ledger = {
  // One-off capital debits
  severanceTotal: number
  upskillingTotal: number
  recruitmentTotal: number
  totalCapitalCost: number
  // Run-rate
  currentRunRate: number
  targetRunRate: number
  annualNetSavings: number          // current − target (can be negative)
  // Headline
  breakEvenMonths: number | null    // null when savings ≤ 0 (never pays back)
  // Counts
  cutCount: number
  redeployCount: number
  addCount: number
  keepCount: number
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)

export function computeLedger(seats: ScenarioSeat[], newHires: NewHire[]): Ledger {
  const cut = seats.filter(s => s.action === 'cut')
  const redeploy = seats.filter(s => s.action === 'redeploy')
  const keep = seats.filter(s => s.action === 'keep')

  const severanceTotal = sum(cut.map(s => s.severance))
  const upskillingTotal = sum(redeploy.map(s => s.upskilling))
  const recruitmentTotal = sum(newHires.map(h => h.recruitmentFee))
  const totalCapitalCost = severanceTotal + upskillingTotal + recruitmentTotal

  // Current run-rate = every existing seat's annual cost. Target = drop the cut
  // seats' payroll, add the new hires'. Redeployed + kept seats keep their cost.
  const currentRunRate = sum(seats.map(s => s.annualCost))
  const addedCost = sum(newHires.map(h => h.annualCost))
  const cutSavings = sum(cut.map(s => s.annualCost))
  const targetRunRate = currentRunRate - cutSavings + addedCost
  const annualNetSavings = currentRunRate - targetRunRate // = cutSavings − addedCost

  const breakEvenMonths = annualNetSavings > 0
    ? Math.round((totalCapitalCost / (annualNetSavings / 12)) * 10) / 10
    : null

  return {
    severanceTotal, upskillingTotal, recruitmentTotal, totalCapitalCost,
    currentRunRate, targetRunRate, annualNetSavings, breakEvenMonths,
    cutCount: cut.length, redeployCount: redeploy.length, addCount: newHires.length, keepCount: keep.length,
  }
}

// Sensible default severance from annual cost — used to pre-fill the scenario so
// the ledger reads non-zero immediately. ~3 months' pay is a common baseline;
// the user edits it. (Gulf end-of-service is roughly this order of magnitude.)
export function defaultSeverance(annualCost: number): number {
  return Math.round((annualCost * 0.25) / 1000) * 1000
}
