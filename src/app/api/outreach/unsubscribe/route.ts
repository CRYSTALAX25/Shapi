// One-click outreach opt-out (SPEC_ACTIVE_CROSSSELL §5 footer / §3).
//
// GET ?token=<unlock_token> — looks up the crosssell_outreach row by its
// unlock_token; if found and it has a hiring-manager email, adds that email to
// the global outreach_suppression list and flips the outreach to 'declined'.
//
// Always returns a 200 HTML page and never reveals whether the token was valid
// (no enumeration of who is/isn't in our pipeline). All access is via the admin
// client — the table is service-role-only.

import { createAdminClient } from '@/lib/supabase/admin'
import { addSuppression } from '@/lib/crosssell'

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Unsubscribed · Shapi</title>
<style>
  body { margin:0; background:#060609; color:rgba(255,255,255,0.9);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; }
  .card { max-width:420px; text-align:center; }
  h1 { font-size:20px; font-weight:800; margin:0 0 12px;
    background:linear-gradient(135deg,#22D3EE,#A78BFA); -webkit-background-clip:text;
    background-clip:text; -webkit-text-fill-color:transparent; }
  p { font-size:14px; line-height:1.6; color:rgba(255,255,255,0.6); margin:0; }
</style>
</head>
<body>
  <div class="card">
    <h1>You&rsquo;ve been unsubscribed</h1>
    <p>You won&rsquo;t be contacted again. Thanks for letting us know.</p>
  </div>
</body>
</html>`

function htmlResponse() {
  return new Response(PAGE, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')

  // Always return the same page — do this work best-effort and swallow errors.
  if (token) {
    try {
      const admin = createAdminClient()
      const { data: row } = await admin
        .from('crosssell_outreach')
        .select('id, hm_email')
        .eq('unlock_token', token)
        .maybeSingle()

      if (row?.hm_email) {
        await addSuppression(admin, {
          value: row.hm_email as string,
          scope: 'email',
          reason: 'unsubscribe',
        })
        await admin
          .from('crosssell_outreach')
          .update({ status: 'declined', updated_at: new Date().toISOString() })
          .eq('id', row.id)
      }
    } catch (err) {
      console.error('[outreach/unsubscribe] failed:', err)
    }
  }

  return htmlResponse()
}
