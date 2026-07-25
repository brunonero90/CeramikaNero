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
  const response = NextResponse.next({
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
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!isPublicAdminRoute && !session) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
