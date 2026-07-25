import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { requirePublicEnv } from '@/lib/supabase/environment';

/**
 * Next.js 16 request proxy for the Ceramika Nero admin area.
 *
 * - Refreshes the Supabase Auth session cookie on every admin request.
 * - Redirects unauthenticated visitors away from protected /admin routes.
 * - Login, forgot-password and reset-password routes are allowed through so
 *   the authentication flow can complete.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith('/admin');
  const isPublicAdminRoute =
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/admin/forgot-password') ||
    pathname.startsWith('/admin/reset-password') ||
    // Local booking admin is gated by LOCAL_ADMIN_SECRET inside the page —
    // never enabled when NODE_ENV=production (see lib/booking/local-mode).
    pathname.startsWith('/admin/local');

  if (!isAdminRoute) {
    return response;
  }

  if (pathname.startsWith('/admin/local')) {
    return response;
  }

  const env = requirePublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Validate JWT with the Auth server (do not trust getSession() alone).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPublicAdminRoute && !user) {
    const loginUrl = new URL('/admin/login', request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
