import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes — redirect to login if not authenticated
  // Note: /worth, /ai-proof, /translate are intentionally PUBLIC lead-magnet
  // tools (top-of-funnel, no auth) — do not add them here.
  const protectedPaths = ['/onboarding', '/dashboard', '/profile', '/evidence', '/cv-builder', '/pay', '/upload-cv', '/course-wallet', '/work-style', '/applications', '/active', '/roles', '/company', '/candidates']
  // Public exceptions inside protected prefixes. /company/pricing is a
  // marketing page (linked from the /for-companies and /for-hrbps footers)
  // and handles its own signed-out state — its CTAs route anonymous visitors
  // to /signup?type=company. Walling it behind login dead-ends prospects.
  const publicExceptions = ['/company/pricing']
  const isProtected = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  ) && !publicExceptions.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    // Preserve the intended destination so /login can send the user back
    // after they authenticate (login validates it starts with '/').
    const next = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
