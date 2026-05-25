import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BLOG_POSTS, getPost } from '@/lib/blog'

export function generateStaticParams() {
  return BLOG_POSTS.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  return {
    title: post ? `${post.title} — Shapi` : 'Shapi Blog',
    description: post?.excerpt || 'The Shapi blog',
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <nav className="px-6 py-5 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #F08CAE, #6AA8F5)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/blog" className="text-[#A6A6B4] text-sm hover:text-[#F4F4F7] transition-colors">← All posts</Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 pt-8 pb-20">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${post.accent}14`, color: post.accent }}>{post.tag}</span>
          <span className="text-[#7E7E8E] text-xs">{fmtDate(post.date)} · {post.readMinutes} min read</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.05] mb-8">{post.title}</h1>

        <div className="space-y-5">
          {post.body.map((para, i) =>
            para.startsWith('## ') ? (
              <h2 key={i} className="text-2xl font-black tracking-tight pt-4" style={{ color: post.accent }}>{para.slice(3)}</h2>
            ) : (
              <p key={i} className="text-[#C7C7D1] text-lg leading-relaxed">{para}</p>
            ),
          )}
        </div>

        <div className="mt-14 rounded-2xl p-8 text-center text-white" style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE 55%, #F58E9A)' }}>
          <h3 className="text-2xl font-black mb-2">Get a profile that proves it.</h3>
          <p className="text-white/80 text-sm mb-6">Independently verified. References sourced by us. Built in minutes.</p>
          <Link href="/signup" className="inline-block bg-white text-[#0E0E13] px-7 py-3.5 rounded-full font-black text-sm hover:scale-[1.02] transition-transform">
            Build my verified profile →
          </Link>
        </div>
      </article>

      <footer className="border-t border-[rgba(255,255,255,0.08)] py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <span className="font-black text-lg tracking-tighter" style={{
            background: 'linear-gradient(135deg, #F08CAE, #6AA8F5)',
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
