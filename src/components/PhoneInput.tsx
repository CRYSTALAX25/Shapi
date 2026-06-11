'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// Curated country list — MENA + South Asia + key Western markets + key African
// markets. Roughly covers 95% of Shapi's expected userbase. Ordered with MENA
// at top because that's the launch market; everything else is alphabetical.
// Country flag emojis render cross-platform on modern browsers + Twemoji
// fallback. If a flag doesn't render, the ISO-2 code stays legible.
type Country = { code: string; flag: string; dial: string; name: string }

export const COUNTRIES: Country[] = [
  { code: 'AE', flag: '🇦🇪', dial: '+971', name: 'United Arab Emirates' },
  { code: 'SA', flag: '🇸🇦', dial: '+966', name: 'Saudi Arabia' },
  { code: 'QA', flag: '🇶🇦', dial: '+974', name: 'Qatar' },
  { code: 'KW', flag: '🇰🇼', dial: '+965', name: 'Kuwait' },
  { code: 'BH', flag: '🇧🇭', dial: '+973', name: 'Bahrain' },
  { code: 'OM', flag: '🇴🇲', dial: '+968', name: 'Oman' },
  { code: 'EG', flag: '🇪🇬', dial: '+20',  name: 'Egypt' },
  { code: 'JO', flag: '🇯🇴', dial: '+962', name: 'Jordan' },
  { code: 'LB', flag: '🇱🇧', dial: '+961', name: 'Lebanon' },
  { code: 'IQ', flag: '🇮🇶', dial: '+964', name: 'Iraq' },
  { code: 'YE', flag: '🇾🇪', dial: '+967', name: 'Yemen' },
  { code: 'SY', flag: '🇸🇾', dial: '+963', name: 'Syria' },
  { code: 'PS', flag: '🇵🇸', dial: '+970', name: 'Palestine' },
  // — South Asia + Philippines (large MENA expat workforce)
  { code: 'IN', flag: '🇮🇳', dial: '+91',  name: 'India' },
  { code: 'PK', flag: '🇵🇰', dial: '+92',  name: 'Pakistan' },
  { code: 'BD', flag: '🇧🇩', dial: '+880', name: 'Bangladesh' },
  { code: 'PH', flag: '🇵🇭', dial: '+63',  name: 'Philippines' },
  { code: 'LK', flag: '🇱🇰', dial: '+94',  name: 'Sri Lanka' },
  { code: 'NP', flag: '🇳🇵', dial: '+977', name: 'Nepal' },
  // — Africa
  { code: 'MA', flag: '🇲🇦', dial: '+212', name: 'Morocco' },
  { code: 'DZ', flag: '🇩🇿', dial: '+213', name: 'Algeria' },
  { code: 'TN', flag: '🇹🇳', dial: '+216', name: 'Tunisia' },
  { code: 'LY', flag: '🇱🇾', dial: '+218', name: 'Libya' },
  { code: 'SD', flag: '🇸🇩', dial: '+249', name: 'Sudan' },
  { code: 'KE', flag: '🇰🇪', dial: '+254', name: 'Kenya' },
  { code: 'NG', flag: '🇳🇬', dial: '+234', name: 'Nigeria' },
  { code: 'ZA', flag: '🇿🇦', dial: '+27',  name: 'South Africa' },
  { code: 'ET', flag: '🇪🇹', dial: '+251', name: 'Ethiopia' },
  { code: 'GH', flag: '🇬🇭', dial: '+233', name: 'Ghana' },
  // — Europe
  { code: 'GB', flag: '🇬🇧', dial: '+44',  name: 'United Kingdom' },
  { code: 'IE', flag: '🇮🇪', dial: '+353', name: 'Ireland' },
  { code: 'DE', flag: '🇩🇪', dial: '+49',  name: 'Germany' },
  { code: 'FR', flag: '🇫🇷', dial: '+33',  name: 'France' },
  { code: 'ES', flag: '🇪🇸', dial: '+34',  name: 'Spain' },
  { code: 'IT', flag: '🇮🇹', dial: '+39',  name: 'Italy' },
  { code: 'NL', flag: '🇳🇱', dial: '+31',  name: 'Netherlands' },
  { code: 'BE', flag: '🇧🇪', dial: '+32',  name: 'Belgium' },
  { code: 'PT', flag: '🇵🇹', dial: '+351', name: 'Portugal' },
  { code: 'CH', flag: '🇨🇭', dial: '+41',  name: 'Switzerland' },
  { code: 'AT', flag: '🇦🇹', dial: '+43',  name: 'Austria' },
  { code: 'SE', flag: '🇸🇪', dial: '+46',  name: 'Sweden' },
  { code: 'NO', flag: '🇳🇴', dial: '+47',  name: 'Norway' },
  { code: 'DK', flag: '🇩🇰', dial: '+45',  name: 'Denmark' },
  { code: 'FI', flag: '🇫🇮', dial: '+358', name: 'Finland' },
  { code: 'PL', flag: '🇵🇱', dial: '+48',  name: 'Poland' },
  { code: 'TR', flag: '🇹🇷', dial: '+90',  name: 'Turkey' },
  // — Americas
  { code: 'US', flag: '🇺🇸', dial: '+1',   name: 'United States' },
  { code: 'CA', flag: '🇨🇦', dial: '+1',   name: 'Canada' },
  { code: 'MX', flag: '🇲🇽', dial: '+52',  name: 'Mexico' },
  { code: 'BR', flag: '🇧🇷', dial: '+55',  name: 'Brazil' },
  { code: 'AR', flag: '🇦🇷', dial: '+54',  name: 'Argentina' },
  // — Asia Pacific
  { code: 'SG', flag: '🇸🇬', dial: '+65',  name: 'Singapore' },
  { code: 'MY', flag: '🇲🇾', dial: '+60',  name: 'Malaysia' },
  { code: 'ID', flag: '🇮🇩', dial: '+62',  name: 'Indonesia' },
  { code: 'TH', flag: '🇹🇭', dial: '+66',  name: 'Thailand' },
  { code: 'VN', flag: '🇻🇳', dial: '+84',  name: 'Vietnam' },
  { code: 'HK', flag: '🇭🇰', dial: '+852', name: 'Hong Kong' },
  { code: 'CN', flag: '🇨🇳', dial: '+86',  name: 'China' },
  { code: 'KR', flag: '🇰🇷', dial: '+82',  name: 'South Korea' },
  { code: 'JP', flag: '🇯🇵', dial: '+81',  name: 'Japan' },
  { code: 'AU', flag: '🇦🇺', dial: '+61',  name: 'Australia' },
  { code: 'NZ', flag: '🇳🇿', dial: '+64',  name: 'New Zealand' },
]

