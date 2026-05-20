// Work-style self-assessment.
//
// An optional questionnaire that produces a "Work Style" profile across 5
// spectrums. It is a SELF-ASSESSMENT → shown as ◆ Shapi-assessed (our
// consistent methodology applied to the candidate's own answers), never
// presented as an independently-verified credential. Complements the Skill
// Quadrant (which is derived from CV/interview) with how they *prefer* to work.

export type Dimension = {
  key: string
  poleA: string   // high score (100)
  poleB: string   // low score (0)
  blurb: string
}

export const DIMENSIONS: Dimension[] = [
  { key: 'collaboration', poleA: 'Collaborative', poleB: 'Independent', blurb: 'Thrives with a team vs. does best heads-down solo' },
  { key: 'leadership', poleA: 'Director', poleB: 'Contributor', blurb: 'Naturally takes the lead vs. drives from within' },
  { key: 'structure', poleA: 'Structured', poleB: 'Adaptive', blurb: 'Plans and processes vs. improvises and flexes' },
  { key: 'decisions', poleA: 'Analytical', poleB: 'Intuitive', blurb: 'Decides on data vs. on judgement and gut' },
  { key: 'communication', poleA: 'Direct', poleB: 'Diplomatic', blurb: 'Says it straight vs. reads the room first' },
]

// Each question: a statement answered 1 (Strongly disagree) → 5 (Strongly agree).
// `dimension` = which spectrum it scores; `towardA` = whether agreement pushes
// the score toward poleA (true) or poleB (false).
export type Question = { id: string; text: string; dimension: string; towardA: boolean }

export const QUESTIONS: Question[] = [
  // collaboration
  { id: 'c1', text: 'I do my best work bouncing ideas off other people.', dimension: 'collaboration', towardA: true },
  { id: 'c2', text: 'I get more done when I can work alone, without interruptions.', dimension: 'collaboration', towardA: false },
  { id: 'c3', text: 'I energise quickly in group brainstorms and workshops.', dimension: 'collaboration', towardA: true },
  // leadership
  { id: 'l1', text: 'In a group with no clear leader, I tend to step up and organise things.', dimension: 'leadership', towardA: true },
  { id: 'l2', text: 'I prefer to support a strong plan rather than set the direction myself.', dimension: 'leadership', towardA: false },
  { id: 'l3', text: 'I am comfortable making the call when a team is stuck.', dimension: 'leadership', towardA: true },
  // structure
  { id: 's1', text: 'I like to plan my work and follow a clear process.', dimension: 'structure', towardA: true },
  { id: 's2', text: 'I happily change the plan on the fly when things shift.', dimension: 'structure', towardA: false },
  { id: 's3', text: 'Checklists and systems make me more effective.', dimension: 'structure', towardA: true },
  // decisions
  { id: 'd1', text: 'I want to see the data before I commit to a decision.', dimension: 'decisions', towardA: true },
  { id: 'd2', text: 'I often trust my gut even when the numbers are incomplete.', dimension: 'decisions', towardA: false },
  { id: 'd3', text: 'I am more convinced by evidence than by a compelling story.', dimension: 'decisions', towardA: true },
  // communication
  { id: 'm1', text: 'I say what I think directly, even when it is uncomfortable.', dimension: 'communication', towardA: true },
  { id: 'm2', text: 'I carefully consider how a message will land before I deliver it.', dimension: 'communication', towardA: false },
  { id: 'm3', text: 'People know where they stand with me — I am very straightforward.', dimension: 'communication', towardA: true },
]

export type WorkStyle = {
  scores: Record<string, number>   // 0-100 per dimension (100 = poleA)
  assessed_at: string
}

// Compute 0-100 scores per dimension from raw 1-5 answers.
export function scoreWorkStyle(answers: Record<string, number>): Record<string, number> {
  const byDim: Record<string, number[]> = {}
  for (const q of QUESTIONS) {
    const raw = answers[q.id]
    if (typeof raw !== 'number' || raw < 1 || raw > 5) continue
    // Normalise 1-5 → 0-100, invert if the question scores toward poleB
    const norm = ((raw - 1) / 4) * 100
    const contribution = q.towardA ? norm : 100 - norm
    ;(byDim[q.dimension] ||= []).push(contribution)
  }
  const scores: Record<string, number> = {}
  for (const d of DIMENSIONS) {
    const vals = byDim[d.key]
    scores[d.key] = vals && vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 50
  }
  return scores
}

// Human label for a dimension score (which pole it leans, how strongly).
export function styleLabel(d: Dimension, score: number): string {
  if (score >= 65) return d.poleA
  if (score <= 35) return d.poleB
  return `Balanced (${d.poleB}/${d.poleA})`
}
