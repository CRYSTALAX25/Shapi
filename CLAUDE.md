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
- Primary teal: #0B5563 | Mid teal: #0D6B7A | Light teal: #0F8299
- Coral (companies/CTAs): #E8745A
- Background: #F8F4EE
- Text: #1C1C2E
- Font: Plus Jakarta Sans (Google Fonts)

## Current routes
- `/` — Homepage + waitlist form (saves to Supabase, sends Resend confirmation)
- `/signup` — Create account (candidate or company)
- `/login` — Sign in
- `/dashboard` — Candidate/company dashboard (auth protected)
- `/onboarding` — 5-step candidate profile builder (auth protected)
- `/api/waitlist` — POST: save to waitlist table + send confirmation email
- `/api/auth/signout` — POST: sign out + redirect to /

## Route protection
`src/proxy.ts` — Next.js 16 proxy (equivalent to middleware). Redirects unauthenticated users from /onboarding, /dashboard, /profile → /login.

## Supabase tables
- `waitlist` — id, email (unique), type (candidate|company), created_at
- `profiles` — TO CREATE in week 2
- `jobs` — TO CREATE in week 3
- `references` — TO CREATE in week 3
- `matches` — TO CREATE in week 4

## Environment variables
Already in Vercel + .env.local:
- NEXT_PUBLIC_SUPABASE_URL=https://juqgwcipbdzoegodiydh.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- RESEND_API_KEY

To add (week 2):
- STRIPE_SECRET_KEY
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- ANTHROPIC_API_KEY
- OPENAI_API_KEY (Whisper)

## 5-week build plan
- Week 1 ✅ Foundation, auth, homepage, waitlist, deploy to shapi.io
- Week 2 🔜 Candidate onboarding data → Supabase, CV builder (Claude chat), Stripe payment ($49), evidence upload
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
