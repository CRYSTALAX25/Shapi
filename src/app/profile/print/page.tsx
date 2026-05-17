import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type WorkEntry = {
  title?: string
  company?: string
  start?: string
  end?: string
  achievements?: string
}

export default async function PrintCV() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const skills: string[] = Array.isArray(profile.skills) ? profile.skills : []
  const workHistory: WorkEntry[] = Array.isArray(profile.work_history) ? profile.work_history : []
  const chatAnswers = Array.isArray(profile.whatsapp_chat)
    ? (profile.whatsapp_chat as Array<{role: string; content: string}>).filter(m => m.role === 'user').slice(0, 3)
    : []

  return (
    <html lang="en">
      <head>
        <title>{profile.full_name || 'CV'} — Shapi</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Georgia', serif; color: #1a1a2e; background: white; }
          .page { max-width: 800px; margin: 0 auto; padding: 48px 56px; }

          .no-print { position: fixed; top: 20px; right: 20px; z-index: 100; display: flex; gap: 12px; }
          .btn { padding: 10px 20px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; font-family: system-ui, sans-serif; }
          .btn-primary { background: linear-gradient(135deg, #22D3EE, #A78BFA); color: #060609; }
          .btn-secondary { background: #f0f0f0; color: #333; }

          .header { border-bottom: 2px solid #1a1a2e; padding-bottom: 24px; margin-bottom: 28px; }
          .name { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
          .headline { font-size: 16px; color: #555; margin-bottom: 8px; }
          .meta { font-size: 13px; color: #888; display: flex; gap: 16px; flex-wrap: wrap; }
          .badge { display: inline-block; background: #f0f0f8; color: #6B21A8; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; font-family: system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; }

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

          .quote { border-left: 3px solid #A78BFA; padding-left: 16px; margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #555; font-style: italic; }

          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #bbb; font-family: system-ui, sans-serif; text-align: center; }

          @media print {
            .no-print { display: none !important; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .page { padding: 32px 40px; }
          }
        `}</style>
      </head>
      <body>
        {/* Print/Download controls - hidden on print */}
        <div className="no-print">
          <button className="btn btn-secondary" onClick={() => window.history.back()}>← Back</button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Download PDF ↓
          </button>
        </div>

        <div className="page">
          {/* Header */}
          <div className="header">
            <h1 className="name">{profile.full_name || 'Your Name'}</h1>
            <p className="headline">{profile.headline || ''}</p>
            <div className="meta">
              {profile.location && <span>📍 {profile.location}</span>}
              {profile.whatsapp_number && <span>📱 {profile.whatsapp_number}</span>}
              {profile.ai_tier && (
                <span className="badge">AI {profile.ai_tier}</span>
              )}
            </div>
          </div>

          {/* Summary */}
          {profile.summary && (
            <div className="section">
              <div className="section-title">Profile</div>
              <p className="summary">{profile.summary}</p>
            </div>
          )}

          {/* In their own words (from WhatsApp) */}
          {chatAnswers.length > 0 && (
            <div className="section">
              <div className="section-title">In their own words</div>
              {chatAnswers.map((m, i) => (
                <div key={i} className="quote">
                  &ldquo;{m.content}&rdquo;
                </div>
              ))}
            </div>
          )}

          {/* Work history */}
          {workHistory.length > 0 && (
            <div className="section">
              <div className="section-title">Experience</div>
              {workHistory.map((job, i) => (
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
          {skills.length > 0 && (
            <div className="section">
              <div className="section-title">Skills</div>
              <div className="skills">
                {skills.map((skill, i) => (
                  <span key={i} className="skill">{skill}</span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            Built with Shapi · shapi.io · Independently verified profile
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
