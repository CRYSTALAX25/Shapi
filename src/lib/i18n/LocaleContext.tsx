'use client'

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { DEFAULT_LOCALE, type Locale, isRtl } from './locales'
import { getDict, type Dict } from './index'
import enDict from './dicts/en'

const STORAGE_KEY = 'shapi.locale'

type TFunction = (key: string) => string

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TFunction
  rtl: boolean
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function resolvePath(dict: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = dict
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

interface LocaleProviderProps {
  children: ReactNode
  initialLocale?: Locale
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null
      if (stored && stored !== locale) {
        setLocaleState(stored)
      }
    } catch {
      // localStorage unavailable — silently ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect locale into <html lang> + dir, and persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
      document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
  }, [])

  const activeDict: Dict = useMemo(() => getDict(locale), [locale])

  const t = useCallback<TFunction>(
    (key: string) => {
      const fromActive = resolvePath(activeDict, key)
      if (fromActive !== undefined) return fromActive
      const fromEn = resolvePath(enDict, key)
      if (fromEn !== undefined) return fromEn
      // Surface missing keys clearly during development; never throw.
      return key
    },
    [activeDict]
  )

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, rtl: isRtl(locale) }),
    [locale, setLocale, t]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used inside <LocaleProvider>')
  }
  return ctx
}

export function useTranslation(): LocaleContextValue {
  return useLocale()
}
