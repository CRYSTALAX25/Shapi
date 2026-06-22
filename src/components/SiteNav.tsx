'use client'

import Link from 'next/link'
import ShapiLogo from './ShapiLogo'
import LocalePicker from './LocalePicker'
import { useTranslation } from '@/lib/i18n/LocaleContext'

// ============================================================================
// SiteNav — the shared pre-login top nav (floating pill). North-Star logo +
// the locked IA: For Candidates · For Companies · Pricing · Sign in · Get started.
// Used on every public marketing page so nav + logo are identical everywhere.
// Must be rendered inside a <LocaleProvider>. `active` underlines the current
// audience. Ocean→emerald accent per the 2026-06-13 palette direction.
// ============================================================================

export default function SiteNav({ active }: { active?: 'candidates' | 'companies' | 'pricing' }) {
  const { t } = useTranslation()
  const link = (href: string, label: string, key: 'candidates' | 'companies' | 'pricing', cls = '') => (
    <Link
      href={href}
      className={`site-nav-link text-sm ${cls}`}
      style={active === key ? { color: '#fff' } : undefined}
    >
      {label}
    </Link>
  )

  return (
    <nav className="relative z-30 mx-auto max-w-7xl px-4 pt-5">
      <style>{`
        .site-nav-link { color:#A6A6B4; transition: color .2s ease; }
        .site-nav-link:hover { background: linear-gradient(135deg,#38BDF8,#34D399); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .site-nav-cta {
          background: linear-gradient(#0D0C14,#0D0C14) padding-box, linear-gradient(135deg,#38BDF8,#34D399) border-box;
          border: 1.5px solid transparent; color:#F4F4F7; transition: all .25s ease;
        }
        .site-nav-cta:hover { box-shadow: 0 8px 24px rgba(56,189,248,0.24); transform: translateY(-1px); }
      `}</style>
      <div
        className="flex items-center justify-between gap-3 rounded-full py-2 ps-4 pe-2"
        style={{ background: 'rgba(13,12,20,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
      >
        <Link href="/" aria-label="Shapi home" className="flex items-center">
          <ShapiLogo size={30} variant="full" title="Shapi" />
        </Link>
        <div className="flex items-center gap-5">
          {link('/for-candidates', t('common.footer.forCandidates'), 'candidates', 'hidden md:block')}
          {link('/for-companies', t('common.footer.forCompanies'), 'companies', 'hidden md:block')}
          {link('/company/pricing', t('common.nav.pricing'), 'pricing', 'hidden sm:block')}
          <Link href="/login" className="site-nav-link text-sm">{t('common.nav.signIn')}</Link>
          <LocalePicker />
          <Link href="/signup" className="site-nav-cta rounded-full px-4 py-2 text-sm font-black">
            {t('common.nav.getStartedShort')}
          </Link>
        </div>
      </div>
    </nav>
  )
}
