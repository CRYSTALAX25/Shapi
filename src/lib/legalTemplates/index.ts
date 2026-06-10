// ============================================================================
// src/lib/legalTemplates — vetted legal template CATALOGUE (references only).
// ============================================================================
//
// CRITICAL — READ BEFORE TOUCHING THIS FILE:
//
//   This module NEVER generates legal text with AI. It is a static, hand-curated
//   catalogue of REFERENCES to externally vetted templates, plus safe structural
//   boilerplate (process steps, notice-period facts, placeholder slots). A
//   licensed adviser writes the actual binding wording; Shapi only routes the
//   user to the correct vetted document and shows non-binding scaffolding.
//
//   The UI displays / links to the matching template stub. It does NOT ask
//   Claude (or any model) to draft PIP or separation legal wording. Adding an
//   AI-drafting path here would re-introduce the exact liability this catalogue
//   exists to remove. Don't.
//
// Jurisdictions differ materially on notice periods, severance (end-of-service
// gratuity), and probation — UAE, KSA and India are NOT interchangeable. The
// catalogue is keyed by (country, program_type) so the page always shows the
// right document for the right situation.
//
// `legal_template_ref` stored on hr_lifecycle_programs == LegalTemplate.ref.
// ============================================================================

export type TemplateCountry = 'UAE' | 'KSA' | 'IND'

// Only the program types that carry legal weight get a template. Onboarding /
// reskill / redeploy / augment don't route to a separation-style document.
export type TemplateProgramType = 'pip' | 'separation'

export type TemplatePlaceholder = {
  // Token the vetted document expects, e.g. {{EMPLOYEE_NAME}}. Filled in by a
  // human adviser inside the actual document — Shapi only lists the slots.
  token: string
  label: string
  hint: string
}

