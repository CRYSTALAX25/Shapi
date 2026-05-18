// Server-side PDF generation using @react-pdf/renderer.
// Generates a real downloadable PDF for the candidate's CV in any language.
// Mirrors the "Verified Profile" (Variant A) visual — two-column with brand
// gradient strip, Skill Fingerprint sidebar, tier badge, footer with profile URL.
//
// Used by /api/cv/send to attach to email (base64) and by /api/cv/pdf to serve
// directly to Twilio WhatsApp as a MediaUrl download.

import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer'
import React from 'react'

type WorkEntry = { title?: string; company?: string; start?: string; end?: string; achievements?: string }

export type CVData = {
  language?: string
  languageCode?: string
  full_name: string
  headline?: string
  location?: string
  summary?: string
  workHistory?: WorkEntry[]
  chatAnswers?: string[]
  skills?: string[]
  languages_spoken?: Array<{ language: string; level: string }>
  certifications?: Array<{ name?: string; issuer?: string; year?: string }>
  courses?: Array<{ name?: string; platform?: string; year?: string }>
  events?: Array<{ name?: string; year?: string; role?: string }>
}

export type CVProfile = {
  skill_quadrant?: { hands: number; heart: number; head: number; spark: number } | null
  ai_tier?: string | null
  verification_tier?: string | null
  id?: string | null
}

// Brand colours — Shapi teal → purple, plus tier accents
const COLORS = {
  text: '#1a1a2e',
  textMuted: '#4B5563',
  textSubtle: '#6B7280',
  divider: '#E5E7EB',
  sidebar: '#F7F9FB',
  white: 'white',
  brandTeal: '#22D3EE',
  brandPurple: '#A78BFA',
  green: '#34D399',
  amber: '#FBBF24',
  blue: '#3B82F6',
  pink: '#FB7185',
}

const styles = StyleSheet.create({
  page: { flexDirection: 'row', backgroundColor: COLORS.white, fontFamily: 'Helvetica' },
  topStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: COLORS.brandTeal },
  topStripPurple: { position: 'absolute', top: 0, left: '50%', right: 0, height: 6, backgroundColor: COLORS.brandPurple },
  main: { width: '62%', padding: 32, paddingTop: 36 },
  sidebar: { width: '38%', padding: 24, paddingTop: 36, backgroundColor: COLORS.sidebar, borderLeftWidth: 1, borderLeftColor: COLORS.divider },
  name: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, letterSpacing: -0.4 },
  headline: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  location: { fontSize: 10, color: COLORS.textSubtle, marginTop: 6 },
  verifiedChip: { marginTop: 10, padding: '5 10', borderRadius: 99, fontSize: 9, fontWeight: 'bold', alignSelf: 'flex-start' },
  sectionLabel: { fontSize: 8.5, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: COLORS.textSubtle, marginTop: 18, marginBottom: 7, borderBottomWidth: 1, borderBottomColor: COLORS.divider, paddingBottom: 4 },
  summary: { fontSize: 10.5, lineHeight: 1.5, color: COLORS.textMuted },
  job: { marginBottom: 11 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 1 },
  jobTitle: { fontSize: 11, fontWeight: 'bold', color: COLORS.text },
  jobCompany: { fontSize: 10, color: COLORS.textMuted },
  jobDates: { fontSize: 9, color: COLORS.textSubtle },
  jobAch: { fontSize: 9.5, lineHeight: 1.55, color: COLORS.textMuted, marginTop: 3 },
  certLine: { fontSize: 9.5, lineHeight: 1.5, color: COLORS.textMuted },
  sideLabel: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: COLORS.textSubtle, marginBottom: 7 },
  sideBlock: { marginBottom: 18 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  barLabel: { fontSize: 9, fontWeight: 'bold', color: COLORS.text, width: 38 },
  barTrack: { flexDirection: 'row', flex: 1, marginLeft: 6 },
  barSeg: { width: 6, height: 5, marginRight: 1, borderRadius: 1 },
  aiTier: { fontSize: 9, color: COLORS.textSubtle, marginTop: 7 },
  langRow: { fontSize: 10, color: COLORS.text, marginBottom: 3 },
  langName: { fontWeight: 'bold' },
  langLevel: { color: COLORS.textSubtle },
  skillChip: { fontSize: 8.5, padding: '2 7', backgroundColor: COLORS.white, color: COLORS.textMuted, marginRight: 3, marginBottom: 3, borderRadius: 99, borderWidth: 0.5, borderColor: COLORS.divider },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap' },
  quoteBox: { borderLeftWidth: 1.5, borderLeftColor: COLORS.brandPurple, paddingLeft: 9, paddingTop: 2, paddingBottom: 2, marginBottom: 9 },
  quoteText: { fontSize: 9, lineHeight: 1.45, color: COLORS.textMuted, fontStyle: 'italic' },
  quoteAttr: { fontSize: 7.5, fontWeight: 'bold', letterSpacing: 0.5, color: COLORS.textSubtle, marginTop: 3, textTransform: 'uppercase' },
  footer: { position: 'absolute', bottom: 16, left: 32, right: 32, fontSize: 8, color: COLORS.textSubtle, textAlign: 'center', borderTopWidth: 0.5, borderTopColor: COLORS.divider, paddingTop: 8 },
})

