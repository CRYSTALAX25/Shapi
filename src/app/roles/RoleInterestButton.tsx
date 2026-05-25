'use client'

import { useState } from 'react'

export default function RoleInterestButton({
  roleId,
  initialInterested,
}: {
  roleId: string
  initialInterested: boolean
}) {
  const [interested, setInterested] = useState(initialInterested)
  const [loading, setLoading] = useState(false)
  const [flash, setFlash] = useState(false)

  async function toggle() {
    if (loading) return
    setLoading(true)
    try {
      if (interested) {
        await fetch('/api/candidate/interest', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role_id: roleId }),
        })
        setInterested(false)
      } else {
        await fetch('/api/candidate/interest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role_id: roleId }),
        })
        setInterested(true)
        setFlash(true)
        setTimeout(() => setFlash(false), 1200)
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50"
      style={
        interested
          ? {
              background: 'linear-gradient(135deg, rgba(106,168,245,0.15), rgba(240,140,174,0.15))',
              border: '1px solid rgba(106,168,245,0.4)',
              color: '#6AA8F5',
            }
          : {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)',
            }
      }
    >
      {flash && (
        <span
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(106,168,245,0.25), rgba(240,140,174,0.25))',
            animation: 'pulse 0.6s ease-out',
          }}
        />
      )}
      {loading ? (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : interested ? (
        <>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Interested
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          I&apos;m interested
        </>
      )}
    </button>
  )
}
