# Shapi Brand Kit

Single source of truth for brand colours, type, gradients, and components. This is what's actually in the live product (not the older warm-teal kit some legacy docs reference).

The aesthetic is **deep-space + neon gradient**: near-black backgrounds, cyan→purple gradient accents, coral for emphasis. Modern, technical, premium. Inspired by what serious AI products look like in 2026 — confident, dark, with restrained colour as signal.

---

## Colours

### Backgrounds
| Name | Hex | Where |
|------|-----|-------|
| Deep space | `#060609` | Page background — almost-black with a hint of blue |
| Card surface | `#0d0d14` | Slightly lifted from bg — cards, modals, side panels |
| Card surface hover | `#11111a` | Lift on hover |
| Border subtle | `rgba(255,255,255,0.06)` | Default card / divider stroke |
| Border highlight | `rgba(34,211,238,0.25)` | Active / hovered card stroke |

### Brand accents
| Name | Hex | Use |
|------|-----|-----|
| Cyan | `#22D3EE` | **Primary accent** — headlines, links, key stats, active states |
| Purple | `#A78BFA` | **Secondary accent** — gradient pair with cyan, badges |
| Coral | `#FB7185` | **Punch** — the stat that stops a scroll, urgent CTAs, "wow" numbers |
| Emerald | `#34D399` | **Positive signal** — verified, done, "do this", success states |
| Amber | `#FBBF24` | **Warning / premium** — "don't do this", Premium Verified tier, attention chips |
| Pink (alt) | `#FB7185` | Same as coral — Heart axis on Skill Quadrant |

### Text on dark
| Use | Value |
|-----|-------|
| Primary body | `rgba(255,255,255,0.9)` |
| Headline white | `#ffffff` |
| Secondary body | `rgba(255,255,255,0.6)` |
| Subtitle / labels | `rgba(255,255,255,0.4)` |
| Disabled / hint | `rgba(255,255,255,0.25)` |

### Text on light (PDFs / printed CV)
| Use | Hex |
|-----|-----|
| Headline ink | `#1a1a2e` |
| Body text | `#374151` |
| Muted text | `#6B7280` |
| Subtitle / label | `#9CA3AF` |
| Divider | `#E5E7EB` |
| Sidebar bg | `#F7F9FB` |

---

## Signature gradients

```
/* Primary brand gradient — used on logo, CTAs, hero text */
linear-gradient(135deg, #22D3EE, #A78BFA)
linear-gradient(135deg, #22D3EE 0%, #8B5CF6 100%)   /* tighter purple variant */

/* Hot-take / shimmer gradient — slide 1 hook accents, big moments */
linear-gradient(135deg, #22D3EE, #A78BFA, #FB7185, #22D3EE)

/* Card border gradient (with padding-box trick) */
background:
  linear-gradient(#0d0d14, #0d0d14) padding-box,
  linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15)) border-box;
border: 1px solid transparent;

/* Top strip on CV PDFs */
linear-gradient(90deg, #22D3EE, #A78BFA)
```

---

## Typography

### Family
**Plus Jakarta Sans** (Google Fonts) — loaded via `next/font/google`. Modern geometric sans, friendly but technical. Available 200–800.

Fallback stack:
```
'Plus Jakarta Sans', 'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif
```

### Weights in use
| Weight | Name | Where |
|--------|------|-------|
| 400 | Regular | Body copy |
| 500 | Medium | Body emphasis, labels |
| 600 | Semibold | Subheadings |
| 700 | Bold | Card titles, button text |
| 800 | Extra Bold | Section headlines, big numbers |
| 900 | Black | Hero hooks, percentage stats, "wow" copy |

### Sizes (Tailwind reference)
| Use | Size | Tailwind |
|-----|------|----------|
| Hero hook (mobile) | 36px / 2.25rem | `text-4xl` |
| Hero hook (desktop) | 72–96px | `text-7xl` / `text-8xl` |
| Section h1 | 30–36px | `text-3xl` / `text-4xl` |
| Card title | 16–18px | `text-base` / `text-lg` |
| Body | 14–15px | `text-sm` / `text-[15px]` |
| Caption | 11–12px | `text-xs` |
| Tiny label | 10px | `text-[10px]` |

