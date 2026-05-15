'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Upload = {
  name: string
  size: number
  status: 'uploading' | 'done' | 'error'
  caption: string
}

export default function Evidence() {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const upload = async (file: File, caption: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('caption', caption)

    const res = await fetch('/api/evidence/upload', { method: 'POST', body: form })
    return res.ok
  }

  const addFiles = (files: FileList) => {
    const newUploads: Upload[] = Array.from(files).map(f => ({
      name: f.name,
      size: f.size,
      status: 'uploading',
      caption: '',
    }))
    setUploads(prev => [...prev, ...newUploads])

    Array.from(files).forEach(async (file, i) => {
      const idx = uploads.length + i
      const ok = await upload(file, '')
      setUploads(prev => prev.map((u, j) => j === idx ? { ...u, status: ok ? 'done' : 'error' } : u))
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const fmt = (bytes: number) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)}KB`
    : `${(bytes / 1024 / 1024).toFixed(1)}MB`

  return (
    <div className="min-h-screen bg-[#F8F4EE]">
      <nav className="px-6 py-5 flex items-center justify-between max-w-4xl mx-auto">
        <span className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</span>
        <button onClick={() => router.push('/dashboard')} className="text-sm text-[#1C1C2E]/50 hover:text-[#1C1C2E] transition-colors">
          ← Back to dashboard
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1C1C2E] mb-2">Add work evidence.</h1>
          <p className="text-[#1C1C2E]/60">Photos, screenshots, or documents that show your work. The more you add, the stronger your profile.</p>
        </div>

        <div className="bg-[#0B5563]/5 rounded-2xl p-5 border border-[#0B5563]/10 mb-8">
          <p className="text-sm text-[#0B5563] font-medium mb-1">What counts as evidence?</p>
          <ul className="text-sm text-[#1C1C2E]/60 space-y-1">
            <li>• Photos taken at a jobsite or office (we check EXIF metadata)</li>
            <li>• Screenshots of completed projects or dashboards</li>
            <li>• Award certificates, training completions, compliance docs</li>
            <li>• Press mentions, published work, published reports</li>
          </ul>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
            dragging ? 'border-[#0B5563] bg-[#0B5563]/5' : 'border-[#1C1C2E]/20 hover:border-[#0B5563]/50'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-[#0B5563]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#0B5563]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-[#1C1C2E] font-medium mb-1">Drop files here, or click to browse</p>
          <p className="text-sm text-[#1C1C2E]/40">JPG, PNG, PDF · Max 10MB each</p>
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
          <div className="mt-6 space-y-3">
            {uploads.map((u, i) => (
              <div key={i} className="bg-white rounded-2xl px-5 py-4 border border-[#1C1C2E]/10 flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  u.status === 'done' ? 'bg-green-500' :
                  u.status === 'error' ? 'bg-red-400' :
                  'bg-[#0B5563]/40 animate-pulse'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1C1C2E] truncate">{u.name}</p>
                  <p className="text-xs text-[#1C1C2E]/40">{fmt(u.size)} · {u.status === 'uploading' ? 'Uploading...' : u.status === 'done' ? 'Uploaded' : 'Failed — try again'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {uploads.some(u => u.status === 'done') && (
          <div className="mt-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors"
            >
              Done — back to dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