// Pick the 1-2 strongest WhatsApp quotes for the sidebar.
function pickQuotes(answers: string[] | undefined, max = 2): string[] {
  if (!answers || answers.length === 0) return []
  const cleaned = answers
    .map(a => (a || '').trim().replace(/\s+/g, ' '))
    .filter(a => a.length >= 40 && a.length <= 160)
  const scored = cleaned
    .map(a => ({ a, score: Math.abs(100 - a.length) }))
    .sort((x, y) => x.score - y.score)
    .slice(0, max)
    .map(s => s.a)
  if (scored.length === 0 && answers.length > 0) {
    return answers.slice(0, max).map(a => {
      const t = (a || '').trim().replace(/\s+/g, ' ')
      return t.length > 160 ? t.slice(0, 157) + '…' : t
    })
  }
  return scored
}

const tierMeta = (t?: string | null): { label: string; bg: string; color: string } | null => {
  if (!t || t === 'unverified') return null
  if (t === 'premium') return { label: 'Premium Verified', bg: '#FEF3C7', color: '#92400E' }
  if (t === 'strong') return { label: 'Strongly Verified', bg: '#D1FAE5', color: '#065F46' }
  if (t === 'basic') return { label: 'Basic Verified', bg: '#DBEAFE', color: '#1E40AF' }
  return null
}

const axisColors: Record<string, string> = {
  hands: COLORS.green,
  heart: COLORS.pink,
  head: COLORS.brandTeal,
  spark: COLORS.brandPurple,
}

function FingerprintBar({ label, value, axis }: { label: string; value: number; axis: string }) {
  const filled = Math.max(0, Math.min(10, Math.round(value)))
  const color = axisColors[axis] || COLORS.brandTeal
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        {Array.from({ length: 10 }, (_, i) => (
          <View key={i} style={{ ...styles.barSeg, backgroundColor: i < filled ? color : COLORS.divider }} />
        ))}
      </View>
    </View>
  )
}

