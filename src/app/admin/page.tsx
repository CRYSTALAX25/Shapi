import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ADMIN_EMAIL = 'ana.vbarber@gmail.com'

type Profile = {
  id: string
  full_name: string | null
  type: string
  email?: string
  completion_pct: number
  cv_parsed: boolean
  profile_live: boolean
  cv_kit_purchased: boolean
  paid: boolean
  whatsapp_number: string | null
  industry: string | null
  ai_tier: string | null
  company_name: string | null
  created_at: string
  whatsapp_chat: unknown[]
}

export default async function AdminPanel() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.email !== ADMIN_EMAIL) redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch all profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, type, completion_pct, cv_parsed, profile_live, cv_kit_purchased, paid, whatsapp_number, industry, ai_tier, company_name, created_at, whatsapp_chat')
    .order('created_at', { ascending: false })

  // Fetch auth users for emails
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 200 })
  const emailMap: Record<string, string> = {}
  for (const u of authData?.users || []) {
    emailMap[u.id] = u.email || ''
  }

  const all: Profile[] = (profiles || []).map(p => ({
    ...p,
    email: emailMap[p.id] || '',
    whatsapp_chat: Array.isArray(p.whatsapp_chat) ? p.whatsapp_chat : [],
  }))

  const candidates = all.filter(p => p.type === 'candidate')
  const companies = all.filter(p => p.type === 'company')

  const verified = candidates.filter(c => c.profile_live)
  const withWhatsApp = candidates.filter(c => c.whatsapp_number && Array.isArray(c.whatsapp_chat) && (c.whatsapp_chat as unknown[]).length > 0)
  const cvKitPurchased = candidates.filter(c => c.cv_kit_purchased)
  const paidCompanies = companies.filter(c => c.paid)

  // Verification queue — has CV, has WhatsApp convo, not yet live
  const queue = candidates.filter(c =>
    c.cv_parsed &&
    Array.isArray(c.whatsapp_chat) && (c.whatsapp_chat as unknown[]).length > 2 &&
    !c.profile_live &&
    c.completion_pct >= 50
  )

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.12), rgba(139,92,246,0.12)) border-box;
          border: 1px solid transparent;
        }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.25); padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        td { padding: 10px 12px; font-size: 13px; color: rgba(255,255,255,0.7); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
        .dot-green { background: #34D399; }
        .dot-yellow { background: #FCD34D; }
        .dot-red { background: rgba(255,255,255,0.15); }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-black text-xl tracking-tighter" style={{
              background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>shapi</Link>
            <span className="text-white/20 text-xs font-bold uppercase tracking-wider px-2 py-1 bg-[#FB7185]/10 text-[#FB7185] rounded-full">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-white/30 text-sm hover:text-white/60">Dashboard</Link>
            <form action="/api/auth/signout" method="post">
              <button className="text-white/30 text-sm hover:text-white/60">Sign out</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-8 pb-20">

        <div className="mb-8">
          <h1 className="text-2xl font-black text-white mb-1">Admin Panel</h1>
          <p className="text-white/30 text-sm">All users · verification queue · revenue signals</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total candidates', value: candidates.length, colour: '#22D3EE' },
            { label: 'Verified / live', value: `${verified.length} / ${candidates.length}`, colour: '#34D399' },
            { label: 'With WhatsApp', value: withWhatsApp.length, colour: '#A78BFA' },
            { label: 'CV Kits sold', value: cvKitPurchased.length, colour: '#FB7185' },
            { label: 'Companies', value: companies.length, colour: '#22D3EE' },
            { label: 'Paid companies', value: paidCompanies.length, colour: '#34D399' },
            { label: 'Total users', value: all.length, colour: '#A78BFA' },
            { label: 'Est. MRR', value: `$${paidCompanies.length * 299}`, colour: '#FCD34D' },
          ].map((s, i) => (
            <div key={i} className="gradient-border-card rounded-xl p-4">
              <div className="text-2xl font-black mb-1" style={{ color: s.colour }}>{s.value}</div>
              <div className="text-white/30 text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Verification queue */}
        {queue.length > 0 && (
          <div className="gradient-border-card rounded-2xl mb-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="text-white font-bold">Verification queue</p>
                <p className="text-white/35 text-xs">Ready to go live — CV parsed + WhatsApp done, waiting for approval</p>
              </div>
              <span className="bg-[#FB7185]/15 text-[#FB7185] text-xs font-bold px-3 py-1 rounded-full">{queue.length} pending</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Industry</th>
                  <th>Completion</th>
                  <th>Chat msgs</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(c => (
                  <tr key={c.id}>
                    <td className="text-white font-semibold">{c.full_name || '—'}</td>
                    <td className="text-white/50">{c.email}</td>
                    <td>{c.industry || '—'}</td>
                    <td>
                      <span style={{ color: '#22D3EE', fontWeight: 700 }}>{c.completion_pct}%</span>
                    </td>
                    <td>{(c.whatsapp_chat as unknown[]).length}</td>
                    <td>
                      <div className="flex gap-2">
                        <Link href={`/p/${c.id.slice(0, 8)}`} target="_blank"
                          className="text-xs text-[#22D3EE] hover:opacity-80">View →</Link>
                        <form action={`/api/admin/verify`} method="post" style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit"
                            className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full hover:bg-emerald-500/30">
                            ✓ Go live
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* All candidates */}
        <div className="gradient-border-card rounded-2xl mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-white font-bold">All candidates ({candidates.length})</p>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Industry</th>
                  <th>AI tier</th>
                  <th>Completion</th>
                  <th>CV</th>
                  <th>WhatsApp</th>
                  <th>Kit</th>
                  <th>Live</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => {
                  const chatLen = (c.whatsapp_chat as unknown[]).length
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/p/${c.id.slice(0, 8)}`} target="_blank"
                          className="text-white font-semibold hover:text-[#22D3EE]">
                          {c.full_name || '—'}
                        </Link>
                      </td>
                      <td className="text-white/45">{c.email}</td>
                      <td className="text-white/50">{c.industry || '—'}</td>
                      <td>
                        {c.ai_tier ? (
                          <span className="text-xs font-bold capitalize" style={{
                            color: c.ai_tier === 'builder' ? '#FB7185' : c.ai_tier === 'integrator' ? '#A78BFA' : '#22D3EE'
                          }}>{c.ai_tier}</span>
                        ) : '—'}
                      </td>
                      <td style={{ color: c.completion_pct >= 60 ? '#34D399' : c.completion_pct >= 30 ? '#FCD34D' : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                        {c.completion_pct}%
                      </td>
                      <td><span className={`dot ${c.cv_parsed ? 'dot-green' : 'dot-red'}`} title={c.cv_parsed ? 'CV parsed' : 'No CV'} /></td>
                      <td>
                        <span className={`dot ${chatLen > 4 ? 'dot-green' : chatLen > 0 ? 'dot-yellow' : 'dot-red'}`}
                          title={`${chatLen} messages`} />
                        {chatLen > 0 && <span className="text-white/25 text-xs ml-1">{chatLen}</span>}
                      </td>
                      <td><span className={`dot ${c.cv_kit_purchased ? 'dot-green' : 'dot-red'}`} title={c.cv_kit_purchased ? 'Kit purchased' : 'Not purchased'} /></td>
                      <td>
                        {c.profile_live ? (
                          <span className="dot dot-green" title="Live" />
                        ) : (
                          <form action="/api/admin/verify" method="post" style={{ display: 'inline' }}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="text-xs text-white/20 hover:text-emerald-400">set live</button>
                          </form>
                        )}
                      </td>
                      <td className="text-white/25 text-xs">{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Companies */}
        <div className="gradient-border-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-white font-bold">All companies ({companies.length})</p>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Paid</th>
                  <th>Enriched</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(c => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/company/dashboard`}
                        className="text-white font-semibold hover:text-[#22D3EE]">
                        {c.company_name || c.full_name || '—'}
                      </Link>
                    </td>
                    <td className="text-white/45">{c.email}</td>
                    <td>
                      <span className={`dot ${c.paid ? 'dot-green' : 'dot-red'}`} />
                      {c.paid && <span className="text-emerald-400 text-xs ml-2 font-bold">$299/mo</span>}
                    </td>
                    <td><span className={`dot dot-yellow`} /></td>
                    <td className="text-white/25 text-xs">{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr><td colSpan={5} style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: 32 }}>No companies yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
