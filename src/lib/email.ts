import { Resend } from 'resend'

const FROM = 'Shapi <hello@shapi.io>'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')
  return new Resend(process.env.RESEND_API_KEY)
}

// ── Shared header / footer ─────────────────────────────────────────────────

function emailShell(body: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060609;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <!-- Logo -->
    <div style="margin-bottom:32px">
      <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;
                   background:linear-gradient(135deg, #9D8CFF, #34D399);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</span>
    </div>

    <!-- Card -->
    <div style="background:#0D0C14;border:1px solid rgba(157, 140, 255, 0.15);border-radius:16px;padding:32px">
      ${body}
    </div>

    <!-- Footer -->
    <p style="color:rgba(255,255,255,0.2);font-size:12px;margin-top:24px;text-align:center">
      Shapi · Verified professional profiles · <a href="${SITE}" style="color:rgba(255,255,255,0.3);text-decoration:none">shapi.io</a>
    </p>
  </div>
</body>
</html>`
}

function h1(text: string) {
  return `<h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 12px">${text}</h1>`
}
function p(text: string) {
  return `<p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 16px">${text}</p>`
}
function btn(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;padding:14px 28px;
    background:linear-gradient(135deg,#9D8CFF, #34D399);color:#060609;font-size:14px;
    font-weight:900;border-radius:100px;text-decoration:none">${label}</a>`
}
function divider() {
  return `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0">`
}

// ── 1. Candidate profile is live ───────────────────────────────────────────

export async function sendProfileLiveEmail(to: string, name: string, profileId: string) {
  const firstName = name?.split(' ')[0] || 'there'
  const profileUrl = `${SITE}/p/${profileId.slice(0, 8)}`

  const html = emailShell(`
    ${h1(`${firstName}, your profile is live. 🎉`)}
    ${p(`Your Shapi profile has been verified and is now visible to hiring companies. You're ahead of 95% of candidates — most never complete verification.`)}
    ${p(`Share your profile link with anyone. Companies on Shapi can already see you.`)}
    <div style="background:rgba(157, 140, 255, 0.06);border:1px solid rgba(157, 140, 255, 0.12);border-radius:10px;padding:14px 18px;margin:20px 0">
      <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px">Your profile link</p>
      <a href="${profileUrl}" style="color:#9D8CFF;font-size:14px;font-weight:700;text-decoration:none;word-break:break-all">${profileUrl}</a>
    </div>
    ${btn('View your profile →', profileUrl)}
    ${divider()}
    ${p(`<strong style="color:rgba(255,255,255,0.7)">What's next?</strong><br>
      · Download your AI-written CV from your dashboard<br>
      · Add references to strengthen your verification score<br>
      · Keep your WhatsApp number active — companies may reach out directly`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${firstName}, your Shapi profile is live ✓`,
    html,
  })
}

// ── 2. CV Kit purchased ────────────────────────────────────────────────────

export async function sendCvKitEmail(to: string, name: string, tier: 'kit' | 'pro' = 'kit') {
  const firstName = name?.split(' ')[0] || 'there'
  const dashboardUrl = `${SITE}/cv-ready`

  if (tier === 'pro') {
    const html = emailShell(`
      ${h1(`Welcome to CV Pro, ${firstName}.`)}
      ${p(`You've unlocked the full Shapi toolkit. Here's everything Pro gives you on top of the Kit — and where to find it.`)}
      ${btn('Open your CV Pro dashboard →', dashboardUrl)}
      ${divider()}
      ${p(`<strong style="color:rgba(255,255,255,0.75)">Everything in CV Kit ($25):</strong><br>
        · AI-written CV in English + every language you speak<br>
        · Industry-targeted versions, re-framed per sector<br>
        · Print-ready PDFs, download anytime, link never expires`)}
      ${p(`<strong style="color:#9D8CFF">Plus what Pro ($59) adds:</strong><br>
        · <strong style="color:rgba(255,255,255,0.7)">WhatsApp deep-dive interviews</strong> — per-industry conversations that pull out the achievements your CV missed, then rewrite each version with them<br>
        · <strong style="color:rgba(255,255,255,0.7)">Verification chain</strong> — we independently contact your past managers, plus colleagues + stakeholders they nominate (you don't pick what they say)<br>
        · <strong style="color:rgba(255,255,255,0.7)">AI cross-check report</strong> — Claude analyses every reference against your CV claims and flags what's independently confirmed<br>
        · <strong style="color:rgba(255,255,255,0.7)">Verification tier badge</strong> — Basic → Strong → Premium, shown to companies<br>
        · <strong style="color:rgba(255,255,255,0.7)">Career Roadmap</strong> — AI-resilience score, skills gaps, and pivot paths for your field`)}
      ${divider()}
      ${p(`<strong style="color:rgba(255,255,255,0.7)">Start here:</strong> open your dashboard and look for the deep-dive interview prompts per industry — that's where Pro does its best work. Then add your references to start the verification chain.`)}
    `)
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Welcome to Shapi CV Pro — here's what you unlocked`,
      html,
    })
    return
  }

  const html = emailShell(`
    ${h1(`Your CV Kit is ready, ${firstName}.`)}
    ${p(`Your AI-written CVs are waiting in your dashboard. Claude used your full profile, work history, and WhatsApp conversation to write them — specific to you, not a template.`)}
    ${btn('Download your CV →', dashboardUrl)}
    ${divider()}
    ${p(`<strong style="color:rgba(255,255,255,0.7)">What's included in your Kit:</strong><br>
      · English CV — industry-optimised, ATS-friendly<br>
      · A version in every language you speak — translated precisely<br>
      · Industry-targeted versions, re-framed per sector<br>
      · All print-ready PDFs`)}
    ${p(`You can download as many times as you like — the link never expires.`)}
    ${divider()}
    ${p(`<span style="font-size:13px;color:rgba(255,255,255,0.4)"><strong style="color:#9D8CFF">Want more?</strong> Upgrade to <strong style="color:rgba(255,255,255,0.7)">CV Pro ($59)</strong> for WhatsApp deep-dive interviews, an independent verification chain (we contact your references directly), an AI cross-check report, and a Career Roadmap. Find the upgrade on your dashboard.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Your Shapi CV is ready to download`,
    html,
  })
}

// ── 3. Reference request → manager ────────────────────────────────────────

export async function sendManagerReferenceEmail(opts: {
  to: string
  refereeName: string
  candidateName: string
  candidateJobTitle: string
  candidateCompany: string
  candidateDates: string
  referenceUrl: string
}) {
  const { to, refereeName, candidateName, candidateJobTitle, candidateCompany, candidateDates, referenceUrl } = opts
  const candidateFirst = candidateName.split(' ')[0]
  const refereeFirst = refereeName.split(' ')[0]

  const html = emailShell(`
    ${h1(`${candidateFirst} has listed you as a reference.`)}
    ${p(`Hi ${refereeFirst} — ${candidateName} is building a verified profile on Shapi and listed you as their manager during their time at <strong style="color:rgba(255,255,255,0.75)">${candidateCompany}</strong> (${candidateDates}).`)}
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="color:rgba(255,255,255,0.3);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px">Their role</p>
      <p style="color:rgba(255,255,255,0.75);font-size:14px;font-weight:700;margin:0">${candidateJobTitle} · ${candidateCompany}</p>
    </div>
    ${p(`Takes about 5 minutes. Your honest answers appear verbatim on their profile — ${candidateFirst} cannot edit them.`)}
    ${p(`At the end, we&apos;ll ask you to nominate a colleague and a stakeholder who worked with ${candidateFirst}. We&apos;ll reach out to them independently — ${candidateFirst} won&apos;t know who you&apos;ve named.`)}
    ${btn(`Give a reference →`, referenceUrl)}
    ${divider()}
    ${p(`<span style="font-size:13px;color:rgba(255,255,255,0.3)">If you&apos;d prefer not to provide a reference, simply ignore this email. The link expires after 30 days.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${candidateName} has listed you as a reference on Shapi`,
    html,
  })
}

// ── 4. Reference request → nominated colleague / stakeholder ───────────────

export async function sendNominatedReferenceEmail(opts: {
  to: string
  refereeName: string
  candidateName: string
  nominatorName: string
  nominatorCompany: string
  nomineeRole: 'colleague' | 'stakeholder'
  referenceUrl: string
}) {
  const { to, refereeName, candidateName, nominatorName, nominatorCompany, nomineeRole, referenceUrl } = opts
  const candidateFirst = candidateName.split(' ')[0]
  const refereeFirst = refereeName.split(' ')[0]
  const roleLabel = nomineeRole === 'colleague' ? 'a colleague' : 'a stakeholder'

  const html = emailShell(`
    ${h1(`A quick word about ${candidateName}.`)}
    ${p(`Hi ${refereeFirst} — <strong style="color:rgba(255,255,255,0.75)">${nominatorName}</strong> at ${nominatorCompany} suggested you worked with ${candidateFirst} and might be able to share a perspective.`)}
    ${p(`${candidateFirst} is on Shapi — a verified hiring platform. ${nominatorName} nominated you as ${roleLabel} who knows their work well.`)}
    <div style="background:rgba(157, 140, 255, 0.08);border:1px solid rgba(157, 140, 255, 0.2);border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="color:rgba(157, 140, 255, 0.8);font-size:13px;font-weight:700;margin:0">${candidateFirst} doesn&apos;t know we&apos;ve reached out — you can be completely candid.</p>
    </div>
    ${p(`3 short questions. Takes 2 minutes.`)}
    ${btn(`Share your perspective →`, referenceUrl)}
    ${divider()}
    ${p(`<span style="font-size:13px;color:rgba(255,255,255,0.3)">No obligation — if you&apos;d prefer not to respond, simply ignore this. The link expires after 30 days.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `A quick word about ${candidateName} — takes 2 minutes`,
    html,
  })
}

// ── 5. Candidate: references verified ─────────────────────────────────────

export async function sendReferencesVerifiedEmail(to: string, name: string, count: number) {
  const firstName = name?.split(' ')[0] || 'there'
  const profileUrl = `${SITE}/profile`

  const html = emailShell(`
    ${h1(`${firstName}, your references are verified. ✅`)}
    ${p(`<strong style="color:rgba(255,255,255,0.75)">${count} reference${count !== 1 ? 's' : ''}</strong> have been submitted to your Shapi profile. They appear exactly as written — you haven&apos;t seen them and can&apos;t edit them, which is what makes them credible.`)}
    ${p(`Companies viewing your profile can now see your verification score and the number of independent references backing you up.`)}
    ${btn(`View your profile →`, profileUrl)}
    ${divider()}
    ${p(`<span style="font-size:13px;color:rgba(255,255,255,0.3)">The names of your nominated references (colleague and stakeholder) remain confidential — only the count and summary appear publicly.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${count} reference${count !== 1 ? 's' : ''} verified on your Shapi profile`,
    html,
  })
}

// ── 6. Company: new candidate matched to their role ─────────────────────────

export async function sendCompanyMatchEmail(
  to: string,
  companyName: string,
  roleName: string,
  matchScore: number,
  candidateCount: number,
) {
  const label = matchScore >= 75 ? 'strong' : matchScore >= 50 ? 'good' : 'possible'
  const dashboardUrl = `${SITE}/company/dashboard`

  const html = emailShell(`
    ${h1(`New ${label} match for ${roleName}`)}
    ${p(`A verified candidate just completed their profile and scored <strong style="color:#9D8CFF">${matchScore}%</strong> against your <strong style="color:rgba(255,255,255,0.8)">${roleName}</strong> role — that puts them in the <em>${label} match</em> category.`)}
    ${p(`${candidateCount > 1 ? `There are now ${candidateCount} scored candidates for this role.` : `They're the first scored candidate for this role.`} View their profile and start a conversation directly from your dashboard.`)}
    ${btn('View matches →', dashboardUrl)}
    ${divider()}
    ${p(`<strong style="color:rgba(255,255,255,0.5);font-size:13px">Why ${matchScore}%?</strong><br>
      <span style="font-size:13px">Match score is based on skills alignment, location, industry, and profile completeness. Scores above 50% are worth a conversation.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `New ${label} match for your ${roleName} role — ${matchScore}% fit`,
    html,
  })
}

// ── Welcome nurture sequence (3 parts) ─────────────────────────────────────
// Sent over the first ~5 days after signup by /api/cron/nurture.
// Warm, AI-era, encouraging — signed "— Shapi".

function signoff() {
  return `${divider()}
    <p style="color:rgba(255,255,255,0.45);font-size:14px;line-height:1.6;margin:0">
      We&apos;re in your corner.<br>
      <strong style="color:rgba(255,255,255,0.7)">— Shapi</strong>
    </p>`
}

// Part 1 — sent immediately on signup
export async function sendWelcomeEmail({ to, name }: { to: string; name: string }) {
  const firstName = name?.split(' ')[0] || 'there'

  const html = emailShell(`
    ${h1(`Welcome to Shapi, ${firstName}. 🌟`)}
    ${p(`You just took the smartest first step in an AI-shaped job market: getting ahead of it. The world of work is changing fast — but with the right map, change is opportunity, not threat.`)}
    ${p(`Here&apos;s where to start. In 2 minutes, find out how exposed your current role is to automation — and exactly what to do about it.`)}
    ${btn('Check your AI risk →', `${SITE}/ai-proof`)}
    ${divider()}
    ${p(`Already explored? Your dashboard is home base — everything you build with us lives there.`)}
    <a href="${SITE}/dashboard" style="color:#9D8CFF;font-size:14px;font-weight:700;text-decoration:none">Go to your dashboard →</a>
    ${signoff()}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Welcome to Shapi — let's shape your future career 🌟`,
    html,
  })
}

// Part 2 — sent ~2 days after signup
export async function sendPivotMapEmail({ to, name }: { to: string; name: string }) {
  const firstName = name?.split(' ')[0] || 'there'

  const html = emailShell(`
    ${h1(`${firstName}, your career pivot map is ready. 🗺️`)}
    ${p(`Your skills are worth more than the job title they&apos;re currently attached to. The hard part is seeing where else they fit — so we built a tool that does exactly that.`)}
    ${p(`Our Career Translator takes what you already know how to do and maps it onto roles you might never have considered — including the ones AI is creating, not replacing.`)}
    ${btn('Open your Career Translator →', `${SITE}/translate`)}
    ${divider()}
    ${p(`No two maps look the same. Yours is built around your experience — give it a try and see where your skills could take you next.`)}
    ${signoff()}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Your custom career pivot map is ready 🗺️`,
    html,
  })
}

// Part 3 — sent ~5 days after signup
export async function sendSocialProofEmail({ to, name }: { to: string; name: string }) {
  const firstName = name?.split(' ')[0] || 'there'

  const html = emailShell(`
    ${h1(`From factory floor to automation tech 🛠️→🤖`)}
    ${p(`Hi ${firstName} — a quick story. People are already making the leap you&apos;re considering. The line worker who became the person maintaining the robots. The cashier who moved into systems support. The warehouse picker now running automated fulfilment.`)}
    ${p(`What they had in common wasn&apos;t a degree or a lucky break — it was starting from skills they already had, and pointing them at where the work is going.`)}
    ${p(`We&apos;ve mapped the roles that are growing in your field. See which ones your experience already lines up with.`)}
    ${btn('Explore roles built for the future →', `${SITE}/roles`)}
    ${signoff()}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `From factory floor to automation tech 🛠️→🤖`,
    html,
  })
}

// ── 8. Concierge outreach → hiring company ─────────────────────────────────
// The AI Concierge fires an approved, candidate-authored intro to the company
// behind a matched role. The body is plain text (newlines) drafted by Claude;
// we wrap it in the branded shell and set reply-to so the company can answer
// the candidate directly. `replyTo` is optional — omit if unknown.

export async function sendConciergeOutreach(opts: {
  to: string
  subject: string
  body: string
  candidateName: string
  replyTo?: string
}) {
  const { to, subject, body, candidateName, replyTo } = opts
  const safeBody = String(body || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\r|\n/g, '<br>')
  const who = candidateName?.trim() || 'A verified candidate'

  const html = emailShell(`
    ${h1(`${who} would like to connect`)}
    <div style="background:rgba(157, 140, 255, 0.06);border:1px solid rgba(157, 140, 255, 0.18);border-radius:10px;padding:14px 18px;margin:0 0 20px">
      <p style="color:rgba(157, 140, 255, 0.85);font-size:12px;font-weight:700;margin:0">Reached out via Shapi — profile independently verified</p>
    </div>
    <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 16px">${safeBody}</p>
    ${divider()}
    ${p(`<span style="font-size:13px;color:rgba(255,255,255,0.3)">${who} sent this through Shapi, where every profile is verified before it can reach you. Reply to this email to respond directly.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: subject || `${who} would like to connect`,
    html,
    ...(replyTo ? { replyTo } : {}),
  })
}

// ── 9. Candidate: new Concierge outreach drafts to review ───────────────────
// Fired by the Concierge scan when ≥1 new 'pending_approval' draft is created
// for a candidate. Nudges them to review & approve in their dashboard.

export async function sendConciergeNudge(opts: {
  to: string
  name: string
  count: number
}) {
  const { to, name, count } = opts
  const firstName = name?.split(' ')[0] || 'there'
  const dashboardUrl = `${SITE}/dashboard`
  const roleWord = count === 1 ? 'role' : 'roles'

  const html = emailShell(`
    ${h1(`${firstName}, ${count} new ${roleWord} worth a look.`)}
    ${p(`Your Shapi Concierge scanned today&apos;s openings and drafted personalised intros for <strong style="color:#9D8CFF">${count} ${roleWord}</strong> that fit your profile. Each one&apos;s ready — review and approve before it goes out.`)}
    ${p(`You&apos;ve got ${count} new ${roleWord} worth a look — review &amp; approve in your Shapi dashboard.`)}
    ${btn('Review your drafts →', dashboardUrl)}
    ${divider()}
    ${p(`<span style="font-size:13px;color:rgba(255,255,255,0.3)">Nothing is sent until you approve it. You can edit, approve, or skip each draft.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${count} new ${roleWord} worth a look on Shapi`,
    html,
  })
}

// ── 10. Candidate: a hiring manager replied to Concierge outreach ───────────
// Fired when a manager replies to an AI-Concierge intro. Nudges the candidate
// to get booked and forwards the reply text if we captured it. By the time this
// sends, we've already auto-proposed an interview in the pipeline.

export async function sendConciergeReplyAlert(opts: {
  to: string
  name: string
  roleName: string
  companyName: string
  replyText?: string
}) {
  const { to, name, roleName, companyName, replyText } = opts
  const firstName = name?.split(' ')[0] || 'there'
  const dashboardUrl = `${SITE}/dashboard`
  const safeReply = replyText
    ? String(replyText)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r\n|\r|\n/g, '<br>')
        .slice(0, 1200)
    : ''

  const html = emailShell(`
    ${h1(`${firstName}, a hiring manager replied. 🎉`)}
    ${p(`Good news — the team at <strong style="color:rgba(255,255,255,0.8)">${companyName}</strong> just replied about the <strong style="color:rgba(255,255,255,0.8)">${roleName}</strong> role your Concierge reached out about.`)}
    ${safeReply ? `
    <div style="background:rgba(157, 140, 255, 0.06);border:1px solid rgba(157, 140, 255, 0.18);border-radius:10px;padding:14px 18px;margin:0 0 20px">
      <p style="color:rgba(157, 140, 255, 0.85);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin:0 0 8px">What they said</p>
      <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0">${safeReply}</p>
    </div>` : ''}
    ${p(`We&apos;ve already proposed an interview in your Shapi pipeline. Let&apos;s get you booked — open your dashboard to confirm a time.`)}
    ${btn(`Let&apos;s get you booked →`, dashboardUrl)}
    ${divider()}
    ${p(`<span style="font-size:13px;color:rgba(255,255,255,0.3)">Reply fast while you&apos;re top of mind. Most interviews are booked within a day of the manager replying.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `A hiring manager replied about ${roleName} — let's get you booked`,
    html,
  })
}

// ── 11. Company: candidate is ready to book an interview ────────────────────
// Fired when a candidate's Concierge outreach gets a reply (manual or inbound).
// Tells the company the candidate is ready and links the pipeline.

export async function sendConciergeReadyToBookEmail(opts: {
  to: string
  companyName: string
  candidateName: string
  roleName: string
}) {
  const { to, candidateName, roleName } = opts
  const who = candidateName?.trim() || 'A verified candidate'
  const pipelineUrl = `${SITE}/company/pipeline`

  const html = emailShell(`
    ${h1(`${who} is ready to book — ${roleName}`)}
    ${p(`Following up on the reply to ${who}&apos;s Shapi outreach for your <strong style="color:rgba(255,255,255,0.8)">${roleName}</strong> role — they&apos;re ready to schedule an interview.`)}
    ${p(`We&apos;ve added them to your pipeline with a proposed interview. Pick a time and send the invite straight from there.`)}
    ${btn('Open your pipeline →', pipelineUrl)}
    ${divider()}
    ${p(`<span style="font-size:13px;color:rgba(255,255,255,0.3)">Every Shapi candidate is independently verified before they can reach you — references, work history, and skills are checked.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${who} is ready to interview for ${roleName}`,
    html,
  })
}

// ── 7. Candidate: CV links sent to their own email ──────────────────────────

// ── Company Pro welcome ────────────────────────────────────────────────────
// Triggered by the Stripe webhook on checkout.session.completed for a
// company subscription. Stripe itself sends the receipt + invoice; this
// email is the brand welcome ("you're in, here's the loop"). Sender:
// hello@shapi.io. Subject: "Welcome to Shapi Pro." (no exclamation marks
// in subject lines — Ana's preference for direct copy.)
export async function sendCompanyWelcomeEmail(opts: {
  to: string
  companyName: string
  tier?: string
}) {
  const { to, companyName, tier = 'pro' } = opts
  const tierLabel = tier === 'pro' ? 'Pro' : tier.charAt(0).toUpperCase() + tier.slice(1)
  const html = emailShell(`
    ${h1(`Welcome to Shapi ${tierLabel}, ${companyName}.`)}
    ${p(`Your 14-day trial just started. Cancel anytime — no charge until day 15.`)}
    ${divider()}
    ${p('<strong>The Shapi loop</strong> — fill your org spine once, every workforce tool reads from it. Three things to do in the first hour:')}
    <ol style="color:rgba(255,255,255,0.85);font-size:14px;line-height:1.7;padding-left:22px;margin:12px 0 18px">
      <li><strong>Build your org spine</strong> — locations, teams, seats. CSV import or manual.</li>
      <li><strong>Run a Workforce Snapshot</strong> — 60-second AI readiness score that anchors everything else.</li>
      <li><strong>Post your first role</strong> — JD generated from a 6-question intake.</li>
    </ol>
    ${btn('Build my org spine →', `${SITE}/company/spine`)}
    ${divider()}
    ${p(`Receipt + invoice come from Stripe directly. Manage billing or cancel from your <a href="${SITE}/api/stripe/portal" style="color:#9D8CFF">customer portal</a>.`)}
    ${p('Need help importing data, or a setup call? Reply to this email — we read every one.')}
  `)
  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Welcome to Shapi ${tierLabel}`,
    html,
  })
}

// ── 12. HR Lifecycle: PIP / Separation communication to the employee ───────
// Fired from the lifecycle playbook "Send via Shapi" action. The body is the
// MANAGER-EDITED plain-text draft (newlines) seeded from a static, vetted
// parameterized template — NEVER AI-drafted legal wording. We wrap it in the
// branded shell and set reply-to so the employee can respond to the manager.
export async function sendLifecycleCommsEmail(opts: {
  to: string
  subject: string
  body: string
  programLabel: string
  replyTo?: string
}) {
  const { to, subject, body, programLabel, replyTo } = opts
  const safeBody = String(body || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\r|\n/g, '<br>')

  const html = emailShell(`
    <div style="background:rgba(157, 140, 255, 0.06);border:1px solid rgba(157, 140, 255, 0.18);border-radius:10px;padding:14px 18px;margin:0 0 20px">
      <p style="color:rgba(157, 140, 255, 0.85);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin:0">${programLabel}</p>
    </div>
    <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 16px">${safeBody}</p>
    ${divider()}
    ${p(`<span style="font-size:13px;color:rgba(255,255,255,0.3)">Sent through Shapi by your employer. Please reply to this email if you have any questions.</span>`)}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: subject || programLabel,
    html,
    ...(replyTo ? { replyTo } : {}),
  })
}

export async function sendCVLinksEmail(opts: {
  to: string
  name: string
  showNative: boolean
  nativeLabel: string
}) {
  const { to, name, showNative, nativeLabel } = opts
  const firstName = name?.split(' ')[0] || 'there'
  const englishUrl = `${SITE}/profile/print`
  const nativeUrl = `${SITE}/profile/print?lang=native`

  const html = emailShell(`
    ${h1(`Your CV is ready, ${firstName}.`)}
    ${p('Click the link below to open your CV — then use your browser\'s print function (Ctrl+P / Cmd+P) and select "Save as PDF" to download it.')}
    ${divider()}
    <div style="margin-bottom:16px">
      <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin:0 0 8px">🇬🇧 English CV</p>
      ${btn('Open English CV →', englishUrl)}
    </div>
    ${showNative ? `
    <div style="margin-top:20px">
      <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin:0 0 8px">🌐 ${nativeLabel} CV</p>
      ${btn('Open ' + nativeLabel + ' CV →', nativeUrl)}
    </div>` : ''}
    ${divider()}
    ${p('Both CVs are enriched with your WhatsApp conversation and optimised for your industry. Review before sending — especially the ' + (showNative ? nativeLabel + ' version.' : 'content.'))}
  `)

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Your Shapi CV is ready to download`,
    html,
  })
}
