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
    <div className="min-h-screen bg-[#060609] text-[#F4F4F7]">
      <nav className="px-6 py-5 max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #9D8CFF, #34D399)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-[#A6A6B4] hover:text-[#F4F4F7] transition-colors">Home</Link>
          <Link href="/signup" className="font-bold text-white px-4 py-2 rounded-full"
            style={{ background: 'linear-gradient(135deg, #9D8CFF, #34D399)' }}>Get started →</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-10 pb-24">
        <div className="mb-12">
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#9D8CFF' }}>The Shapi blog</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3">Hiring, made honest.</h1>
          <p className="text-[#A6A6B4] text-lg max-w-2xl">Notes on verification, trust, and the future of work — from the team building the verification layer for hiring.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {BLOG_POSTS.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`}
              className="group rounded-2xl p-7 bg-[#0D0C14] transition-all hover:-translate-y-1"
              style={{ border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${post.accent}14`, color: post.accent }}>{post.tag}</span>
                <span className="text-[#7E7E8E] text-xs">{post.readMinutes} min read</span>
              </div>
              <h2 className="text-xl font-black tracking-tight mb-2 group-hover:opacity-80 transition-opacity">{post.title}</h2>
              <p className="text-[#A6A6B4] text-sm leading-relaxed mb-4">{post.excerpt}</p>
              <div className="flex items-center justify-between">
                <span className="text-[#7E7E8E] text-xs">{fmtDate(post.date)}</span>
                <span className="text-sm font-bold transition-transform group-hover:translate-x-0.5" style={{ color: post.accent }}>Read →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <footer className="border-t border-[rgba(255,255,255,0.08)] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <span className="font-black text-lg tracking-tighter" style={{
            background: 'linear-gradient(135deg, #9D8CFF, #34D399)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>shapi</span>
          <div className="flex items-center gap-5 text-[#7E7E8E]">
            <Link href="/privacy" className="hover:text-[#F4F4F7]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#F4F4F7]">Terms</Link>
            <a href="mailto:hello@shapi.io" className="hover:text-[#F4F4F7]">hello@shapi.io</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
