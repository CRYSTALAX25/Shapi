'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Stage = 'upload' | 'parsing' | 'whatsapp' | 'done'

export default function UploadCV() {
  const [stage, setStage] = useState<Stage>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [whatsapp, setWhatsapp] = useState('+971 ')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF')
      return
    }
    setFileName(file.name)
    setError('')
    setStage('parsing')

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/cv-parse', { method: 'POST', body: form })

    if (!res.ok) {
      setError('Could not read your CV — try again or skip')
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

  const saveAndFinish = async () => {
    setSaving(true)
    if (whatsapp.trim().length > 5) {
      await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: whatsapp.trim() }),
      })
    }
    setSaving(false)
    setStage('done')
  }

  // Parsing state
  if (stage === 'parsing') {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="flex gap-1.5 justify-center mb-8">
            {[0, 150, 300].map(d => (
              <div key={d} className="w-3 h-3 bg-[#0B5563]/40 rounded-full animate-bounce"
                style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <p className="text-[#1C1C2E] font-semibold text-lg mb-2">Reading your CV...</p>
          <p className="text-[#1C1C2E]/40 text-sm">{fileName}</p>
          <p className="text-[#1C1C2E]/40 text-sm mt-4">We're pulling out your experience, skills, and achievements. Takes about 10 seconds.</p>
        </div>
      </div>
    )
  }

  // WhatsApp stage
  if (stage === 'whatsapp') {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-[#0B5563] rounded-full flex items-center justify-center mx-auto mb-5 text-white text-xl">✓</div>
            <h1 className="text-2xl font-bold text-[#1C1C2E] mb-3">CV read. Profile started.</h1>
            <p className="text-[#1C1C2E]/60 leading-relaxed text-sm">
              We've captured your experience. Now we want to go deeper — the things a CV never captures. We'll do it over WhatsApp, at your pace.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/10 shadow-sm mb-4">
            <p className="font-semibold text-[#1C1C2E] mb-1">Where should we reach you?</p>
            <p className="text-sm text-[#1C1C2E]/50 mb-5">
              We'll send a WhatsApp message with a few questions. Text or voice note — whatever's easier. Takes 5 minutes total.
            </p>
            <input
              type="tel"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="+971 50 123 4567"
              className="w-full bg-[#F8F4EE] border border-[#1C1C2E]/10 rounded-xl px-4 py-3.5 text-sm text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors"
            />
            <p className="text-xs text-[#1C1C2E]/30 mt-2">Include country code. UAE: +971 · KSA: +966 · UK: +44</p>
          </div>

          <button
            onClick={saveAndFinish}
            disabled={saving}
            className="w-full bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors disabled:opacity-50 mb-3"
          >
            {saving ? 'Saving...' : "That's me done — send me a WhatsApp →"}
          </button>
          <button
            onClick={() => setStage('done')}
            className="w-full py-3 text-sm text-[#1C1C2E]/30 hover:text-[#1C1C2E]/50 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    )
  }

  // Done state
  if (stage === 'done') {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#0B5563] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl">✓</div>
          <h1 className="text-2xl font-bold text-[#1C1C2E] mb-3">You're in.</h1>
          <p className="text-[#1C1C2E]/60 leading-relaxed mb-2">
            Expect a WhatsApp message from us shortly. A few questions — no forms, no stress.
          </p>
          <p className="text-[#1C1C2E]/40 text-sm mb-10">
            Your profile is being built in the background. We'll let you know when it's live.
          </p>

          <div className="bg-white rounded-2xl p-6 border border-[#1C1C2E]/10 text-left space-y-3 mb-8">
            <p className="text-sm font-semibold text-[#1C1C2E]">What happens next</p>
            {[
              'We message you on WhatsApp to fill in the gaps',
              'We contact your reference independently',
              'Your profile goes live once verified — usually 48hrs',
              'Matched companies can view your profile',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#0B5563]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#0B5563]" />
                </div>
                <p className="text-sm text-[#1C1C2E]/60">{item}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors"
          >
            Go to my dashboard →
          </button>
        </div>
      </div>
    )
  }

  // Upload stage (default)
  return (
    <div className="min-h-screen bg-[#F8F4EE] flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <span className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</span>
          <h1 className="text-3xl font-bold text-[#1C1C2E] mt-6 mb-3">Let's start.</h1>
          <p className="text-[#1C1C2E]/60 leading-relaxed">
            Drop your CV and we take it from here. No forms to fill in — we read it and ask you the right questions.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all mb-4 ${
            dragging
              ? 'border-[#0B5563] bg-[#0B5563]/5 scale-[1.01]'
              : 'border-[#1C1C2E]/15 hover:border-[#0B5563]/40 bg-white'
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-[#0B5563]/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-[#0B5563]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-[#1C1C2E] font-semibold mb-1">Drop your CV here</p>
          <p className="text-sm text-[#1C1C2E]/40">or click to browse · PDF · Max 5MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

        <button
          onClick={() => setStage('whatsapp')}
          className="w-full py-3.5 text-sm text-[#1C1C2E]/40 hover:text-[#1C1C2E]/60 transition-colors"
        >
          I don't have a CV right now →
        </button>
      </div>
    </div>
  )
}
