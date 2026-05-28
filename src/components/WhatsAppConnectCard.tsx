'use client'

// Reusable Connect-on-WhatsApp prompt. Two variants:
//   `card` — full bordered card, shown on dashboards as the first-encounter
//            entry point into the WhatsApp relationship with Shapi.
//   `inline` — pill-sized hint for feature pages (e.g. org-design page) where
//              we want to say "you can also do this from WhatsApp" without
//              dominating the layout.
//
// The button opens wa.me with the right pre-typed message (join code in
// sandbox, friendly hello in production). One tap, no copy-paste, no
// memorisation of trigger phrases.

import { getShapiConnectUrl, getShapiTriggerUrl, getShapiWhatsAppDisplay, isShapiWhatsAppSandbox } from '@/lib/shapi-whatsapp-url'

type Props = {
  variant?: 'card' | 'inline'
  role?: 'candidate' | 'company'
  // Optional override — if supplied, the button pre-types this trigger
  // instead of the generic Connect message. Use for feature-specific CTAs
  // like "design my org via voice".
  triggerText?: string
  title?: string
  description?: string
}

const WA_GREEN = '#25D366'

export default function WhatsAppConnectCard({
  variant = 'card',
  role,
  triggerText,
  title,
  description,
}: Props) {
  const url = triggerText ? getShapiTriggerUrl(triggerText) : getShapiConnectUrl()
  const number = getShapiWhatsAppDisplay()
  const sandbox = isShapiWhatsAppSandbox()

  const defaultTitle = role === 'company'
    ? 'Run Shapi from WhatsApp'
    : 'Get Shapi on WhatsApp'

  const defaultDesc = role === 'company'
    ? 'Shortlist candidates, design your org by voice, send job-description links, request a deep-dive — all from the WhatsApp you already use. No app to download.'
    : 'Voice notes, reference reminders, profile updates, ask anything — all from WhatsApp. No app to download.'

  if (variant === 'inline') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors hover:opacity-90"
        style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.40)', color: '#34D399' }}
      >
        <span className="text-base leading-none">💬</span>
        {triggerText ? `Tap to text: "${triggerText}"` : 'Open Shapi on WhatsApp'}
        <span className="ms-0.5">→</span>
      </a>
    )
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'linear-gradient(135deg, rgba(37,211,102,0.10), rgba(106,168,245,0.06))',
        border: '1px solid rgba(37,211,102,0.30)',
      }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl"
          style={{ background: WA_GREEN }}
        >
          💬
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#F4F4F7] font-black text-base mb-1">{title || defaultTitle}</p>
          <p className="text-[#A6A6B4] text-xs mb-3.5 leading-relaxed">{description || defaultDesc}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black text-white whitespace-nowrap"
              style={{ background: WA_GREEN }}
            >
              <span className="text-sm leading-none">💬</span>
              Open WhatsApp →
            </a>
            <p className="text-[#7E7E8E] text-[11px]">
              Number: <span className="text-[#C7C7D1] font-mono">{number}</span>
            </p>
          </div>
          {sandbox && (
            <p className="text-[#7E7E8E] text-[10px] mt-2.5 leading-relaxed">
              Beta: this is our Twilio sandbox number — the link pre-types a one-time join code so Shapi can reply. After that, just message normally.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
