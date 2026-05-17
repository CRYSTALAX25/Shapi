'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

type Upload = {
  name: string
  size: number
  status: 'uploading' | 'done' | 'error'
}

export default function Evidence() {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/evidence/upload', { method: 'POST', body: form })
    return res.ok
  }

  const addFiles = (files: FileList) => {
    const incoming = Array.from(files)
    const startIdx = uploads.length
    setUploads(prev => [...prev, ...incoming.map(f => ({ name: f.name, size: f.size, status: 'uploading' as const }))])
    incoming.forEach(async (file, i) => {
      const ok = await upload(file)
      setUploads(prev => prev.map((u, j) => j === startIdx + i ? { ...u, status: ok ? 'done' : 'error' } : u))
    })
  }

  const fmt = (bytes: number) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  const allDone = uploads.length > 0 && uploads.every(u => u.status !== 'uploading')

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#060609, #060609) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.18), rgba(139,92,246,0.18)) border-box;
          border: 1px solid transparent;
        }
        .drop-active {
          background: linear-gradient(#060609, #060609) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.5), rgba(139,92,246,0.5)) border-box !important;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.07) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-3xl mx-auto border-b border-white/[0.05]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/dashboard" className="text-white/40 text-sm hover:text-white/70 transition-colors">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Add work evidence.</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            The more proof you add, the stronger your verified profile. This is what separates you from everyone else with a similar CV.
          </p>
        </div>

        {/* What counts */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6">
          <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">What counts as evidence</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '📸', label: 'Site or jobsite photos', sub: 'EXIF metadata confirms time & place' },
              { icon: '🖥️', label: 'Project screenshots', sub: 'Dashboards, deliverables, output' },
              { icon: '🏆', label: 'Awards & certificates', sub: 'Training completions, compliance' },
              { icon: '📰', label: 'Press or published work', sub: 'Mentions, articles, reports' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/[0.03] rounded-xl p-3">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <p className="text-white/70 text-sm font-semibold">{item.label}</p>
                  <p className="text-white/30 text-xs">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          className={`gradient-border-card rounded-2xl p-14 text-center cursor-pointer mb-5 transition-all ${dragging ? 'drop-active scale-[1.01]' : 'hover:bg-white/[0.02]'}`}
        >
          <div className="w-14 h-14 rounded-xl bg-[#FB7185]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#FB7185]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-white font-bold mb-1">Drop files here or click to browse</p>
          <p className="text-sm text-white/30">JPG · PNG · PDF · Max 10MB each · Multiple files OK</p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
            className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files) }}
          />
        </div>

        {/* Upload list */}
        {uploads.length > 0 && (
          <div className="space-y-3 mb-6">
            {uploads.map((u, i) => (
              <div key={i} className="gradient-border-card rounded-xl px-5 py-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  u.status === 'done' ? 'bg-emerald-500/20' :
                  u.status === 'error' ? 'bg-[#FB7185]/20' : 'bg-white/[0.05]'
                }`}>
                  {u.status === 'uploading' && (
                    <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
                  )}
                  {u.status === 'done' && (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {u.status === 'error' && (
                    <svg className="w-4 h-4 text-[#FB7185]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-medium truncate">{u.name}</p>
                  <p className="text-white/30 text-xs">
                    {fmt(u.size)} · {u.status === 'uploading' ? 'Uploading...' : u.status === 'done' ? 'Uploaded ✓' : 'Failed — try again'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {allDone && (
          <Link href="/dashboard"
            className="block w-full text-center bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity">
            Done — back to dashboard →
          </Link>
        )}
      </div>
    </div>
  )
}
