// OKR templates + helpers — the "templates + import" model (Ana, 2026-06-12).
//
// Best practice for an HR suite (vs a dedicated OKR tool): ship editable,
// role-based templates so teams adopt OKRs without architecting them from
// scratch, AND let companies import/paste their own. Templates are starting
// points — every field is editable once adopted.
//
// Storage: roles_seats.current_okrs (JSONB) holds OkrObjective[]. The seat's
// okr_completion_pct is recomputed from key-result progress on every save, so
// the Calibration Lens stays in sync automatically.

export type OkrKeyResult = {
  text: string
  // Optional measurable target/current (e.g. 0 → 100 deals). progress_pct is
  // the source of truth for completion; target/current are display sugar.
  target?: number | null
  current?: number | null
  unit?: string | null
  progress_pct: number
}

export type OkrObjective = {
  objective: string
  key_results: OkrKeyResult[]
}

export type OkrTemplate = {
  id: string
  label: string
  // Which seat functions this template best fits (matched against
  // roles_seats.function / team function). 'any' = always offered.
  functions: string[]
  objectives: OkrObjective[]
}

const kr = (text: string): OkrKeyResult => ({ text, progress_pct: 0, target: null, current: null, unit: null })

export const OKR_TEMPLATES: OkrTemplate[] = [
  {
    id: 'engineering',
    label: 'Engineering',
    functions: ['engineering'],
    objectives: [
      {
        objective: 'Ship a reliable, fast product',
        key_results: [
          kr('Reduce p95 API latency from X ms to Y ms'),
          kr('Keep production incident count under 2 per quarter'),
          kr('Ship the top 3 roadmap features by end of quarter'),
        ],
      },
      {
        objective: 'Raise engineering quality',
        key_results: [
          kr('Lift automated test coverage to 80%'),
          kr('Cut PR review turnaround to under 24h'),
        ],
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    functions: ['sales'],
    objectives: [
      {
        objective: 'Hit the quarterly revenue number',
        key_results: [
          kr('Close $X in new ARR'),
          kr('Generate Y qualified opportunities'),
          kr('Maintain win rate above 25%'),
        ],
      },
      {
        objective: 'Build a healthy pipeline',
        key_results: [
          kr('Keep 3x pipeline coverage of target'),
          kr('Book 30 first meetings per month'),
        ],
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    functions: ['ops'],
    objectives: [
      {
        objective: 'Run the business efficiently',
        key_results: [
          kr('Reduce average ticket resolution time to under 8h'),
          kr('Achieve 95% on-time delivery of operational SLAs'),
          kr('Cut operating cost per unit by 10%'),
        ],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    functions: ['finance'],
    objectives: [
      {
        objective: 'Strengthen financial control + visibility',
        key_results: [
          kr('Close the books within 5 working days each month'),
          kr('Keep forecast accuracy within 5% of actuals'),
          kr('Bring DSO down to under 45 days'),
        ],
      },
    ],
  },
  {
    id: 'people',
    label: 'People / HR',
    functions: ['people'],
    objectives: [
      {
        objective: 'Build a high-trust, high-retention team',
        key_results: [
          kr('Keep regretted attrition under 8%'),
          kr('Reach 90% completion of quarterly check-ins'),
          kr('Fill open roles within 45 days median time-to-hire'),
        ],
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    functions: ['marketing'],
    objectives: [
      {
        objective: 'Drive qualified demand',
        key_results: [
          kr('Generate X marketing-qualified leads'),
          kr('Lift website-to-signup conversion to Y%'),
          kr('Keep blended CAC under $Z'),
        ],
      },
    ],
  },
  {
    id: 'leadership',
    label: 'Leadership / Exec',
    functions: ['other'],
    objectives: [
      {
        objective: 'Deliver the company strategy this quarter',
        key_results: [
          kr('Hit the company-level revenue / growth target'),
          kr('Land the top strategic initiative on plan'),
          kr('Keep team engagement score above 8/10'),
        ],
      },
    ],
  },
  {
    id: 'generic',
    label: 'General (any role)',
    functions: ['any'],
    objectives: [
      {
        objective: 'Deliver my core priorities this quarter',
        key_results: [
          kr('Complete priority #1'),
          kr('Complete priority #2'),
          kr('Complete priority #3'),
        ],
      },
    ],
  },
]

// Suggest the best template for a seat's function (falls back to generic).
export function templatesForFunction(fn: string | null | undefined): OkrTemplate[] {
  const f = (fn || '').toLowerCase()
  const exact = OKR_TEMPLATES.filter(t => t.functions.includes(f))
  const generic = OKR_TEMPLATES.filter(t => t.functions.includes('any'))
  // Always include the matched ones first, then everything else, de-duped.
  const rest = OKR_TEMPLATES.filter(t => !exact.includes(t) && !generic.includes(t))
  return [...exact, ...generic, ...rest]
}

// Average key-result progress → objective progress.
export function objectiveProgress(o: OkrObjective): number {
  const krs = o.key_results || []
  if (krs.length === 0) return 0
  const sum = krs.reduce((acc, k) => acc + clampPct(k.progress_pct), 0)
  return Math.round(sum / krs.length)
}

// Overall OKR completion = average objective progress. Drives okr_completion_pct.
export function overallCompletion(okrs: OkrObjective[]): number {
  if (!okrs || okrs.length === 0) return 0
  const sum = okrs.reduce((acc, o) => acc + objectiveProgress(o), 0)
  return Math.round(sum / okrs.length)
}

export function clampPct(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

// Normalize whatever is stored in current_okrs (which may be: a JSON string
// from older seeds, the legacy {objective, progress} shape, or the current
// shape) into a clean OkrObjective[].
export function normalizeOkrs(raw: unknown): OkrObjective[] {
  let val = raw
  if (typeof val === 'string') {
    try { val = JSON.parse(val) } catch { return [] }
  }
  if (!Array.isArray(val)) return []
  return val.map((item): OkrObjective => {
    const o = item as Record<string, unknown>
    const objective = typeof o.objective === 'string' ? o.objective : 'Objective'
    if (Array.isArray(o.key_results)) {
      return {
        objective,
        key_results: (o.key_results as unknown[]).map((k): OkrKeyResult => {
          const kk = k as Record<string, unknown>
          return {
            text: typeof kk.text === 'string' ? kk.text : 'Key result',
            target: typeof kk.target === 'number' ? kk.target : null,
            current: typeof kk.current === 'number' ? kk.current : null,
            unit: typeof kk.unit === 'string' ? kk.unit : null,
            progress_pct: clampPct(kk.progress_pct),
          }
        }),
      }
    }
    // Legacy {objective, progress} → one synthetic KR.
    const progress = clampPct(o.progress)
    return { objective, key_results: [{ text: 'Overall progress', progress_pct: progress, target: null, current: null, unit: null }] }
  })
}

// Parse free text / pasted OKRs into objectives. Heuristic, forgiving:
//   • A line that is NOT indented and not a bullet starts a new Objective.
//   • Lines starting with "-", "*", "•" or that are indented become key results
//     of the current objective.
//   • "Objective:" / "O:" / "KR:" prefixes are stripped.
export function parseOkrText(text: string): OkrObjective[] {
  const lines = text.split(/\r?\n/)
  const out: OkrObjective[] = []
  let current: OkrObjective | null = null
  for (const rawLine of lines) {
    if (!rawLine.trim()) continue
    const indented = /^\s+/.test(rawLine)
    const line = rawLine.trim()
    const bulletMatch = /^([-*•]|\d+[.)]|kr[:.]?)\s+/i.exec(line)
    const isKeyResult = (indented || !!bulletMatch) && current !== null
    const cleaned = line
      .replace(/^([-*•]|\d+[.)])\s+/i, '')
      .replace(/^(objective|obj|o)[:.]?\s+/i, '')
      .replace(/^(key result|kr)[:.]?\s+/i, '')
      .trim()
    if (!cleaned) continue
    if (isKeyResult && current) {
      current.key_results.push({ text: cleaned, progress_pct: 0, target: null, current: null, unit: null })
    } else {
      current = { objective: cleaned, key_results: [] }
      out.push(current)
    }
  }
  // Any objective with no KRs gets a placeholder so it's usable.
  for (const o of out) {
    if (o.key_results.length === 0) o.key_results.push({ text: 'Key result', progress_pct: 0, target: null, current: null, unit: null })
  }
  return out
}