const DEFAULT_CODE = 'AE'

function findCountry(code: string): Country {
  return COUNTRIES.find(c => c.code === code) || COUNTRIES[0]
}

// Given a full phone string like "+971 50 123 4567" or "+966501234567", split
// into { country, rest }. Falls back to default if no match.
export function parsePhone(value: string | null | undefined): { country: Country; rest: string } {
  const v = (value || '').trim()
  if (!v) return { country: findCountry(DEFAULT_CODE), rest: '' }
  // Strip everything but digits + plus
  const cleaned = v.replace(/[^\d+]/g, '')
  // Sort countries by dial length descending so +971 wins over +97 etc.
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)
  for (const c of sorted) {
    if (cleaned.startsWith(c.dial)) {
      return { country: c, rest: cleaned.slice(c.dial.length).trim() }
    }
  }
  return { country: findCountry(DEFAULT_CODE), rest: cleaned.replace(/^\+/, '') }
}

type Props = {
  /** Full phone string e.g. "+971 50 123 4567". Empty string when blank. */
  value: string
  onChange: (next: string) => void
  /** ISO-2 default country if value is empty. Default 'AE'. */
  defaultCountry?: string
  /** Input placeholder for the local number part. */
  placeholder?: string
  /** Style hook — pass your existing input className. */
  inputClassName?: string
  inputStyle?: React.CSSProperties
  /** Dark/light theme. Default 'dark' to match the rest of the company UI. */
  theme?: 'dark' | 'light'
}

export default function PhoneInput({
  value,
  onChange,
  defaultCountry = DEFAULT_CODE,
  placeholder = '50 123 4567',
  inputClassName,
  inputStyle,
  theme = 'dark',
}: Props) {
  const parsed = useMemo(() => {
    const p = parsePhone(value)
    // If the value is empty, use defaultCountry instead of AE.
    if (!value) return { country: findCountry(defaultCountry), rest: '' }
    return p
  }, [value, defaultCountry])

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q)
      || c.code.toLowerCase().includes(q)
      || c.dial.includes(q)
    )
  }, [search])

  function pickCountry(c: Country) {
    setOpen(false)
    setSearch('')
    // Preserve any digits the user already typed.
    onChange(`${c.dial} ${parsed.rest}`.trim())
  }

  function onRestChange(next: string) {
    // Strip leading "+" / dial-code re-pastes from the user's local-number
    // input — they should only be typing local digits.
    const cleaned = next.replace(/^\+\d+\s*/, '')
    onChange(`${parsed.country.dial} ${cleaned}`.replace(/\s+$/, ''))
  }

  // Theme tokens — matches the existing onboarding "field" CSS class so the
  // component drops in without redesigning surrounding cards.
  const isDark = theme === 'dark'
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#fff'
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const text = isDark ? '#F4F4F7' : '#060609'
  const muted = isDark ? '#A6A6B4' : '#6b7280'
  const dropdownBg = isDark ? '#0D0C14' : '#fff'
  const hoverBg = isDark ? 'rgba(157, 140, 255, 0.08)' : 'rgba(157, 140, 255, 0.06)'

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-stretch gap-2">
        {/* Country selector trigger */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-1.5 px-3 rounded-xl text-sm font-bold transition-colors flex-shrink-0"
          style={{ background: surface, border: `1px solid ${surfaceBorder}`, color: text }}
        >
          <span className="text-base leading-none">{parsed.country.flag}</span>
          <span className="text-xs">{parsed.country.dial}</span>
          <span className="text-xs opacity-60 ml-0.5">▾</span>
        </button>

        {/* Local number input */}
        <input
          type="tel"
          inputMode="tel"
          value={parsed.rest}
          onChange={e => onRestChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName || 'field flex-1'}
          style={inputStyle}
        />
      </div>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          className="absolute z-40 mt-1.5 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: dropdownBg, border: `1px solid ${surfaceBorder}`, boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}
        >
          <div className="p-2.5 border-b" style={{ borderColor: surfaceBorder }}>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country or code…"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: surface, border: `1px solid ${surfaceBorder}`, color: text }}
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-xs" style={{ color: muted }}>No match</li>
            )}
            {filtered.map(c => {
              const active = c.code === parsed.country.code
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => pickCountry(c)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                    style={{
                      color: text,
                      background: active ? hoverBg : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={e => (e.currentTarget.style.background = active ? hoverBg : 'transparent')}
                  >
                    <span className="text-lg leading-none flex-shrink-0">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-bold opacity-70 flex-shrink-0">{c.dial}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
