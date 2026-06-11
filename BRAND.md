# Shapi Brand Kit

**Palette: VIOLET MINT — locked 2026-06-11 (supersedes the cyan/purple kit).**

Single source of truth for brand colours, type, gradients, and components. This is what's actually in the live product (not the older warm-teal kit or the cyan/purple kit some legacy docs reference).

The aesthetic is **deep-space + violet intelligence**: near-black backgrounds, violet→emerald gradient accents, coral for punch. Violet owns "intelligence + premium" in a market drowning in HR-tool blue; the brand gradient ends in verified-green so the logo itself says what Shapi is — intelligence that resolves into verified truth.

**THE DISCIPLINE RULE: green is never decorative.** Every green pixel means verified / positive / "do this". Violet is the workhorse accent for everything else.

---

## Colours

All tokens are defined once as CSS custom properties on `:root` in `src/app/globals.css` (`--bg`, `--surface`, `--accent`, `--accent2`, `--grad`, `--verified`, `--warn`, `--punch`, `--text-hi/mid/low/hint`, `--line`, `--dot`). Prefer `var()` references in code.

### Backgrounds
| Name | Hex | Where |
|------|-----|-------|
| Deep space | `#060609` | Page background — almost-black with a hint of blue |
| Card surface | `#0D0C14` | Violet-tinted, slightly lifted from bg — cards, modals, side panels |
| Card surface hover | `#11101A` | Lift on hover |
| Hairline / border | `rgba(255,255,255,0.07)` | Default card / divider stroke (`--line`) |
| Border highlight | `rgba(157,140,255,0.25)` | Active / hovered card stroke |

### Brand accents
| Name | Hex | Use |
|------|-----|-----|
| Violet | `#9D8CFF` | **Primary accent (workhorse)** — headlines, links, key stats, active states, eyebrows |
| Emerald | `#34D399` | **Secondary accent / verified / positive** — verified badges, checks, success, "do this". Never decorative |
| Coral | `#FB7185` | **Punch / urgent** — the stat that stops a scroll, urgent CTAs, scarcity, "wow" numbers only |
| Amber | `#FBBF24` | **Warning / premium** — "don't do this", Premium tiers, Concierge, attention chips only |

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
/* Primary brand gradient — logo, CTAs, hero text. Violet → emerald:
   intelligence resolving into verified truth. */
linear-gradient(135deg, #9D8CFF, #34D399)

/* Hot-take / shimmer gradient — hero headline, big moments.
   Coral is the rare third — ONE accent moment per page max. */
linear-gradient(135deg, #9D8CFF, #34D399, #FB7185, #9D8CFF)

/* Card border gradient (with padding-box trick) */
background:
  linear-gradient(#0D0C14, #0D0C14) padding-box,
  linear-gradient(135deg, rgba(157,140,255,0.15), rgba(52,211,153,0.15)) border-box;
border: 1px solid transparent;

/* Top strip on CV PDFs */
linear-gradient(90deg, #9D8CFF, #34D399)
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
The signature card style across the product. Subtle violet→emerald stroke on dark card.

```jsx
<div style={{
  background: 'linear-gradient(#0D0C14,#0D0C14) padding-box, linear-gradient(135deg, rgba(157,140,255,0.15), rgba(52,211,153,0.15)) border-box',
  border: '1px solid transparent',
  borderRadius: '1rem',
}} />
```

### Tier badges
| Tier | Bg | Text | Border |
|------|----|------|--------|
| Basic Verified | `rgba(157,140,255,0.12)` | `#9D8CFF` | `#9D8CFF40` |
| Strongly Verified | `rgba(52,211,153,0.13)` | `#34D399` | `#34D39940` |
| Premium Verified | `rgba(251,191,36,0.15)` | `#FBBF24` | `#FBBF2440` |
| Shapi Verified (fallback) | `rgba(157,140,255,0.13)` | `#9D8CFF` | `#9D8CFF40` |
| Active Concierge | `rgba(251,191,36,0.18)` | `#FBBF24` | — |
| Shapi Active | `rgba(251,113,133,0.15)` | `#FB7185` | — |
| Open Roles Board | `rgba(157,140,255,0.12)` | `#9D8CFF` | — |
| CV Kit | `rgba(157,140,255,0.12)` | `#9D8CFF` | — |
| Free | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.3)` | — |

### Skill Quadrant axis colours
| Axis | Hex |
|------|-----|
| Hands | `#34D399` emerald |
| Heart | `#FB7185` coral |
| Head | `#9D8CFF` violet |
| Spark | `#FBBF24` amber |

### Dot grid background overlay
Subtle radial dot pattern used across most pages (`--dot`):

```css
background-image: radial-gradient(circle, rgba(157,140,255,0.07) 1px, transparent 1px);
background-size: 44px 44px;
```

---

## Logo wordmark

The literal text **"shapi"** rendered in the primary brand gradient. No icon. Always lowercase. Every wordmark (nav, footer, hero, marketing) uses the same violet→emerald gradient.

```jsx
<span style={{
  background: 'linear-gradient(135deg, #9D8CFF, #34D399)',
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

- ❌ Cyan `#22D3EE` as primary (and its purple pair `#A78BFA`) — superseded by Violet Mint on 2026-06-11
- ❌ Blue/pink `#6AA8F5` / `#F08CAE` (and `#F58E9A`) — the old homepage palette, retired
- ❌ Green as decoration — emerald `#34D399` ONLY ever means verified / positive / "do this"
- ❌ Pure black `#000000` — use deep space `#060609` instead
- ❌ Pure white text on dark — use `rgba(255,255,255,0.9)` for ease on eyes
- ❌ Warm tones (teal `#0B5563`, cream `#F8F4EE`) — stale from an earlier brand direction
- ❌ Mixing more than 2 gradient colours per surface — the 4-stop shimmer gradient is for ONE accent moment per page max
- ❌ Drop shadows on text — we use gradients + glows instead (the `btn-glow` class uses `bg-gradient-to-r` with `blur-sm` for the soft halo)

---

## Quick reference card

```
BACKGROUND  #060609
SURFACE     #0D0C14   violet-tinted
VIOLET      #9D8CFF   primary (workhorse)
EMERALD     #34D399   secondary · verified · positive (never decorative)
CORAL       #FB7185   punch · urgent
AMBER       #FBBF24   premium · warning

GRADIENT    linear-gradient(135deg, #9D8CFF, #34D399)
DOT GRID    rgba(157,140,255,0.07)
HAIRLINE    rgba(255,255,255,0.07)
TEXT TIERS  rgba(255,255,255, .9 / .6 / .4 / .25)
FONT        Plus Jakarta Sans
```
