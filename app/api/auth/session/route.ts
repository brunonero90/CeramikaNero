import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requirePublicEnv } from '@/lib/supabase/environment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Persist a browser-established Supabase session into HttpOnly cookies that
 * Server Components, Server Actions and proxy.ts can read reliably.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { access_token?: string; refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const accessToken = body.access_token?.trim();
  const refreshToken = body.refresh_token?.trim();
  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { error: 'access_token and refresh_token are required' },
      { status: 400 }
    );
  }

  const env = requirePublicEnv();
  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    console.error('[auth/session] setSession failed', error.message);
    return NextResponse.json(
      { error: 'Nie udało się zapisać sesji.' },
      { status: 401 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Sesja nie została utworzona.' },
      { status: 401 }
    );
  }

  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const env = requirePublicEnv();
  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.signOut();
  return response;
}
