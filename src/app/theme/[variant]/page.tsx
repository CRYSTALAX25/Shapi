import { notFound } from 'next/navigation'
import ThemeMock from '../ThemeMock'
import { THEMES } from '../themes'

export function generateStaticParams() {
  return Object.keys(THEMES).map(variant => ({ variant }))
}

export const metadata = { title: 'Theme preview — Shapi' }

export default async function ThemeVariant({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params
  const t = THEMES[variant]
  if (!t) notFound()
  return <ThemeMock t={t} />
}
