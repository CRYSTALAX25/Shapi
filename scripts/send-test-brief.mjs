// scripts/send-test-brief.mjs — emails the Shapi testing brief to the founder.
// Reads RESEND_API_KEY from .env.local. Run: node scripts/send-test-brief.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  env[m[1]] = v
}
const KEY = env.RESEND_API_KEY
if (!KEY) { console.error('Missing RESEND_API_KEY in .env.local'); process.exit(1) }

const TO = 'ana.vbarber@gmail.com'
const html = `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:680px;margin:0 auto;color:#1a1a1a;line-height:1.55">
  <h1 style="font-size:22px;margin:0 0 4px">Shapi — Testing Kit &amp; Brief</h1>
  <p style="color:#666;margin:0 0 20px">Everything you need to start testing both sides of the marketplace.</p>

  <div style="background:#ecfdf5;border:1px solid #34D399;border-radius:8px;padding:12px 16px;margin:0 0 20px">
    <b style="color:#065f46">✅ Status: seeded &amp; ready to test.</b>
    <p style="margin:6px 0 0;font-size:14px">The database is loaded — all 7 accounts live, company1 trust score live, roles + pipeline seeded. Just log in (below) and start.</p>
    <p style="margin:6px 0 0;font-size:13px;color:#666"><b>Note:</b> the seed is a <u>terminal</u> command — <code>node scripts/seed-personas.mjs</code> — NOT something you paste into the Supabase SQL editor. Only the <code>.sql</code> files go in SQL.</p>
  </div>

  <h2 style="font-size:16px;border-bottom:2px solid #38BDF8;padding-bottom:4px">Magic-link test URLs (no login)</h2>
  <p style="font-size:14px">Reference (referee answers QA): <a href="https://shapi.io/reference/45e44a03-9716-461b-887d-9ed994affee7">shapi.io/reference/45e44a03…</a><br>
  Role-share (hiring manager reviews a role): <a href="https://shapi.io/r/M_zgM8g2xZZNGRunWXOujny1hNau5En2">shapi.io/r/M_zgM8g2…</a></p>
  <p style="font-size:13px;color:#666">(These tokens regenerate every time you re-run the seed — grab fresh ones from the terminal output if you re-seed.)</p>

  <h2 style="font-size:16px;border-bottom:2px solid #38BDF8;padding-bottom:4px">1. Set up (≈5 min)</h2>
  <p><b>Run these SQL files in the Supabase SQL editor</b>, in order (all idempotent, additive, no data loss):</p>
  <ol style="margin:0 0 8px;padding-left:20px">
    <li><code>blueprint_v4_RUN_ALL.sql</code> — spine, Brain, HR-OS, skill density, P&amp;L, FeatureGate tiers</li>
    <li><code>RUN_PENDING_2026-06-11.sql</code></li>
    <li><code>RUN_PENDING_2026-06-11b.sql</code></li>
    <li><code>active_applications.sql</code> — Active product</li>
    <li><code>availability_slots.sql</code> — (re-run the corrected version)</li>
    <li><code>crosssell_outreach.sql</code> — <b>NEW</b>, the cross-sell loop</li>
  </ol>
  <p style="color:#666;font-size:13px">If <code>create extension vector/pgcrypto</code> errors: Supabase Studio → Database → Extensions → toggle <code>vector</code> + <code>pgcrypto</code> ON, re-run #1.</p>
  <p><b>Then seed the test data (in the TERMINAL, not SQL):</b> <code>node scripts/seed-personas.mjs</code> (auto-confirms all accounts, idempotent, re-runnable).</p>
  <p style="font-size:13px;color:#666"><b>Optional:</b> the 2 pre-loaded <code>/active</code> jobs may skip on first seed (a Postgres schema-cache lag). To load them, re-run <code>active_applications.sql</code> in SQL (it now force-adds the columns + reloads the cache), then re-run the seed. Not blocking — you can add a job manually in <code>/active</code> instead.</p>

  <h2 style="font-size:16px;border-bottom:2px solid #38BDF8;padding-bottom:4px">2. Test accounts (pre-loaded with data)</h2>
  <p>Shared password for ALL: <code style="background:#f4f4f4;padding:2px 6px">ShapiTest!2026</code> &nbsp;(all are <code>+</code>-aliases of your Gmail, so every one reaches you)</p>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <tr style="background:#f4f4f4"><th align="left" style="padding:6px">Email</th><th align="left">Side</th><th align="left">Persona</th></tr>
    <tr><td style="padding:6px"><code>+test1</code></td><td>Candidate</td><td>Amira — verified PM, 6 refs done, subscribed, 2 imported jobs</td></tr>
    <tr><td style="padding:6px"><code>+test2</code></td><td>Candidate</td><td>Imran — blue-collar pivot, multilingual, voice CV, 3/6 refs, free</td></tr>
    <tr><td style="padding:6px"><code>+company1</code></td><td>Company</td><td>Meridian Gulf (Enterprise) — full org, HR, PIP, <b>live trust score</b>, 2 roles</td></tr>
    <tr><td style="padding:6px"><code>+company2</code></td><td>Company</td><td>Cedar &amp; Co (Starter) — 2 roles, <b>locked</b> trust state</td></tr>
    <tr><td style="padding:6px"><code>+test4</code></td><td>Company member</td><td>Team member — tests restricted HR view</td></tr>
    <tr><td style="padding:6px"><code>+test5</code></td><td>Company HRBP</td><td>HRBP — sees comp/attendance/PIP</td></tr>
    <tr><td style="padding:6px"><code>+test6</code></td><td>Magic-link</td><td>Referee / hiring manager (tokens printed by the seed)</td></tr>
  </table>
  <p style="color:#666;font-size:13px">Also do <b>fresh signups</b> (your own email aliases, e.g. <code>ana.vbarber+new1@gmail.com</code>) to see the real empty-state first-run experience on both sides.</p>

  <h2 style="font-size:16px;border-bottom:2px solid #38BDF8;padding-bottom:4px">3. What to test</h2>
  <p><b>Candidate:</b> upload-cv / cv-builder → profile → cv-lab/cv-ready → references → /roles (click a company → /c/[id] trust page) → /active (import job → "Get Shapi to reach them") → /applications → free tools (worth, ai-proof, translate, work-style, course-wallet, evidence).</p>
  <p><b>Company:</b> onboarding → dashboard → profile + trust card → roles/new → /candidates → /candidates/[id] → pipeline → the intelligence suite (snapshot, spine, brain, people, skill-density, workforce-pl, strategic-plan, staffing, salary, roadmap, hiring-plan, org-design, cognitive-load, os).</p>
  <p><b>Cross-sell loop (Direction A):</b> runs in <b>TEST MODE</b> — teaser emails route to the candidate's own inbox (<code>[TEST]</code> subject), nothing reaches real managers until you set HUNTER_API_KEY + OUTREACH_FROM.</p>
  <p><b>Magic-link (no login):</b> /reference/[token], /r/[token], /culture/[token], /confirm-seat/[token] — tokens printed by the seed.</p>

  <h2 style="font-size:16px;border-bottom:2px solid #38BDF8;padding-bottom:4px">4. Known NOT-live yet — don't flag</h2>
  <ul style="margin:0;padding-left:20px">
    <li>Signup confirmation emails (Supabase SMTP flaky — seeded accounts are pre-confirmed; fresh signups can use the Resend button)</li>
    <li>Stripe in TEST mode (use test cards)</li>
    <li>WhatsApp / OTP signup (Twilio trial — email signup is the default)</li>
    <li>Cross-sell outreach send (TEST mode until Hunter key + outreach subdomain set)</li>
    <li>FeatureGate enforcement off (all tiers visible)</li>
    <li>Direction B of cross-sell (company → candidate) — post-launch</li>
  </ul>

  <h2 style="font-size:16px;border-bottom:2px solid #38BDF8;padding-bottom:4px">5. WhatsApp &amp; signup — quick answers</h2>
  <p><b>Do you need the Twilio WhatsApp sandbox?</b> No — not to test the app. Every page + the email signup work without it. Activate the Twilio sandbox only if you specifically want to test WhatsApp OTP signup or WhatsApp commands (each tester would text <code>join &lt;code&gt;</code> to the sandbox number). Production WhatsApp needs a real WABA number (post-incorporation).</p>
  <p><b>Do you need your own phone numbers to sign up from scratch?</b> No — email signup needs <b>only an email</b> (your <code>+</code>-aliases are perfect). A phone number is required only for the WhatsApp OTP path, which is off by default.</p>

  <h2 style="font-size:16px;border-bottom:2px solid #38BDF8;padding-bottom:4px">6. Logging issues</h2>
  <p>Use <code>TEST_PUNCHLIST.md</code> in the repo — every page listed with a Notes line. Jot the change per page, hand the batch over to get fixed. Full detail lives in <code>TEST_GUIDE.md</code>; the cross-sell spec is <code>SPEC_ACTIVE_CROSSSELL.md</code>.</p>

  <p style="color:#999;font-size:12px;margin-top:24px">Sent from Shapi · generated for testing.</p>
</div>`

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: 'Shapi <hello@shapi.io>', to: [TO], subject: 'Shapi — Testing Kit & Brief', html }),
})
const body = await res.json()
if (!res.ok) { console.error('Resend error:', res.status, JSON.stringify(body)); process.exit(1) }
console.log('Sent ✓ to', TO, '· id:', body.id)
