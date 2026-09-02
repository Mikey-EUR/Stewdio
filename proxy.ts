import { type NextRequest, NextResponse } from 'next/server';

/**
 * Session-refresh proxy (Next.js 16 replacement for middleware).
 * Only runs on page/API routes, not on static assets.
 */
export async function proxy(request: NextRequest) {
  const t0 = performance.now();
  const pathname = request.nextUrl.pathname;

  // When Supabase is configured, refresh the session cookie so server
  // components always get a fresh token.  We do the exchange lazily to
  // keep the cold-start cost low.
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Not configured yet — just pass through
    return NextResponse.next();
  }

  const { createServerClient } = await import('@supabase/ssr');
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims() verifies the JWT locally (via the project's cached JWKS)
  // instead of always calling the Auth server like getUser() does — this
  // removes a network round trip from every navigation when the project
  // uses asymmetric JWT signing keys, while keeping the same trust
  // guarantees (falls back to a server call automatically otherwise).
  const authT0 = performance.now();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;
  console.log(`[proxy] ${pathname} — getClaims took ${Math.round(performance.now() - authT0)}ms`);

  const isLoginRoute = pathname === '/login';
  const isAuthRoute = pathname.startsWith('/auth/');

  if (!user && !isLoginRoute && !isAuthRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    console.log(`[proxy] ${pathname} — redirect to /login, total ${Math.round(performance.now() - t0)}ms`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    console.log(`[proxy] ${pathname} — redirect to /, total ${Math.round(performance.now() - t0)}ms`);
    return NextResponse.redirect(homeUrl);
  }

  console.log(`[proxy] ${pathname} — passthrough, total ${Math.round(performance.now() - t0)}ms`);
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

