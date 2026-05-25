'use client'

import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0E0E13] flex items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <div className="relative z-10 text-center max-w-sm">
        <ShapiCharacter mood="idle" size={80} className="mx-auto mb-8" />
        <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-widest mb-3">404</p>
        <h1 className="text-3xl font-black text-[#F4F4F7] mb-3">Nothing here.</h1>
        <p className="text-[#C7C7D1] text-sm leading-relaxed mb-8">
          That page doesn&apos;t exist — or you might not have access to it yet.
        </p>
        <Link href="/dashboard"
          className="inline-block bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] px-6 py-3 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity">
          Back to dashboard →
        </Link>
      </div>
    </div>
  )
}
