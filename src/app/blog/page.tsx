import Link from 'next/link'
import { BLOG_POSTS } from '@/lib/blog'

export const metadata = {
  title: 'Blog — Shapi',
  description: 'Notes on hiring, verification, and the future of work from the Shapi team.',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-white text-[#0E0E1A]">
      <nav className="px-6 py-5 max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-[#5A5A6E] hover:text-[#0E0E1A] transition-colors">Home</Link>
          <Link href="/signup" className="font-bold text-white px-4 py-2 rounded-full"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #7C3AED)' }}>Get started →</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-10 pb-24">
        <div className="mb-12">
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#7C3AED' }}>The Shapi blog</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3">Hiring, made honest.</h1>
          <p className="text-[#5A5A6E] text-lg max-w-2xl">Notes on verification, trust, and the future of work — from the team building the verification layer for hiring.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {BLOG_POSTS.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`}
              className="group rounded-2xl p-7 bg-white transition-all hover:-translate-y-1"
              style={{ border: '1px solid rgba(14,14,26,0.08)', boxShadow: '0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05)' }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${post.accent}14`, color: post.accent }}>{post.tag}</span>
                <span className="text-[#8A8A99] text-xs">{post.readMinutes} min read</span>
              </div>
              <h2 className="text-xl font-black tracking-tight mb-2 group-hover:opacity-80 transition-opacity">{post.title}</h2>
              <p className="text-[#5A5A6E] text-sm leading-relaxed mb-4">{post.excerpt}</p>
              <div className="flex items-center justify-between">
                <span className="text-[#8A8A99] text-xs">{fmtDate(post.date)}</span>
                <span className="text-sm font-bold transition-transform group-hover:translate-x-0.5" style={{ color: post.accent }}>Read →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <footer className="border-t border-[#0E0E1A]/[0.07] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <span className="font-black text-lg tracking-tighter" style={{
            background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>shapi</span>
          <div className="flex items-center gap-5 text-[#8A8A99]">
            <Link href="/privacy" className="hover:text-[#0E0E1A]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#0E0E1A]">Terms</Link>
            <a href="mailto:hello@shapi.io" className="hover:text-[#0E0E1A]">hello@shapi.io</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
