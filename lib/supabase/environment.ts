import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

/**
 * Read public env with static `process.env.NEXT_PUBLIC_*` property access so
 * Next.js can inline values into the client bundle. Passing whole `process.env`
 * into Zod fails in the browser (dynamic lookup → empty client env).
 */
function readPublicEnvInput() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

function readServerEnvInput() {
  return {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  };
}

export function parsePublicEnv() {
  return publicEnvSchema.safeParse(readPublicEnvInput());
}

export function parseServerEnv() {
  return serverEnvSchema.safeParse(readServerEnvInput());
}

/** @deprecated Prefer parsePublicEnv() — module-level parse is not client-safe. */
export const publicEnv = parsePublicEnv();

/** @deprecated Prefer parseServerEnv(). */
export const serverEnv = parseServerEnv();

export function requirePublicEnv() {
  const parsed = parsePublicEnv();
  if (!parsed.success) {
    throw new Error(
      'Missing Supabase public environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.'
    );
  }
  return parsed.data;
}

export function requireServerEnv() {
  const pub = parsePublicEnv();
  const srv = parseServerEnv();
  if (!pub.success || !srv.success) {
    throw new Error(
      'Missing Supabase environment variables. Public URL/publishable key and SUPABASE_SECRET_KEY are required.'
    );
  }
  return { ...pub.data, ...srv.data };
}
