// /cv-lab — design review for the new "Verified Positioning CV" (the format we
// lead with; classic chronological CV stays as the toggle). Renders all three
// variants with Ana's real CV as the live example. Unlinked review route.

import { PositioningStatement, PositioningDossier, PositioningGrid, type CVData } from '@/components/cv/positioning'

export const metadata = { title: 'CV Lab — Verified Positioning CV', robots: { index: false } }

// Ana's CV → positioning data (from 2026 May CV). Numbers + outcomes become the
// verified proof points; verification tiers are illustrative for the mockup.
const ANA: CVData = {
  name: 'Ana O. Barber',
  roleLabel: 'Founder · Operations & Commercial Leader',
  tier: 'Strongly',
  headline: 'I build and run the complex — and make it ⟦pay off⟧.',
  narrative:
    'Twenty years across recruitment, operations, business development and three ventures of my own — a firm built from zero to £1M, $40M saved on a $56M studio contract, 100+ young mothers trained into work, an AI-run brand launched solo. Four languages, four countries — and learning AI hands-on as I build with it.',
  // Chosen for impact AND range — the strongest result on each skill axis, not
  // the most recent jobs. (Founding/scale wins: Essential Staff over "11 placed".)
  proofs: [
    { axis: 'Head', number: '$40M', context: 'NEOM · Business Operations Manager', outcome: 'saved by restructuring a $56M facilities contract', v: 'verified' },
    { axis: 'Hands', number: '90+', context: 'NEOM · Studio Operations', outcome: 'operational workforce run across two production-ready studios', v: 'verified' },
    { axis: 'Spark', number: '£1M', context: 'Essential Staff · Founder & MD', outcome: 'recruitment company built from zero to £1M turnover in 3 years', v: 'assessed' },
    { axis: 'Heart', number: '100+', context: 'Essential Training School (City & Guilds approved) · surfaced in deep-dive', outcome: 'young mothers trained and placed into work — a story her CV never mentioned', v: 'assessed' },
  ],
  expertise: {
    label: 'The Builder-Operator',
    bars: [
      { name: 'Head — strategy & structure', v: 88 },
      { name: 'Heart — people & teams', v: 86 },
      { name: 'Spark — building new', v: 84 },
      { name: 'Hands — execution & ops', v: 70 },
    ],
  },
  waysToWork: ['Permanent', 'Fractional', 'Advisory'],
  languages: [
    { name: 'Croatian', verified: true },
    { name: 'English', verified: true },
    { name: 'Italian', verified: true },
    { name: 'Spanish' },
  ],
  rightToWork: ['UK PR', 'Saudi PR', 'EU (Croatian passport)'],
  profileUrl: 'shapi.io/p/ana-barber',
}

function VariantBlock({ n, title, blurb, children }: { n: number; title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section style={{ width: '100%', maxWidth: 820, margin: '0 auto 56px' }}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: '#34D399', letterSpacing: 1 }}>TEMPLATE {n}</span>
        <h2 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 900, color: '#F4F4F7' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#7E7E8E', maxWidth: 640 }}>{blurb}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>{children}</div>
    </section>
  )
}

export default function CvLab() {
  return (
    <div style={{ minHeight: '100vh', background: '#060609', padding: '48px 20px 80px', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 820, margin: '0 auto 40px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: '#7E7E8E' }}>Shapi · CV Lab</span>
        <h1 style={{ margin: '10px 0 8px', fontSize: 30, fontWeight: 900, color: '#F4F4F7' }}>The Verified Positioning CV</h1>
        <p style={{ margin: '0 auto', maxWidth: 600, fontSize: 14, color: '#A6A6B4', lineHeight: 1.6 }}>
          Three takes on the format we&apos;d lead with — statement headline, a narrative throughline, and proof
          engagements where every number carries its verification status (the bit no other CV can do). Same data,
          three layouts. Pick one and I&apos;ll wire it into the builder, with the classic CV as the toggle.
        </p>
        <p style={{ marginTop: 14, fontSize: 12, color: '#5C5C6A' }}>
          ✓ Verified &nbsp; ◆ Shapi-assessed &nbsp; ○ Self-reported
        </p>
      </div>

      <VariantBlock n={1} title="The Statement  ★ Recommended" blurb="Editorial and minimal — the headline is the hero. Credentials (languages · right to work) are now promoted up top, and each proof is tagged to a skill axis (Head / Hands / Spark / Heart), chosen for impact AND range so the candidate's full breadth lands at a glance.">
        <PositioningStatement d={ANA} />
      </VariantBlock>

      <VariantBlock n={2} title="The Dossier" blurb="Two-column and structured. Left rail carries expertise style, languages, right-to-work and the profile QR; the right side tells the story + proofs. Recruiter-friendly, complete.">
        <PositioningDossier d={ANA} />
      </VariantBlock>

      <VariantBlock n={3} title="The Proof Grid" blurb="Metric-forward and digital-first. Proofs become a grid of verified number cards — instantly scannable on a screen, still prints clean.">
        <PositioningGrid d={ANA} />
      </VariantBlock>
    </div>
  )
}
