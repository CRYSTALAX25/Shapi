'use client'

import Link from 'next/link'
import ShapiLogo from './ShapiLogo'
import { useTranslation } from '@/lib/i18n/LocaleContext'

// ============================================================================
// SiteFooter — the shared pre-login footer. North-Star logo + the same link set
// across every public page. Must be rendered inside a <LocaleProvider>.
// ============================================================================

export default function SiteFooter() {
  const { t } = useTranslation()
  const links: [string, string][] = [
    ['/for-candidates', t('common.footer.forCandidates')],
    ['/for-companies', t('common.footer.forCompanies')],
    ['/company/pricing', t('common.footer.pricing')],
    ['/blog', t('common.footer.blog')],
    ['/privacy', t('common.footer.privacy')],
    ['/terms', t('common.footer.terms')],
  ]
  return (
    <footer className="relative z-10 border-t border-white/[0.08] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 md:flex-row">
        <Link href="/" aria-label="Shapi home" className="flex items-center">
          <ShapiLogo size={26} variant="full" title="Shapi" />
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#7E7E8E]">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="transition-colors hover:text-[#F4F4F7]">
              {label}
            </Link>
          ))}
          <a href="mailto:hello@shapi.io" className="transition-colors hover:text-[#F4F4F7]">
            {t('common.footer.email')}
          </a>
        </div>
        <p className="text-sm text-[#5C5C6A]">{t('common.footer.tagline')}</p>
      </div>
    </footer>
  )
}
