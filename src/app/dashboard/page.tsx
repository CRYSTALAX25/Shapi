import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const type = user.user_metadata?.type || 'candidate'

  return (
    <div className="min-h-screen bg-[#F8F4EE]">
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto border-b border-[#1C1C2E]/5">
        <Link href="/" className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#1C1C2E]/50">{user.email}</span>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-[#1C1C2E]/50 hover:text-[#1C1C2E] transition-colors">Sign out</button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-20">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[#1C1C2E] mb-2">
            {type === 'company' ? 'Company dashboard' : 'Your profile'}
          </h1>
          <p className="text-[#1C1C2E]/60">
            {type === 'company'
              ? 'Post jobs, review verified candidates, and manage your pipeline.'
              : 'Build your verified profile and get matched with the right companies.'}
          </p>
        </div>

        {type === 'candidate' && (
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/onboarding" className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/5 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-10 h-10 bg-[#0B5563] rounded-full flex items-center justify-center text-white text-sm mb-5">→</div>
              <h3 className="font-semibold text-[#1C1C2E] text-lg mb-2">Complete your profile</h3>
              <p className="text-[#1C1C2E]/60 text-sm leading-relaxed">Add your work history, skills, and first reference to go live.</p>
              <div className="mt-4 h-1.5 bg-[#1C1C2E]/5 rounded-full">
                <div className="h-1.5 bg-[#0B5563] rounded-full w-[10%]" />
              </div>
              <p className="text-xs text-[#1C1C2E]/40 mt-2">10% complete</p>
            </Link>

            <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/5 shadow-sm opacity-50">
              <div className="w-10 h-10 bg-[#1C1C2E]/10 rounded-full flex items-center justify-center text-[#1C1C2E]/40 text-sm mb-5">◎</div>
              <h3 className="font-semibold text-[#1C1C2E] text-lg mb-2">Company matches</h3>
              <p className="text-[#1C1C2E]/60 text-sm leading-relaxed">Complete your profile to unlock company matches.</p>
            </div>

            <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/5 shadow-sm opacity-50">
              <div className="w-10 h-10 bg-[#1C1C2E]/10 rounded-full flex items-center justify-center text-[#1C1C2E]/40 text-sm mb-5">✓</div>
              <h3 className="font-semibold text-[#1C1C2E] text-lg mb-2">Verification status</h3>
              <p className="text-[#1C1C2E]/60 text-sm leading-relaxed">Reference pending. We&apos;ll notify you when it&apos;s complete.</p>
            </div>

            <Link href="/evidence" className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/5 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-10 h-10 bg-[#0B5563]/10 rounded-full flex items-center justify-center text-[#0B5563] text-sm mb-5">⬆</div>
              <h3 className="font-semibold text-[#1C1C2E] text-lg mb-2">Add work evidence</h3>
              <p className="text-[#1C1C2E]/60 text-sm leading-relaxed">Photos and docs that prove your experience. Makes your profile stand out.</p>
            </Link>

            <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/5 shadow-sm opacity-50">
              <div className="w-10 h-10 bg-[#1C1C2E]/10 rounded-full flex items-center justify-center text-[#1C1C2E]/40 text-sm mb-5">▲</div>
              <h3 className="font-semibold text-[#1C1C2E] text-lg mb-2">Profile boost</h3>
              <p className="text-[#1C1C2E]/60 text-sm leading-relaxed">Surface your profile to 5 specific companies for $29.</p>
            </div>
          </div>
        )}

        {type === 'company' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/5 shadow-sm">
              <div className="w-10 h-10 bg-[#E8745A] rounded-full flex items-center justify-center text-white text-sm mb-5">+</div>
              <h3 className="font-semibold text-[#1C1C2E] text-lg mb-2">Post a role</h3>
              <p className="text-[#1C1C2E]/60 text-sm leading-relaxed">Add a job and start receiving verified candidate matches.</p>
            </div>

            <Link href="/candidates" className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-[#E8745A]/10 rounded-full flex items-center justify-center text-[#E8745A] text-sm mb-5">◎</div>
              <h3 className="font-semibold text-[#1C1C2E] text-lg mb-2">Browse candidates</h3>
              <p className="text-[#1C1C2E]/60 text-sm leading-relaxed">View verified candidate profiles matched to your roles.</p>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