### Tracking
- Big bold headlines: tighter `-0.02em` to `-0.5px` — the "modern tech" feel
- Uppercase labels: looser `0.15em` to `0.2em` — for the section eyebrows ("VERIFICATION TIER", "MATCH SCORE", etc.)

---

## Component patterns

### "Gradient border" card (the workhorse)
The signature card style across the product. Subtle cyan→purple stroke on dark card.

```jsx
<div style={{
  background: 'linear-gradient(#0d0d14,#0d0d14) padding-box, linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15)) border-box',
  border: '1px solid transparent',
  borderRadius: '1rem',
}} />
```

### Tier badges
| Tier | Bg | Text | Border |
|------|----|------|--------|
| Basic Verified | `rgba(34,211,238,0.12)` | `#22D3EE` | `#22D3EE40` |
| Strongly Verified | `rgba(52,211,153,0.13)` | `#34D399` | `#34D39940` |
| Premium Verified | `rgba(251,191,36,0.15)` | `#FBBF24` | `#FBBF2440` |
| Shapi Verified (fallback) | `rgba(167,139,250,0.13)` | `#A78BFA` | `#A78BFA40` |
| Active Concierge | `rgba(251,191,36,0.18)` | `#FBBF24` | — |
| Shapi Active | `rgba(251,113,133,0.15)` | `#FB7185` | — |
| Open Roles Board | `rgba(34,211,238,0.12)` | `#22D3EE` | — |
| CV Kit | `rgba(167,139,250,0.12)` | `#A78BFA` | — |
| Free | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.3)` | — |

### Skill Quadrant axis colours
| Axis | Hex |
|------|-----|
| Hands | `#34D399` emerald |
| Heart | `#FB7185` pink/coral |
| Head | `#22D3EE` cyan |
| Spark | `#A78BFA` purple |

### Dot grid background overlay
Subtle radial dot pattern used across most pages:

```css
background-image: radial-gradient(circle, rgba(34,211,238,0.06) 1px, transparent 1px);
background-size: 44px 44px;
```

---

## Logo wordmark

The literal text **"shapi"** rendered in the primary brand gradient. No icon. Always lowercase.

```jsx
<span style={{
  background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  fontWeight: 900,
  letterSpacing: '-0.02em',
}}>shapi</span>
```

Sizes: `text-xl` (nav), `text-3xl` (footer, marketing), `text-6xl`+ (hero).

---

## Spacing & radius

| Token | Value | Use |
|-------|-------|-----|
| Card radius | `1rem` (16px) | All cards, modals |
| Pill radius | `999px` | Badges, buttons, chips |
| Button padding | `0.75rem 1.5rem` | Standard CTA |
| Card padding | `1.5rem` (24px) | Standard card interior |
| Grid gap | `1rem` (16px) | Card grids |
| Page max-width | `64rem` (1024px) | Most pages |

---

## What NOT to use

- ❌ Pure black `#000000` — use deep space `#060609` instead
- ❌ Pure white text on dark — use `rgba(255,255,255,0.9)` for ease on eyes
- ❌ Warm tones (teal `#0B5563`, cream `#F8F4EE`) — those are stale from an earlier brand direction
- ❌ Mixing more than 2 gradient colours per surface — the 4-stop shimmer gradient is for ONE accent moment per page max
- ❌ Drop shadows on text — we use gradients + glows instead (the `btn-glow` class uses `bg-gradient-to-r` with `blur-sm` for the soft halo)

---

## Quick reference card

```
BACKGROUND  #060609
SURFACE     #0d0d14
CYAN        #22D3EE   primary
PURPLE      #A78BFA   secondary
CORAL       #FB7185   punch
EMERALD     #34D399   positive
AMBER       #FBBF24   premium/warning

GRADIENT    linear-gradient(135deg, #22D3EE, #A78BFA)
FONT        Plus Jakarta Sans
```
