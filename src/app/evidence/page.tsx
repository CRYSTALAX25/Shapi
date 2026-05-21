'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

type ActiveUpload = {
  id: string
  name: string
  size: number
  status: 'uploading' | 'done' | 'error'
}

type EvidenceItem = {
  id: string
  file_name: string
  file_type: string
  file_size: number
  caption: string | null
  status: string
  created_at: string
  storage_path: string
  url: string | null
}

export default function Evidence() {
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([])
  const [saved, setSaved] = useState<EvidenceItem[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadSaved = async () => {
    try {
      const res = await fetch('/api/evidence/upload')
      if (res.ok) {
        const { items } = await res.json()
        setSaved(items || [])
      }
    } catch { /* non-fatal */ }
    setLoadingSaved(false)
  }

  useEffect(() => { loadSaved() }, [])

  const upload = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/evidence/upload', { method: 'POST', body: form })
    return res.ok
  }

  const addFiles = (files: FileList) => {
    const incoming = Array.from(files).map(file => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }))
    // Match status updates by stable id (not computed index) so concurrent
    // batches can't overwrite each other's rows.
    setActiveUploads(prev => [...prev, ...incoming.map(({ file, id }) => ({ id, name: file.name, size: file.size, status: 'uploading' as const }))])
    incoming.forEach(async ({ file, id }) => {
      const ok = await upload(file)
      setActiveUploads(prev => prev.map(u => u.id === id ? { ...u, status: ok ? 'done' : 'error' } : u))
      if (ok) loadSaved()
    })
  }

  const deleteItem = async (id: string) => {
    setDeleting(id)
    try {
      const res = await fetch('/api/evidence/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setSaved(prev => prev.filter(item => item.id !== id))
      }
    } catch { /* non-fatal */ }
    setDeleting(null)
  }

  const fmt = (bytes: number) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  const isImage = (type: string) => type.startsWith('image/')
  const allDone = activeUploads.length > 0 && activeUploads.every(u => u.status !== 'uploading')

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#ffffff, #ffffff) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.18), rgba(139,92,246,0.18)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05);
        }
        .drop-active {
          background: linear-gradient(#ffffff, #ffffff) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.5), rgba(139,92,246,0.5)) border-box !important;
        }
        .evidence-thumb:hover .evidence-overlay { opacity: 1; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-3xl mx-auto border-b border-[#0E0E1A]/[0.08]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/dashboard" className="text-[#5A5A6E] text-sm hover:text-[#3F3F4E] transition-colors">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#0E0E1A] mb-2">Add work evidence.</h1>
          <p className="text-[#5A5A6E] text-sm leading-relaxed">
            The more proof you add, the stronger your verified profile. This is what separates you from everyone else with a similar CV.
          </p>
        </div>

        {/* What counts */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6">
          <p className="text-[#3F3F4E] text-xs font-bold uppercase tracking-wider mb-3">What counts as evidence</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '📸', label: 'Site or jobsite photos', sub: 'EXIF metadata confirms time & place' },
              { icon: '🖥️', label: 'Project screenshots', sub: 'Dashboards, deliverables, output' },
              { icon: '🏆', label: 'Awards & certificates', sub: 'Training completions, compliance' },
              { icon: '📰', label: 'Press or published work', sub: 'Mentions, articles, reports' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-[#0E0E1A]/[0.04] rounded-xl p-3">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <p className="text-[#3F3F4E] text-sm font-semibold">{item.label}</p>
                  <p className="text-[#8A8A99] text-xs">{item.sub}</p>
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
          className={`gradient-border-card rounded-2xl p-14 text-center cursor-pointer mb-5 transition-all ${dragging ? 'drop-active scale-[1.01]' : 'hover:bg-[#0E0E1A]/[0.03]'}`}
        >
          <div className="w-14 h-14 rounded-xl bg-[#FB7185]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#E11D48]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-[#0E0E1A] font-bold mb-1">Drop files here or click to browse</p>
          <p className="text-sm text-[#8A8A99]">JPG · PNG · PDF · Max 10MB each · Multiple files OK</p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
            className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files) }}
          />
        </div>

        {/* Active upload progress */}
        {activeUploads.length > 0 && (
          <div className="space-y-3 mb-6">
            {activeUploads.map((u, i) => (
              <div key={i} className="gradient-border-card rounded-xl px-5 py-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  u.status === 'done' ? 'bg-emerald-500/20' :
                  u.status === 'error' ? 'bg-[#FB7185]/20' : 'bg-[#0E0E1A]/[0.04]'
                }`}>
                  {u.status === 'uploading' && (
                    <div className="w-3 h-3 rounded-full border-2 border-[#0E0E1A]/20 border-t-[#0E0E1A]/60 animate-spin" />
                  )}
                  {u.status === 'done' && (
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {u.status === 'error' && (
                    <svg className="w-4 h-4 text-[#E11D48]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0E0E1A] text-sm font-medium truncate">{u.name}</p>
                  <p className="text-[#8A8A99] text-xs">
                    {fmt(u.size)} · {u.status === 'uploading' ? 'Uploading...' : u.status === 'done' ? 'Saved ✓' : 'Failed — try again'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saved evidence gallery */}
        {loadingSaved ? (
          <div className="text-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-[#0E0E1A]/20 border-t-[#0E0E1A]/60 animate-spin mx-auto" />
          </div>
        ) : saved.length > 0 ? (
          <div className="mb-8">
            <p className="text-[#5A5A6E] text-xs font-bold uppercase tracking-wider mb-4">
              Saved evidence — {saved.length} file{saved.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {saved.map(item => (
                <div key={item.id} className="evidence-thumb relative rounded-xl overflow-hidden aspect-square bg-[#0E0E1A]/[0.04] border border-[#0E0E1A]/[0.08] group cursor-default">
                  {/* Thumbnail */}
                  {isImage(item.file_type) && item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-[#E11D48]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[#8A8A99] text-xs font-medium">PDF</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="evidence-overlay absolute inset-0 bg-[#060609]/85 opacity-0 transition-opacity duration-200 flex flex-col justify-between p-3">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-white/80 text-xs font-medium leading-tight line-clamp-2 flex-1">{item.file_name}</p>
                      <span style={{
                        background: item.status === 'verified' ? 'rgba(52,211,153,0.15)' : 'rgba(34,211,238,0.12)',
                        color: item.status === 'verified' ? '#34D399' : '#22D3EE',
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, flexShrink: 0,
                      }}>
                        {item.status === 'verified' ? '✓ Verified' : '✓ Saved'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/30 text-xs">{fmt(item.file_size)}</span>
                      <div className="flex items-center gap-2">
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#22D3EE] text-xs font-bold hover:text-white transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            Open →
                          </a>
                        )}
                        <button
                          onClick={() => deleteItem(item.id)}
                          disabled={deleting === item.id}
                          className="text-[#FB7185]/70 text-xs font-bold hover:text-[#FB7185] transition-colors disabled:opacity-40"
                        >
                          {deleting === item.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !loadingSaved && activeUploads.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[#B0B0BC] text-sm">No evidence uploaded yet — drop your first file above.</p>
          </div>
        ) : null}

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
