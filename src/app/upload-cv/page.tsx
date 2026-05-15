'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Stage = 'upload' | 'parsing' | 'whatsapp' | 'done'

export default function UploadCV() {
  const [stage, setStage] = useState<Stage>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    setFileName(file.name)
    setStage('parsing')
    setError('')

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/cv-parse', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Something went wrong — please try again')
      setStage('upload')
      return
    }

    setStage('whatsapp')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const saveWhatsapp = async () => {
    if (!whatsapp.trim()) {
      router.push('/onboarding')
      return
    }
    setSaving(true)
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp_number: whatsapp.trim() }),
    })
    setSaving(false)
    setStage('done')
  }

  if (stage === 'parsing') {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-6">
            <div className="w-2.5 h-2.5 bg-[#0B5563]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2.5 h-2.5 bg-[#0B5563]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2.5 h-2.5 bg-[#0B5563]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-[#1C1C2E] font-semibold text-lg mb-2">Reading your CV...</p>
          <p className="text-[#1C1C2E]/50 text-sm">{fileName}</p>
        </div>
      </div>
    )
  }

  if (stage === 'whatsapp') {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-[#0B5563] rounded-full flex items-center justify-center mx-auto mb-5 text-white text-xl">✓</div>
            <h1 className="text-2xl font-bold text-[#1C1C2E] mb-2">CV read successfully</h1>
            <p className="text-[#1C1C2E]/60 text-sm">We've pulled your work history and skills. Now we want to go deeper — on WhatsApp.</p>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/10 shadow-sm mb-6">
            <p className="font-medium text-[#1C1C2E] mb-1">Get a WhatsApp message from Shapi</p>
            <p className="text-sm text-[#1C1C2E]/60 mb-5">We'll ask a few follow-up questions to complete your profile — text or voice note, at your own pace.</p>

            <div className="flex gap-2 mb-3">
              <div className="bg-[#F8F4EE] border border-[#1C1C2E]/10 rounded-xl px-4 py-3.5 text-sm text-[#1C1C2E]/60 flex-shrink-0">
                +971
              </div>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="50 123 4567"
                className="flex-1 bg-[#F8F4EE] border border-[#1C1C2E]/10 rounded-xl px-4 py-3.5 text-sm text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors"
              />
            </div>
            <p className="text-xs text-[#1C1C2E]/40">UAE number shown. Edit the country code if needed (e.g. +966 for KSA).</p>
          </div>

          <button
            onClick={saveWhatsapp}
            disabled={saving}
            className="w-full bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors disabled:opacity-50 mb-3"
          >
            {saving ? 'Saving...' : 'Send me a WhatsApp →'}
          </button>
          <button
            onClick={() => router.push('/onboarding')}
            className="w-full py-3 text-sm text-[#1C1C2E]/40 hover:text-[#1C1C2E]/60 transition-colors"
          >
            Skip — I'll fill it in manually
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'done') {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5 text-white text-xl">✓</div>
          <h1 className="text-2xl font-bold text-[#1C1C2E] mb-2">You're all set</h1>
          <p className="text-[#1C1C2E]/60 mb-8">Expect a WhatsApp message from us shortly. Reply whenever — no rush.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-[#0B5563] text-white px-8 py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors"
          >
            Go to dashboard →
          </button>
        </div>
      </div>
    )
  }

  // Upload stage
  return (
    <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <span className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</span>
          <h1 className="text-2xl font-bold text-[#1C1C2E] mt-6 mb-2">Upload your CV</h1>
          <p className="text-[#1C1C2E]/60 text-sm">We'll read it so you don't have to retype everything. Takes about 10 seconds.</p>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-colors mb-4 ${
            dragging ? 'border-[#0B5563] bg-[#0B5563]/5' : 'border-[#1C1C2E]/20 hover:border-[#0B5563]/50 bg-white'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-[#0B5563]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#0B5563]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-[#1C1C2E] font-medium mb-1">Drop your CV here, or click to browse</p>
          <p className="text-sm text-[#1C1C2E]/40">PDF only · Max 5MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <button
          onClick={() => router.push('/cv-builder')}
          className="w-full py-3 text-sm text-[#1C1C2E]/40 hover:text-[#1C1C2E]/60 transition-colors"
        >
          I don't have a CV — build one from scratch →
        </button>
      </div>
    </div>
  )
}
