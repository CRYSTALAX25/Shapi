// Merge multiple CV PDFs into a single PDF document.
// Used when a candidate ticks more than one CV in the send picker — we
// generate each individually then concatenate into one file so they get
// ONE attachment (email) or ONE WhatsApp media message.

import { PDFDocument } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCVPdfBuffer, type CVData, type CVProfile } from '@/lib/cv-pdf'

export type CVSelection = {
  // Each selection identifies a CV version in the candidate's cv_cache:
  // language ('english' | 'croatian' | etc.) OR industry ('operations' | etc.)
  // OR 'universal'
  type: 'language' | 'industry' | 'universal'
  value: string  // for language: 'english', 'Italian', etc. ; for industry: 'operations' ; for universal: 'universal'
  label?: string  // human-readable for filename / cover
}

export function cacheKeyForSelection(sel: CVSelection): string {
  if (sel.type === 'universal') return 'universal'
  if (sel.type === 'industry') return `english_${sel.value.toLowerCase()}`
  // language
  if (sel.value.toLowerCase() === 'english') return 'english'
  return `lang_${sel.value.toLowerCase().replace(/\s+/g, '_')}`
}

export function labelForSelection(sel: CVSelection): string {
  if (sel.label) return sel.label
  if (sel.type === 'universal') return 'Universal'
  if (sel.type === 'industry') return `${sel.value.charAt(0).toUpperCase() + sel.value.slice(1)} (industry-targeted)`
  if (sel.value.toLowerCase() === 'english') return 'English'
  return sel.value.charAt(0).toUpperCase() + sel.value.slice(1)
}

// Fetch the CV JSON for one selection from the candidate's cv_cache.
// Returns null if not yet generated (caller should warn or trigger generation).
export async function getCVForSelection(
  candidateId: string,
  sel: CVSelection,
): Promise<{ cv: CVData; profile: CVProfile } | null> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, cv_cache, skill_quadrant, ai_tier, verification_tier')
    .eq('id', candidateId)
    .single()

  if (!profile) return null
  const cache = (profile.cv_cache as Record<string, { cv?: CVData }>) || {}
  const cv = cache[cacheKeyForSelection(sel)]?.cv
  if (!cv) return null

  return {
    cv,
    profile: {
      skill_quadrant: profile.skill_quadrant as CVProfile['skill_quadrant'],
      ai_tier: profile.ai_tier as string | null,
      verification_tier: profile.verification_tier as string | null,
      id: candidateId,
    },
  }
}

// Generate a single merged PDF containing every selected CV back-to-back.
// Throws if no selections render successfully.
export async function generateBundledPdf(
  candidateId: string,
  selections: CVSelection[],
): Promise<{ buffer: Buffer; rendered: CVSelection[]; missing: CVSelection[] }> {
  const merged = await PDFDocument.create()
  const rendered: CVSelection[] = []
  const missing: CVSelection[] = []

  for (const sel of selections) {
    const data = await getCVForSelection(candidateId, sel)
    if (!data) {
      missing.push(sel)
      continue
    }
    try {
      const oneBuffer = await generateCVPdfBuffer(data.cv, data.profile)
      const subDoc = await PDFDocument.load(oneBuffer)
      const pages = await merged.copyPages(subDoc, subDoc.getPageIndices())
      pages.forEach(p => merged.addPage(p))
      rendered.push(sel)
    } catch (err) {
      console.error('[cv-pdf-bundle] failed for selection', sel, err)
      missing.push(sel)
    }
  }

  if (rendered.length === 0) {
    throw new Error('No CVs could be rendered. Make sure each selected CV has been generated at least once (visit /cv-ready to pre-cache).')
  }

  const mergedBytes = await merged.save()
  return { buffer: Buffer.from(mergedBytes), rendered, missing }
}