export type LegalTemplate = {
  // Stable reference stored in hr_lifecycle_programs.legal_template_ref.
  ref: string
  country: TemplateCountry
  countryLabel: string
  programType: TemplateProgramType
  title: string
  version: string
  // The governing law / regulator this template was vetted against.
  governingLaw: string
  // Last review date by counsel (informational — drives a "re-verify" nudge).
  vettedOn: string
  // Plain-language summary of the jurisdiction's hard requirements. Shown so
  // the HRBP understands WHY this differs from the other countries.
  jurisdictionNotes: string[]
  // Ordered process the document walks through. NOT legal text — process scaffold.
  processSteps: string[]
  // Slots the vetted document expects a human to fill.
  placeholders: TemplatePlaceholder[]
  // Where the actual vetted document lives. Internal stub route for the MVP;
  // swap for a DMS / counsel portal link later. NEVER an AI generation route.
  documentStubPath: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared placeholder slots (same human-filled fields across most documents).
// ─────────────────────────────────────────────────────────────────────────────
const COMMON_PLACEHOLDERS: TemplatePlaceholder[] = [
  { token: '{{EMPLOYEE_NAME}}', label: 'Employee full legal name', hint: 'As on the labour contract / Emirates ID / Iqama.' },
  { token: '{{JOB_TITLE}}', label: 'Job title', hint: 'Title on the registered employment contract.' },
  { token: '{{MANAGER_NAME}}', label: 'Reporting manager', hint: 'Person accountable for the review meetings.' },
  { token: '{{EFFECTIVE_DATE}}', label: 'Effective date', hint: 'Date the plan / notice formally begins.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// THE CATALOGUE. Hand-curated references — no generated wording anywhere.
// ─────────────────────────────────────────────────────────────────────────────
export const LEGAL_TEMPLATES: LegalTemplate[] = [
  // ── UAE ──────────────────────────────────────────────────────────────────
  {
    ref: 'UAE-MOHRE-PIP-v3',
    country: 'UAE',
    countryLabel: 'United Arab Emirates',
    programType: 'pip',
    title: 'Performance Improvement Plan — UAE',
    version: 'v3',
    governingLaw: 'UAE Federal Decree-Law No. 33 of 2021 (Labour Law) + MOHRE guidance',
    vettedOn: '2026-03-01',
    jurisdictionNotes: [
      'No statutory PIP duration; document a reasonable, evidenced improvement window (commonly 30–90 days).',
      'Termination for poor performance must be preceded by written warnings — the PIP is the evidence trail.',
      'Probation under Decree-Law 33: max 6 months; different notice rules apply during probation.',
    ],
    processSteps: [
      'Written notice of performance concerns with specific, measured examples.',
      'Agree improvement objectives and review cadence (30 / 60 / 90).',
      'Documented review meetings at each milestone, signed by both parties.',
      'Final review: close successfully, extend once, or escalate to separation.',
    ],
    placeholders: [
      ...COMMON_PLACEHOLDERS,
      { token: '{{IMPROVEMENT_OBJECTIVES}}', label: 'Improvement objectives', hint: 'Specific, measurable targets — adviser drafts the binding wording.' },
    ],
    documentStubPath: '/company/legal-templates/UAE-MOHRE-PIP-v3',
  },
  {
    ref: 'UAE-MOHRE-SEP-v3',
    country: 'UAE',
    countryLabel: 'United Arab Emirates',
    programType: 'separation',
    title: 'Separation / End-of-Service — UAE',
    version: 'v3',
    governingLaw: 'UAE Federal Decree-Law No. 33 of 2021, Arts. 43 (notice) & 51 (gratuity)',
    vettedOn: '2026-03-01',
    jurisdictionNotes: [
      'Notice period: minimum 30 days, up to 90 days, per contract (Art. 43).',
      'End-of-service gratuity: 21 days basic pay per year for first 5 years, 30 days per year thereafter (Art. 51).',
      'Arbitrary dismissal exposes the employer to up to 3 months’ wages in compensation — justification must be on file.',
    ],
    processSteps: [
      'Confirm lawful ground for termination and that the audit trail supports it.',
      'Issue written notice respecting the contractual notice period.',
      'Calculate end-of-service gratuity + accrued leave settlement.',
      'Cancel work permit / visa and file the MOHRE end-of-service record.',
    ],
    placeholders: [
      ...COMMON_PLACEHOLDERS,
      { token: '{{NOTICE_PERIOD_DAYS}}', label: 'Notice period (days)', hint: '30–90 per contract; adviser confirms.' },
      { token: '{{LAST_WORKING_DAY}}', label: 'Last working day', hint: 'After notice has run.' },
      { token: '{{GRATUITY_BASIS}}', label: 'Gratuity calculation basis', hint: 'Years of service + basic wage — adviser computes.' },
    ],
    documentStubPath: '/company/legal-templates/UAE-MOHRE-SEP-v3',
  },

  // ── KSA ──────────────────────────────────────────────────────────────────
  {
    ref: 'KSA-MHRSD-PIP-v2',
    country: 'KSA',
    countryLabel: 'Saudi Arabia',
    programType: 'pip',
    title: 'Performance Improvement Plan — KSA',
    version: 'v2',
    governingLaw: 'Saudi Labor Law (Royal Decree M/51) + MHRSD regulations',
    vettedOn: '2026-02-15',
    jurisdictionNotes: [
      'Art. 80 lists the only grounds for termination without award; poor performance is NOT automatically one — build the evidence trail.',
      'Probation: up to 90 days, extendable to 180 by written agreement.',
      'Saudization (Nitaqat) status can be affected by the eventual outcome — coordinate with GR before escalation.',
    ],
    processSteps: [
      'Written notice of underperformance with documented examples.',
      'Agree improvement objectives and 30 / 60 / 90 review cadence.',
      'Signed review meetings at each milestone in Arabic + English where required.',
      'Final review: close, extend, or escalate per Labor Law process.',
    ],
    placeholders: [
      ...COMMON_PLACEHOLDERS,
      { token: '{{IMPROVEMENT_OBJECTIVES}}', label: 'Improvement objectives', hint: 'Specific, measurable targets — adviser drafts binding wording (AR/EN).' },
    ],
    documentStubPath: '/company/legal-templates/KSA-MHRSD-PIP-v2',
  },
  {
    ref: 'KSA-MHRSD-SEP-v2',
    country: 'KSA',
    countryLabel: 'Saudi Arabia',
    programType: 'separation',
    title: 'Separation / End-of-Service — KSA',
    version: 'v2',
    governingLaw: 'Saudi Labor Law (Royal Decree M/51), Arts. 74–85 + Art. 84 (award)',
    vettedOn: '2026-02-15',
    jurisdictionNotes: [
      'Notice: 60 days for monthly-paid indefinite contracts; 30 days otherwise (Art. 75).',
      'End-of-service award: half a month per year for first 5 years, one month per year thereafter (Art. 84).',
      'Termination outside Art. 80 grounds without notice exposes the employer to compensation; Nitaqat/GR sign-off needed.',
    ],
    processSteps: [
      'Confirm lawful ground and that the immutable audit trail supports it.',
      'Issue written notice respecting Art. 75 notice periods.',
      'Compute end-of-service award (Art. 84) + accrued entitlements.',
      'Process GOSI / Qiwa exit and cancel Iqama / work permit.',
    ],
    placeholders: [
      ...COMMON_PLACEHOLDERS,
      { token: '{{NOTICE_PERIOD_DAYS}}', label: 'Notice period (days)', hint: '30 or 60 per contract type; adviser confirms.' },
      { token: '{{LAST_WORKING_DAY}}', label: 'Last working day', hint: 'After notice has run.' },
      { token: '{{AWARD_BASIS}}', label: 'End-of-service award basis', hint: 'Years of service + wage — adviser computes per Art. 84.' },
    ],
    documentStubPath: '/company/legal-templates/KSA-MHRSD-SEP-v2',
  },

  // ── India ────────────────────────────────────────────────────────────────
  {
    ref: 'IND-SE-PIP-v1',
    country: 'IND',
    countryLabel: 'India',
    programType: 'pip',
    title: 'Performance Improvement Plan — India',
    version: 'v1',
    governingLaw: 'State Shops & Establishments Acts + Industrial Disputes Act, 1947 (where applicable)',
    vettedOn: '2026-01-20',
    jurisdictionNotes: [
      'Rules vary by STATE — confirm the governing Shops & Establishments Act for the employee’s location.',
      'A “workman” under the Industrial Disputes Act has stronger protection; classification must be confirmed first.',
      'Documented, fair PIP process is the key defence against an unfair-dismissal / retrenchment challenge.',
    ],
    processSteps: [
      'Confirm employee classification (workman vs. non-workman) and applicable state Act.',
      'Issue written performance notice with specific examples.',
      'Agree improvement objectives and 30 / 60 / 90 review cadence.',
      'Signed milestone reviews; final review closes, extends, or escalates.',
    ],
    placeholders: [
      ...COMMON_PLACEHOLDERS,
      { token: '{{STATE_JURISDICTION}}', label: 'State / governing Act', hint: 'Which state Shops & Establishments Act applies.' },
      { token: '{{IMPROVEMENT_OBJECTIVES}}', label: 'Improvement objectives', hint: 'Specific, measurable targets — adviser drafts binding wording.' },
    ],
    documentStubPath: '/company/legal-templates/IND-SE-PIP-v1',
  },
  {
    ref: 'IND-SE-SEP-v1',
    country: 'IND',
    countryLabel: 'India',
    programType: 'separation',
    title: 'Separation / Termination — India',
    version: 'v1',
    governingLaw: 'Industrial Disputes Act, 1947 + Payment of Gratuity Act, 1972 + state Acts',
    vettedOn: '2026-01-20',
    jurisdictionNotes: [
      'Notice / pay-in-lieu set by contract and the applicable state Act (commonly 30–90 days).',
      'Gratuity: 15 days’ wages per completed year of service after 5 years (Payment of Gratuity Act, 1972).',
      'Retrenchment of a “workman” (≥1 year service) triggers ID Act notice + compensation + possible government notice.',
    ],
    processSteps: [
      'Confirm classification and applicable state Act before any notice.',
      'Issue written notice or pay-in-lieu per contract / statute.',
      'Compute gratuity + accrued leave + statutory dues.',
      'Issue relieving + experience letters and settle full-and-final.',
    ],
    placeholders: [
      ...COMMON_PLACEHOLDERS,
      { token: '{{STATE_JURISDICTION}}', label: 'State / governing Act', hint: 'Which state Act applies.' },
      { token: '{{NOTICE_PERIOD_DAYS}}', label: 'Notice period (days)', hint: 'Per contract / state Act; adviser confirms.' },
      { token: '{{LAST_WORKING_DAY}}', label: 'Last working day', hint: 'After notice / pay-in-lieu.' },
      { token: '{{GRATUITY_BASIS}}', label: 'Gratuity basis', hint: '15 days/year after 5 years — adviser computes.' },
    ],
    documentStubPath: '/company/legal-templates/IND-SE-SEP-v1',
  },
]

export const TEMPLATE_COUNTRIES: { code: TemplateCountry; label: string }[] = [
  { code: 'UAE', label: 'United Arab Emirates' },
  { code: 'KSA', label: 'Saudi Arabia' },
  { code: 'IND', label: 'India' },
]

// ── Lookups ──────────────────────────────────────────────────────────────────

export function getTemplate(
  country: TemplateCountry,
  programType: TemplateProgramType
): LegalTemplate | null {
  return (
    LEGAL_TEMPLATES.find(
      (t) => t.country === country && t.programType === programType
    ) || null
  )
}

export function getTemplateByRef(ref: string): LegalTemplate | null {
  return LEGAL_TEMPLATES.find((t) => t.ref === ref) || null
}

// Which program_type values route to a legal template at all. Used by the API
// to validate that a legal_template_ref, if supplied, matches the program type.
export function programTypeNeedsTemplate(programType: string): programType is TemplateProgramType {
  return programType === 'pip' || programType === 'separation'
}

// Validate that a ref is real AND matches the program type — never trust a
// client-supplied ref blindly.
export function isValidTemplateRefForType(ref: string, programType: string): boolean {
  const t = getTemplateByRef(ref)
  return !!t && t.programType === programType
}
