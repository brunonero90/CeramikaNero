import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { isBookingLocalMode } from './local-mode';

const COOKIE_NAME = 'cn_local_admin';

function expectedToken(): string | null {
  const secret = process.env.LOCAL_ADMIN_SECRET;
  if (!secret || secret.length < 8) return null;
  return createHash('sha256')
    .update(`ceramika-local-admin:${secret}`)
    .digest('hex');
}

export function isLocalAdminConfigured(): boolean {
  return Boolean(
    process.env.LOCAL_ADMIN_SECRET && process.env.LOCAL_ADMIN_SECRET.length >= 8
  );
}

export async function isLocalAdminAuthenticated(): Promise<boolean> {
  if (!isBookingLocalMode() || process.env.NODE_ENV === 'production') {
    return false;
  }
  const expected = expectedToken();
  if (!expected) return false;
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (!value) return false;
  try {
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function authenticateLocalAdmin(
  password: string
): Promise<boolean> {
  if (!isBookingLocalMode() || process.env.NODE_ENV === 'production') {
    return false;
  }
  const secret = process.env.LOCAL_ADMIN_SECRET;
  if (!secret || secret.length < 8) return false;
  const ok =
    password.length === secret.length &&
    timingSafeEqual(Buffer.from(password), Buffer.from(secret));
  if (!ok) return false;
  const token = expectedToken();
  if (!token) return false;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/admin/local',
    maxAge: 60 * 60 * 12,
  });
  return true;
}

export async function clearLocalAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
