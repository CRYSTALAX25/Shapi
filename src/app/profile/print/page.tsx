import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Anthropic from '@anthropic-ai/sdk'

type WorkEntry = {
  title?: string
  company?: string
  start?: string
  end?: string
  achievements?: string
}

type TranslatedCV = {
  language: string
  languageCode: string
  full_name: string
  headline: string
  location: string
  summary: string
  sectionLabels: {
    profile: string
    inTheirOwnWords: string
    experience: string
    skills: string
    present: string
    verifiedBy: string
  }
  workHistory: WorkEntry[]
  chatAnswers: string[]
  skills: string[]
}

async function generateCV(
  profile: Record<string, unknown>,
  chatMessages: Array<{role: string; content: string}>,
  mode: 'english' | 'native'
): Promise<TranslatedCV | null> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const userMessages = chatMessages.filter(m => m.role === 'user').map(m => m.content)
  const sampleText = userMessages.slice(0, 5).join(' | ')
  const workHistory: WorkEntry[] = Array.isArray(profile.work_history) ? profile.work_history as WorkEntry[] : []
  const skills: string[] = Array.isArray(profile.skills) ? profile.skills as string[] : []
  const industry = (profile.industry as string) || 'general'

  const industryInstructions: Record<string, string> = {
    finance: 'Lead achievements with numbers. Formal tone. Highlight P&L, AUM, risk, compliance outcomes.',
    tech: 'Name specific stack in context. Quantify scale (users, uptime, latency). Show ownership.',
    creative: 'Evocative language. Name brands and campaigns. Include reach/engagement metrics.',
    healthcare: 'Certifications and licenses prominent. Clinical hours and patient volumes. Formal and precise.',
    legal: 'Practice areas clear. Deal/case experience named. Academic credentials weighted.',
    marketing: 'Every campaign gets a metric: ROAS, conversion, CAC, reach. Channel ownership clear.',
    operations: 'Certifications and licences first. Volume, scale, safety record. Direct and factual.',
    hospitality: 'Property name and star rating upfront. RevPAR, covers, guest scores. Languages listed.',
    education: 'Student outcomes and cohort size. Research and publications. Safeguarding noted.',
    sales: 'Quota attainment % in every role. Deal size, revenue generated. Methodology named.',
    general: 'Lead with impact. Quantify wherever possible. Clear upward progression.',
  }

  const industryGuide = industryInstructions[industry] || industryInstructions.general

  const languageInstruction = mode === 'native'
    ? `Detect the candidate's native language from their messages: "${sampleText || 'No messages'}". If unclear, default to Arabic. Translate ALL text values into that language.`
    : `Write everything in polished professional English.`

  const prompt = `You are an expert CV writer producing a world-class ${mode === 'native' ? 'native language' : 'English'} CV.

CANDIDATE INFO:
- Name: ${profile.full_name || ''}
- Headline: ${profile.headline || ''}
- Location: ${profile.location || ''}
- Industry: ${industry}
- Summary: ${(profile.summary as string || '').replace(/"/g, "'")}
- Work history: ${JSON.stringify(workHistory)}
- Skills: ${JSON.stringify(skills)}
- WhatsApp conversation (use these stories, quotes, and insights to ENRICH the achievements and summary — this is the gold): ${JSON.stringify(userMessages)}

INDUSTRY WRITING GUIDE — ${industry.toUpperCase()}:
${industryGuide}

LANGUAGE: ${languageInstruction}

Using ALL of the above — CV data AND WhatsApp insights — produce an enriched, polished CV. The WhatsApp answers often contain specific numbers, challenges, and stories that are missing from the raw CV. Weave them in.

Return ONLY valid JSON in this exact structure (keep JSON keys in English, translate values if native mode):
{
  "language": "${mode === 'english' ? 'English' : 'detected language name'}",
  "languageCode": "${mode === 'english' ? 'en' : 'detected 2-letter code'}",
  "full_name": "...",
  "headline": "...",
  "location": "...",
  "summary": "...",
  "sectionLabels": {
    "profile": "...",
    "inTheirOwnWords": "...",
    "experience": "...",
    "skills": "...",
    "present": "...",
    "verifiedBy": "..."
  },
  "workHistory": [{"title":"...","company":"...","start":"...","end":"...","achievements":"..."}],
  "chatAnswers": ["best quote 1 from whatsapp", "best quote 2", "best quote 3"],
  "skills": ["skill1","skill2"]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0]) as TranslatedCV
  } catch (err) {
    console.error('[print] CV generation error:', err)
    return null
  }
}

export default async function PrintCV({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const params = await searchParams
  const isNative = params.lang === 'native'

  const workHistory: WorkEntry[] = Array.isArray(profile.work_history) ? profile.work_history : []
  const skills: string[] = Array.isArray(profile.skills) ? profile.skills : []
  const allChatMessages: Array<{role: string; content: string}> = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat : []
  const chatAnswers = allChatMessages.filter(m => m.role === 'user').slice(0, 3)

  // Generate enriched CV via Claude — always, for both English and native versions
  // English version: polished + industry-aware + WhatsApp insights woven in
  // Native version: same but fully translated
  let translated: TranslatedCV | null = null
  if (allChatMessages.length > 0 || profile.work_history) {
    translated = await generateCV(
      profile as Record<string, unknown>,
      allChatMessages,
      isNative ? 'native' : 'english'
    )
  }

  const isRTL = translated && ['ar', 'he', 'ur', 'fa'].includes(translated.languageCode)

  // Use translated content if available, otherwise English
  const displayName = translated?.full_name || profile.full_name || 'Your Name'
  const displayHeadline = translated?.headline || profile.headline || ''
  const displayLocation = translated?.location || profile.location || ''
  const displaySummary = translated?.summary || profile.summary || ''
  const displayWork = translated?.workHistory || workHistory
  const displaySkills = translated?.skills || skills
  const displayChatAnswers = translated?.chatAnswers || chatAnswers.map(m => m.content)
  const labels = translated?.sectionLabels || {
    profile: 'Profile',
    inTheirOwnWords: 'In Their Own Words',
    experience: 'Experience',
    skills: 'Skills',
    present: 'Present',
    verifiedBy: 'Verified profile · shapi.io',
  }

  return (
    <html lang={translated?.languageCode || 'en'} dir={isRTL ? 'rtl' : 'ltr'}>
      <head>
        <title>{displayName} — Shapi CV</title>
        <meta charSet="utf-8" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: ${isRTL ? "'Noto Sans Arabic', 'Arial', sans-serif" : "'Georgia', serif"};
            color: #1a1a2e;
            background: white;
            direction: ${isRTL ? 'rtl' : 'ltr'};
          }
          .page { max-width: 800px; margin: 0 auto; padding: 48px 56px; }

          .no-print { position: fixed; top: 20px; ${isRTL ? 'left' : 'right'}: 20px; z-index: 100; display: flex; gap: 12px; }
          .btn { padding: 10px 20px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; font-family: system-ui, sans-serif; }
          .btn-primary { background: linear-gradient(135deg, #22D3EE, #A78BFA); color: #060609; }
          .btn-secondary { background: #f0f0f0; color: #333; }

          .header { border-bottom: 2px solid #1a1a2e; padding-bottom: 24px; margin-bottom: 28px; }
          .name { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
          .headline { font-size: 16px; color: #555; margin-bottom: 8px; }
          .meta { font-size: 13px; color: #888; display: flex; gap: 16px; flex-wrap: wrap; }
          .badge { display: inline-block; background: #f0f0f8; color: #6B21A8; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; font-family: system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; }
          .lang-badge { display: inline-block; background: #e0f7fa; color: #0891b2; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; font-family: system-ui, sans-serif; }

          .section { margin-bottom: 28px; }
          .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #999; font-family: system-ui, sans-serif; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; }

          .summary { font-size: 14px; line-height: 1.7; color: #444; }

          .job { margin-bottom: 18px; }
          .job-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
          .job-title { font-size: 15px; font-weight: 700; }
          .job-company { font-size: 14px; color: #666; margin-bottom: 4px; }
          .job-dates { font-size: 12px; color: #999; font-family: system-ui, sans-serif; }
          .job-achievements { font-size: 13px; line-height: 1.65; color: #555; margin-top: 6px; }

          .skills { display: flex; flex-wrap: wrap; gap: 8px; }
          .skill { background: #f5f5f5; color: #444; font-size: 12px; padding: 4px 12px; border-radius: 999px; font-family: system-ui, sans-serif; }

          .quote { border-${isRTL ? 'right' : 'left'}: 3px solid #A78BFA; padding-${isRTL ? 'right' : 'left'}: 16px; margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #555; font-style: italic; }

          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #bbb; font-family: system-ui, sans-serif; text-align: center; }

          .translation-notice { background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; font-size: 12px; color: #92400e; font-family: system-ui, sans-serif; }

          @media print {
            .no-print { display: none !important; }
            .translation-notice { display: none !important; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .page { padding: 32px 40px; }
          }
        `}</style>
        {isRTL && (
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap"
            rel="stylesheet"
          />
        )}
      </head>
      <body>
        {/* Controls - hidden on print */}
        <div className="no-print">
          <button className="btn btn-secondary" onClick={() => window.history.back()}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Download PDF ↓
          </button>
        </div>

        <div className="page">

          {isNative && translated && (
            <div className="translation-notice">
              🌐 {translated.language} version — auto-translated by Shapi AI. Review before sending.
            </div>
          )}

          {/* Header */}
          <div className="header">
            <h1 className="name">{displayName}</h1>
            <p className="headline">{displayHeadline}</p>
            <div className="meta">
              {displayLocation && <span>📍 {displayLocation}</span>}
              {profile.whatsapp_number && <span>📱 {profile.whatsapp_number}</span>}
              {profile.ai_tier && (
                <span className="badge">AI {profile.ai_tier}</span>
              )}
              {isNative && translated && (
                <span className="lang-badge">🌐 {translated.language}</span>
              )}
            </div>
          </div>

          {/* Summary */}
          {displaySummary && (
            <div className="section">
              <div className="section-title">{labels.profile}</div>
              <p className="summary">{displaySummary}</p>
            </div>
          )}

          {/* In their own words (from WhatsApp) */}
          {displayChatAnswers.length > 0 && (
            <div className="section">
              <div className="section-title">{labels.inTheirOwnWords}</div>
              {displayChatAnswers.map((answer, i) => (
                <div key={i} className="quote">
                  &ldquo;{answer}&rdquo;
                </div>
              ))}
            </div>
          )}

          {/* Work history */}
          {displayWork.length > 0 && (
            <div className="section">
              <div className="section-title">{labels.experience}</div>
              {displayWork.map((job, i) => (
                <div key={i} className="job">
                  <div className="job-header">
                    <span className="job-title">{job.title || '—'}</span>
                    <span className="job-dates">{job.start}{job.end ? ` – ${job.end}` : ''}</span>
                  </div>
                  <div className="job-company">{job.company || '—'}</div>
                  {job.achievements && (
                    <div className="job-achievements">{job.achievements}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Skills */}
          {displaySkills.length > 0 && (
            <div className="section">
              <div className="section-title">{labels.skills}</div>
              <div className="skills">
                {displaySkills.map((skill, i) => (
                  <span key={i} className="skill">{skill}</span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            {labels.verifiedBy}
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          document.querySelector('.btn-primary').addEventListener('click', () => window.print());
          document.querySelector('.btn-secondary').addEventListener('click', () => window.history.back());
        `}} />
      </body>
    </html>
  )
}