function CVDocument({ cv, profile }: { cv: CVData; profile: CVProfile }) {
  const q = profile.skill_quadrant
  const tier = tierMeta(profile.verification_tier)
  const certsLine = cv.certifications && cv.certifications.length > 0
    ? cv.certifications.map(c => `${c.name}${c.issuer ? ` (${c.issuer})` : ''}${c.year ? ` ${c.year}` : ''}`).join(' · ')
    : null
  const coursesLine = cv.courses && cv.courses.length > 0
    ? cv.courses.map(c => `${c.name}${c.platform ? ` · ${c.platform}` : ''}${c.year ? ` ${c.year}` : ''}`).join(' · ')
    : null
  const profileShortId = profile.id ? profile.id.slice(0, 8) : null
  const sidebarQuotes = pickQuotes(cv.chatAnswers, 2)
  const firstName = (cv.full_name || '').split(' ')[0] || 'them'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topStrip} />
        <View style={styles.topStripPurple} />

        {/* Main column */}
        <View style={styles.main}>
          <Text style={styles.name}>{cv.full_name || ''}</Text>
          {cv.headline && <Text style={styles.headline}>{cv.headline}</Text>}
          {cv.location && <Text style={styles.location}>{cv.location}</Text>}
          {tier && (
            <Text style={{ ...styles.verifiedChip, backgroundColor: tier.bg, color: tier.color }}>
              {tier.label}
            </Text>
          )}

          {cv.summary && (
            <>
              <Text style={styles.sectionLabel}>Profile</Text>
              <Text style={styles.summary}>{cv.summary}</Text>
            </>
          )}

          {cv.workHistory && cv.workHistory.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Experience</Text>
              {cv.workHistory.map((j, i) => (
                <View key={i} style={styles.job} wrap={false}>
                  <View style={styles.jobHeader}>
                    <Text style={styles.jobTitle}>{j.title || ''}</Text>
                    <Text style={styles.jobDates}>{j.start || ''} – {j.end || 'Present'}</Text>
                  </View>
                  {j.company && <Text style={styles.jobCompany}>{j.company}</Text>}
                  {j.achievements && <Text style={styles.jobAch}>{j.achievements}</Text>}
                </View>
              ))}
            </>
          )}

          {(certsLine || coursesLine) && (
            <>
              <Text style={styles.sectionLabel}>Certifications & Learning</Text>
              {certsLine && <Text style={styles.certLine}>{certsLine}</Text>}
              {coursesLine && <Text style={{ ...styles.certLine, marginTop: 4 }}>Courses: {coursesLine}</Text>}
            </>
          )}
        </View>

        {/* Sidebar */}
        <View style={styles.sidebar}>
          {q && (
            <View style={styles.sideBlock}>
              <Text style={styles.sideLabel}>Skill Fingerprint</Text>
              <FingerprintBar label="Heart" value={q.heart} axis="heart" />
              <FingerprintBar label="Spark" value={q.spark} axis="spark" />
              <FingerprintBar label="Head" value={q.head} axis="head" />
              <FingerprintBar label="Hands" value={q.hands} axis="hands" />
              {profile.ai_tier && (
                <Text style={styles.aiTier}>AI {profile.ai_tier.charAt(0).toUpperCase() + profile.ai_tier.slice(1)}</Text>
              )}
            </View>
          )}

          {sidebarQuotes.length > 0 && (
            <View style={styles.sideBlock}>
              <Text style={styles.sideLabel}>In Their Own Words</Text>
              {sidebarQuotes.map((quote, i) => (
                <View key={i} style={styles.quoteBox} wrap={false}>
                  <Text style={styles.quoteText}>&ldquo;{quote}&rdquo;</Text>
                  {i === sidebarQuotes.length - 1 && (
                    <Text style={styles.quoteAttr}>— {firstName}, Shapi interview</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {cv.languages_spoken && cv.languages_spoken.length > 0 && (
            <View style={styles.sideBlock}>
              <Text style={styles.sideLabel}>Languages</Text>
              {cv.languages_spoken.map((l, i) => (
                <Text key={i} style={styles.langRow}>
                  <Text style={styles.langName}>{l.language}</Text>
                  <Text style={styles.langLevel}>{l.level ? ` · ${l.level}` : ''}</Text>
                </Text>
              ))}
            </View>
          )}

          {cv.skills && cv.skills.length > 0 && (
            <View style={styles.sideBlock}>
              <Text style={styles.sideLabel}>Skills</Text>
              <View style={styles.skillRow}>
                {cv.skills.slice(0, 24).map((s, i) => (
                  <Text key={i} style={styles.skillChip}>{s}</Text>
                ))}
              </View>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          {profileShortId
            ? `Verified by Shapi · shapi.io/p/${profileShortId}`
            : 'Verified by Shapi · shapi.io'}
        </Text>
      </Page>
    </Document>
  )
}

// Render the document to a Buffer (server-side). Returns a Node Buffer ready
// to attach to email or upload to storage for Twilio.
export async function generateCVPdfBuffer(cv: CVData, profile: CVProfile): Promise<Buffer> {
  const instance = pdf(<CVDocument cv={cv} profile={profile} />)
  const blob = await instance.toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
