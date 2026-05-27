import en from './dicts/en'
import hi from './dicts/hi'
import ur from './dicts/ur'
import tl from './dicts/tl'
import bn from './dicts/bn'
import es from './dicts/es'
import fr from './dicts/fr'
import ar from './dicts/ar'
import type { Locale } from './locales'

export const DICTS = { en, hi, ur, tl, bn, es, fr, ar } as const

export type Dict = typeof en

export function getDict(locale: Locale): Dict {
  return (DICTS[locale] || DICTS.en) as Dict
}

export { LOCALES, DEFAULT_LOCALE, isRtl } from './locales'
export type { Locale } from './locales'
