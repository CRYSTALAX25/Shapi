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
                   background:linear-gradient(135deg,#A78BFA,#22D3EE);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</span>
    </div>

    <!-- Card -->
    <div style="background:#0d0d14;border:1px solid rgba(34,211,238,0.15);border-radius:16px;padding:32px">
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
    background:linear-gradient(135deg,#22D3EE,#A78BFA);color:#060609;font-size:14px;
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
    <div style="background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.12);border-radius:10px;padding:14px 18px;margin:20px 0">
      <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px">Your profile link</p>
      <a href="${profileUrl}" style="color:#22D3EE;font-size:14px;font-weight:700;text-decoration:none;word-break:break-all">${profileUrl}</a>
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

export async function sendCvKitEmail(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'there'
  const dashboardUrl = `${SITE}/cv-ready`

  const html = emailShell(`
    ${h1(`Your CV Kit is ready, ${firstName}.`)}
    ${p(`Your AI-written CV (English + native language) is waiting in your dashboard. Claude used your full profile, work history, and WhatsApp conversation to write it — it's specific to you, not a template.`)}
    ${btn('Download your CV →', dashboardUrl)}
    ${divider()}
    ${p(`<strong style="color:rgba(255,255,255,0.7)">What's included:</strong><br>
      · English CV — industry-optimised, ATS-friendly<br>
      · Native language CV — same content, translated precisely<br>
      · Both are print-ready PDFs`)}
    ${p(`You can download as many times as you like — the link never expires.`)}
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
    <div style="background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="color:rgba(167,139,250,0.8);font-size:13px;font-weight:700;margin:0">${candidateFirst} doesn&apos;t know we&apos;ve reached out — you can be completely candid.</p>
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
    ${p(`A verified candidate just completed their profile and scored <strong style="color:#22D3EE">${matchScore}%</strong> against your <strong style="color:rgba(255,255,255,0.8)">${roleName}</strong> role — that puts them in the <em>${label} match</em> category.`)}
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
