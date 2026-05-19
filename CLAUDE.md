# Shapi — Claude Instructions

## Project
Shapi (shapi.io) — two-sided verified job matching platform. Founder: Ana O. Barber.
Tagline: "Shape what's next." UAE-first launch May 2026.

## Never ask for permission on
- Writing/editing code files
- Running builds and pushing to GitHub
- Creating new pages, API routes, components
- Installing npm packages
- Creating Supabase SQL migration files

## Always confirm before
- Changing Vercel environment variables (Ana does this manually)
- Touching DNS records
- Deleting data from Supabase tables

## Tech stack
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Auth:** Supabase Auth (@supabase/ssr)
- **Database:** Supabase (PostgreSQL) — project: juqgwcipbdzoegodiydh.supabase.co
- **Hosting:** Vercel — Ana Barber's projects (Hobby plan)
- **Email:** Resend — sending domain shapi.io, from: hello@shapi.io
- **Payments:** Stripe (Ana's existing account: ana.vbarber@gmail.com)
- **AI conversations:** Claude API (claude-sonnet-4-6)
- **Voice transcription:** OpenAI Whisper API
- **Repo:** https://github.com/CRYSTALAX25/Shapi (branch: main)

## Brand
**See `BRAND.md` for the full kit.** Quick reference below.

- Background: `#060609` (deep space) · Card surface: `#0d0d14`
- Cyan `#22D3EE` (primary) · Purple `#A78BFA` (secondary)
- Coral `#FB7185` (punch) · Emerald `#34D399` (positive) · Amber `#FBBF24` (premium)
- Primary gradient: `linear-gradient(135deg, #22D3EE, #A78BFA)`
- Font: Plus Jakarta Sans (Google Fonts, 400–900)
- Text on dark: `rgba(255,255,255,0.9)` body, `rgba(255,255,255,0.4)` subtitles

**Do NOT use** the older warm-teal / cream palette (`#0B5563`, `#F8F4EE`, etc.) — that's stale from an earlier direction.

## Current routes
- `/` — Homepage + waitlist form (saves to Supabase, sends Resend confirmation)
- `/signup` — Create account (candidate or company) → redirects to /cv-builder on email confirm
- `/login` — Sign in → redirects to /dashboard
- `/cv-builder` — Claude AI conversational CV builder (auth protected). Shows [PROFILE_READY] CTA → /pay
- `/pay` — $49 payment page → Stripe Checkout
- `/onboarding` — 5-step manual profile form (auth protected). Accessible via "Skip" from cv-builder or after payment
- `/dashboard` — Candidate/company dashboard (auth protected)
- `/api/waitlist` — POST: save to waitlist table + send confirmation email
- `/api/cv-builder` — POST: Claude API chat endpoint. Returns { reply, ready }
- `/api/stripe/checkout` — POST: create Stripe checkout session ($49)
- `/api/stripe/webhook` — POST: handle checkout.session.completed → set profiles.paid=true
- `/api/profile/update` — POST: update profile fields for authenticated user
- `/api/auth/signout` — POST: sign out + redirect to /

## Route protection
`src/proxy.ts` — Next.js 16 proxy (equivalent to middleware). Redirects unauthenticated users from /onboarding, /dashboard, /profile → /login.

## Supabase tables
- `waitlist` — id, email (unique), type (candidate|company), created_at ✅ live
- `profiles` — full schema in supabase/profiles.sql. RLS enabled, auto-create trigger on signup. ⚠️ Ana must run SQL in Supabase editor
- `evidence` — TO CREATE in week 2 (photos, EXIF metadata, storage refs)
- `jobs` — TO CREATE in week 3
- `references` — TO CREATE in week 3
- `matches` — TO CREATE in week 4

## Environment variables
In .env.local (local only):
- NEXT_PUBLIC_SUPABASE_URL=https://juqgwcipbdzoegodiydh.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY ✅
- SUPABASE_SERVICE_ROLE_KEY ✅
- RESEND_API_KEY ✅
- STRIPE_SECRET_KEY ✅ (Shapi account sk_live_51TXPuh...)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ✅ (pk_live_51TXPuh...)
- NEXT_PUBLIC_SITE_URL=https://shapi.io ✅
- STRIPE_WEBHOOK_SECRET ✅ (whsec_rFXsfF...)

In Vercel (⚠️ Ana must add these — NOT yet in Vercel):
- STRIPE_SECRET_KEY
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- NEXT_PUBLIC_SITE_URL
- STRIPE_WEBHOOK_SECRET
- ANTHROPIC_API_KEY (get from console.anthropic.com → API Keys)

Future:
- OPENAI_API_KEY (Whisper — week 3)

## 5-week build plan
- Week 1 ✅ Foundation, auth, homepage, waitlist, deploy to shapi.io
- Week 2 🔜 CV builder (Claude chat ✅), Stripe payment ($49 ✅), evidence upload (next), profile completion
- Week 3 Reference collection system, company side (job posting, company profile, trust score)
- Week 4 Matching engine, candidate ↔ company match scores, polish
- Week 5 Launch — soft Monday, public Friday

## Pricing
- Candidates: $49 one-time (blue collar $19 later)
- Profile Boost: $29 upsell — surfaces to 5 specific companies
- Companies: $299/mo Starter, $799/mo Growth, Custom Enterprise
- Placement fee: $500 per hire (after 30 days in role)

## Core differentiators (build these in order)
1. Independent reference sourcing — system contacts refs, candidate doesn't choose what they say
2. Evidence-based AI skills verification — User / Integrator / Builder tiers
3. Company trust score integrated into matching (salary paid on time, manager quality, real hours)
4. Visa/degree intelligence by country
5. Blue + white collar — voice notes, native language, phone-first
6. Career transition engine for AI-displaced workers
7. Ghost job detection and job health scoring

## Ana's contact
- Email: ana.vbarber@gmail.com
- WhatsApp KSA: +966 502506355
