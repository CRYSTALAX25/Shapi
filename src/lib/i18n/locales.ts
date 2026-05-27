export type Locale = 'en' | 'hi' | 'ur' | 'tl' | 'bn' | 'es' | 'fr' | 'hr' | 'ar'

export const LOCALES: { code: Locale; label: string; native: string; rtl?: boolean }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ur', label: 'Urdu', native: 'اُردُو', rtl: true },
  { code: 'tl', label: 'Tagalog', native: 'Tagalog' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'hr', label: 'Croatian', native: 'Hrvatski' },
  { code: 'ar', label: 'Arabic', native: 'العربية', rtl: true },
]

export const DEFAULT_LOCALE: Locale = 'en'

export const RTL_LOCALES: Locale[] = LOCALES.filter(l => l.rtl).map(l => l.code)

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale)
}
