'use client'

import { useId } from 'react'

// Shapi's true mark — a refined North Star / compass rose (NOT the generic
// 4-point AI sparkle). Pole-star proportions: a dominant vertical axis, a
// shorter horizontal axis, and thinner diagonal cross-rays for an 8-point feel.
// The north (top) ray carries an asymmetric "split-lit facet" — one half catches
// the light — so the star reads like a faceted gem catching a beam.
//
// Rendered in the brand violet→emerald gradient. Two variants:
//   • mark — the star alone (square, scales to any size)
//   • full — star + lowercase "shapi" wordmark, gradient-filled, Plus Jakarta 900
//
// A separate 16px favicon-safe geometry (no diagonals, no facet) lives in
// public/icon.svg + app/icon.tsx for crisp rendering at tiny sizes.

interface ShapiLogoProps {
  size?: number
  variant?: 'mark' | 'full'
  className?: string
  // Optional title for accessibility when used as a standalone link/button.
  title?: string
}

export default function ShapiLogo({
  size = 32,
  variant = 'mark',
  className = '',
  title,
}: ShapiLogoProps) {
  const uid = useId().replace(/:/g, '')
  const gradId = `shapiLogoGrad-${uid}`
  const facetId = `shapiLogoFacet-${uid}`

  // The star geometry, drawn on a 100×100 grid centred at (50,50).
  // Vertical axis is long (6 → 94); horizontal axis is shorter (22 → 78);
  // diagonal rays are thinner and shorter still — the pole-star silhouette.
  const Star = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="18" y1="8" x2="82" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9D8CFF" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
        {/* Facet highlight — a soft light catching the lit half of the north ray */}
        <linearGradient id={facetId} x1="50" y1="6" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Diagonal cross-rays — thinner, shorter (8-point feel, subordinate) */}
      <path
        d="M50 50 L68 32 L50 50 L68 68 L50 50 L32 68 L50 50 L32 32 Z"
        fill={`url(#${gradId})`}
        fillOpacity="0.55"
      />

      {/* The dominant 4-point pole-star: long vertical, shorter horizontal */}
      <path
        d="M50 6  L56 44  L78 50  L56 56  L50 94  L44 56  L22 50  L44 44 Z"
        fill={`url(#${gradId})`}
      />

      {/* Split-lit facet on the north ray — only the RIGHT half is lit, so the
          tip reads as a faceted gem catching light from one side. */}
      <path d="M50 6 L56 44 L50 50 Z" fill={`url(#${facetId})`} />
      {/* A crisp seam down the centre of the north ray to sell the facet split */}
      <path d="M50 6 L50 50" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="0.8" />

      {/* Centre highlight — the pole-star's bright core */}
      <circle cx="50" cy="50" r="3.4" fill="#FFFFFF" fillOpacity="0.92" />
    </svg>
  )

  if (variant === 'mark') {
    return (
      <span className={`inline-flex items-center ${className}`} style={{ lineHeight: 0 }}>
        {Star}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {Star}
      <span
        style={{
          fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          fontSize: size * 0.62,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #9D8CFF, #34D399)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        shapi
      </span>
    </span>
  )
}
