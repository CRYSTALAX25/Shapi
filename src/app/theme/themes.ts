// Theme mockups for the design decision. Each is a self-contained token set the
// ThemeMock renders, so Ana can compare premium-dark vs warm-neutral vs mono.

export type ThemeTokens = {
  key: string
  name: string
  blurb: string
  pageBg: string
  cardBg: string
  cardBorder: string
  cardShadow: string
  text: string
  textSec: string
  textMuted: string
  accent: string
  accentSoft: string
  trust: string
  trustSoft: string
  navBg: string
  navText: string
  navTextMuted: string
  buttonGradient: string
  buttonText: string
  logoGradient: string
  dot: string
  star: { from: string; to: string; glow: string }
}

export const THEMES: Record<string, ThemeTokens> = {
  dark: {
    key: 'dark',
    name: 'Premium Dark',
    blurb: 'Layered charcoal, restrained neon accents, calm high-contrast type. AI/trust premium.',
    pageBg: '#0E0E13',
    cardBg: '#16161F',
    cardBorder: 'rgba(255,255,255,0.08)',
    cardShadow: '0 1px 2px rgba(0,0,0,0.4), 0 16px 40px rgba(0,0,0,0.35)',
    text: '#F4F4F7',
    textSec: '#A6A6B4',
    textMuted: '#6B6B78',
    accent: '#22D3EE',
    accentSoft: 'rgba(34,211,238,0.12)',
    trust: '#34D399',
    trustSoft: 'rgba(52,211,153,0.14)',
    navBg: 'rgba(11,11,17,0.85)',
    navText: '#F4F4F7',
    navTextMuted: 'rgba(244,244,247,0.55)',
    buttonGradient: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
    buttonText: '#0B0B11',
    logoGradient: 'linear-gradient(135deg, #67E8F9, #A78BFA)',
    dot: 'rgba(255,255,255,0.035)',
    star: { from: '#67E8F9', to: '#A78BFA', glow: 'rgba(34,211,238,0.55)' },
  },
  warm: {
    key: 'warm',
    name: 'Warm Trust',
    blurb: 'Soft warm canvas (not stark white), coral energy + teal trust. Human and premium.',
    pageBg: '#F6F1E9',
    cardBg: '#FFFDF9',
    cardBorder: 'rgba(28,26,23,0.10)',
    cardShadow: '0 1px 2px rgba(28,26,23,0.04), 0 14px 36px rgba(28,26,23,0.07)',
    text: '#1C1A17',
    textSec: '#5A554C',
    textMuted: '#928B7E',
    accent: '#E0483A',
    accentSoft: 'rgba(224,72,58,0.10)',
    trust: '#0E7C7B',
    trustSoft: 'rgba(14,124,123,0.12)',
    navBg: '#FFFDF9',
    navText: '#1C1A17',
    navTextMuted: 'rgba(28,26,23,0.55)',
    buttonGradient: 'linear-gradient(135deg, #FB5E4D, #E0483A)',
    buttonText: '#FFFFFF',
    logoGradient: 'linear-gradient(135deg, #E0483A, #0E7C7B)',
    dot: 'rgba(28,26,23,0.05)',
    star: { from: '#FB7185', to: '#0E7C7B', glow: 'rgba(224,72,58,0.30)' },
  },
  mono: {
    key: 'mono',
    name: 'Mono + Electric',
    blurb: 'Near-monochrome base, one bold electric-violet accent used sparingly. Linear/Vercel-clean.',
    pageBg: '#FAFAFA',
    cardBg: '#FFFFFF',
    cardBorder: 'rgba(10,10,10,0.10)',
    cardShadow: '0 1px 2px rgba(10,10,10,0.04), 0 14px 34px rgba(10,10,10,0.06)',
    text: '#0A0A0A',
    textSec: '#52525B',
    textMuted: '#A1A1AA',
    accent: '#6D28D9',
    accentSoft: 'rgba(109,40,217,0.10)',
    trust: '#6D28D9',
    trustSoft: 'rgba(109,40,217,0.10)',
    navBg: '#0A0A0A',
    navText: '#FFFFFF',
    navTextMuted: 'rgba(255,255,255,0.6)',
    buttonGradient: '#6D28D9',
    buttonText: '#FFFFFF',
    logoGradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    dot: 'none',
    star: { from: '#8B5CF6', to: '#6D28D9', glow: 'rgba(109,40,217,0.30)' },
  },
}
