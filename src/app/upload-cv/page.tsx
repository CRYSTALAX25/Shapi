'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ShapiCharacter from '@/components/ShapiCharacter'

type Stage = 'upload' | 'parsing' | 'whatsapp' | 'no-cv' | 'done'

export default function UploadCV() {
  const [stage, setStage] = useState<Stage>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [whatsapp, setWhatsapp] = useState('+971 ')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    setFileName(file.name)
    setError('')
    setStage('parsing')

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/cv-parse', { method: 'POST', body: form })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Could not read your CV — try again or skip')
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

  // Save WhatsApp number (CV path)
  const saveWhatsapp = async () => {
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

  // Save name + WhatsApp (no CV path)
  const saveNoCV = async () => {
    if (!whatsapp.trim() || whatsapp.trim().length < 6) {
      setError('Please enter your WhatsApp number')
      return
    }
    setSaving(true)
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: name.trim() || null,
        whatsapp_number: whatsapp.trim(),
        completion_pct: 15,
      }),
    })
    setSaving(false)
    setStage('done')
  }

  // ─── Parsing ───
  if (stage === 'parsing') {
    return (
      <Screen>
        <div className="text-center max-w-sm">
          <ShapiCharacter mood="thinking" size={90} className="mx-auto mb-6" />
          <p className="text-[#0E0E1A] font-black text-xl mb-2">Reading your CV...</p>
          <p className="text-[#8A8A99] text-sm">{fileName}</p>
          <p className="text-[#8A8A99] text-sm mt-3">Extracting your experience, skills and achievements. About 10 seconds.</p>
        </div>
      </Screen>
    )
  }

  // ─── WhatsApp (post-CV) ───
  if (stage === 'whatsapp') {
    return (
      <Screen>
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <ShapiCharacter mood="happy" size={80} className="mx-auto mb-5" />
            <h1 className="text-2xl font-black text-[#0E0E1A] mb-2">CV read. Profile started.</h1>
            <p className="text-[#5A5A6E] text-sm leading-relaxed">
              We've captured your experience. Now we go deeper — the things no CV captures. We'll do it over WhatsApp, at your pace.
            </p>
          </div>

          <div className="gradient-border-card rounded-2xl p-6 mb-4">
            <p className="font-bold text-[#0E0E1A] text-sm mb-1">Where should we reach you?</p>
            <p className="text-[#8A8A99] text-xs mb-4">
              A few WhatsApp questions — text or voice note, whatever's easier. 5 minutes total.
            </p>
            <input
              type="tel"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="+971 50 123 4567"
              className="w-full bg-[#0E0E1A]/[0.04] border border-[#0E0E1A]/[0.08] rounded-xl px-4 py-3.5 text-sm text-[#0E0E1A] placeholder-[#9A9AA8] focus:outline-none focus:border-[#22D3EE]/50 transition-colors"
            />
            <p className="text-[10px] text-[#8A8A99] mt-2">Include country code · UAE: +971 · KSA: +966 · UK: +44</p>
          </div>

          <button
            onClick={saveWhatsapp}
            disabled={saving}
            className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity disabled:opacity-50 mb-3"
          >
            {saving ? 'Saving...' : "That's me done — send me a WhatsApp →"}
          </button>
          <button
            onClick={() => setStage('done')}
            className="w-full py-3 text-sm text-[#8A8A99] hover:text-[#5A5A6E] transition-colors"
          >
            Skip for now
          </button>
        </div>
      </Screen>
    )
  }

  // ─── No CV path ───
  if (stage === 'no-cv') {
    return (
      <Screen>
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-[#A78BFA]/15 border border-[#A78BFA]/25 flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-[#0E0E1A] mb-2">No CV? No problem.</h1>
            <p className="text-[#5A5A6E] text-sm leading-relaxed">
              Drop us your WhatsApp number and we'll build your profile through a short conversation. Text or voice note — your call.
            </p>
          </div>

          <div className="gradient-border-card rounded-2xl p-6 mb-4 space-y-4">
            <div>
              <label className="text-[#8A8A99] text-xs font-bold uppercase tracking-wider mb-2 block">Your name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="First name is fine"
                className="w-full bg-[#0E0E1A]/[0.04] border border-[#0E0E1A]/[0.08] rounded-xl px-4 py-3.5 text-sm text-[#0E0E1A] placeholder-[#9A9AA8] focus:outline-none focus:border-[#22D3EE]/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-[#8A8A99] text-xs font-bold uppercase tracking-wider mb-2 block">WhatsApp number</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="+971 50 123 4567"
                className="w-full bg-[#0E0E1A]/[0.04] border border-[#0E0E1A]/[0.08] rounded-xl px-4 py-3.5 text-sm text-[#0E0E1A] placeholder-[#9A9AA8] focus:outline-none focus:border-[#22D3EE]/50 transition-colors"
              />
              <p className="text-[10px] text-[#8A8A99] mt-2">Include country code · UAE: +971 · KSA: +966 · UK: +44</p>
            </div>
          </div>

          {error && <p className="text-[#E11D48] text-sm text-center mb-3">{error}</p>}

          <button
            onClick={saveNoCV}
            disabled={saving}
            className="w-full bg-gradient-to-r from-[#A78BFA] to-[#22D3EE] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity disabled:opacity-50 mb-3"
          >
            {saving ? 'Saving...' : 'Start my profile — WhatsApp me →'}
          </button>
          <button
            onClick={() => setStage('upload')}
            className="w-full py-3 text-sm text-[#8A8A99] hover:text-[#5A5A6E] transition-colors"
          >
            ← Back
          </button>
        </div>
      </Screen>
    )
  }

  // ─── Done ───
  if (stage === 'done') {
    return (
      <Screen>
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#22D3EE] to-[#A78BFA] flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-[#060609]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-[#0E0E1A] mb-2">You&apos;re in.</h1>
          <p className="text-[#5A5A6E] leading-relaxed mb-2 text-sm">
            Expect a WhatsApp message from us shortly. A few questions — no forms, no stress.
          </p>
          <p className="text-[#8A8A99] text-sm mb-8">
            Your profile is being built in the background.
          </p>

          <div className="gradient-border-card rounded-2xl p-6 text-left space-y-3 mb-8">
            <p className="text-xs font-bold text-[#5A5A6E] uppercase tracking-wider">What happens next</p>
            {[
              'We WhatsApp you to fill in the gaps',
              'We contact your reference independently',
              'Your profile goes live once verified — usually 48hrs',
              'Matched companies can view your profile',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#22D3EE]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22D3EE]" />
                </div>
                <p className="text-sm text-[#5A5A6E]">{item}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity"
          >
            Go to my dashboard →
          </button>
        </div>
      </Screen>
    )
  }

  // ─── Upload (default) ───
  return (
    <Screen>
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-border-card {
          background: linear-gradient(#ffffff, #ffffff) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.2), rgba(139,92,246,0.2)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05);
          transition: all 0.25s ease;
        }
        .drop-zone-active {
          background: linear-gradient(#ffffff, #ffffff) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.6), rgba(139,92,246,0.6)) border-box !important;
          transform: scale(1.01);
        }
      `}</style>

      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <span className="font-black text-2xl tracking-tighter" style={{
            background: 'linear-gradient(135deg, #A78BFA, #22D3EE, #FB7185)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'gradientShift 5s ease infinite',
          }}>shapi</span>
          <h1 className="text-3xl font-black text-[#0E0E1A] mt-6 mb-3 tracking-tight">Let&apos;s start.</h1>
          <p className="text-[#5A5A6E] leading-relaxed text-sm">
            Drop your CV and we take it from here. No forms — we read it and ask you the right questions.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`gradient-border-card rounded-2xl p-14 text-center cursor-pointer mb-4 ${dragging ? 'drop-zone-active' : 'hover:bg-[#0E0E1A]/[0.03]'}`}
        >
          <div className="w-14 h-14 rounded-xl bg-[#22D3EE]/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-[#0891B2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-[#0E0E1A] font-bold mb-1">Drop your CV here</p>
          <p className="text-sm text-[#8A8A99]">or click to browse · PDF · Max 5MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>

        {error && (
          <p className="text-[#E11D48] text-sm text-center mb-3 bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          onClick={() => setStage('no-cv')}
          className="w-full py-3.5 text-sm text-[#8A8A99] hover:text-[#3F3F4E] transition-colors"
        >
          I don&apos;t have a CV right now →
        </button>
      </div>
    </Screen>
  )
}

// Shared dark layout wrapper
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}
