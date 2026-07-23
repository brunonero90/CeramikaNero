import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export const publicEnv = publicEnvSchema.safeParse(process.env);
export const serverEnv = serverEnvSchema.safeParse(process.env);

export function parsePublicEnv() {
  return publicEnvSchema.safeParse(process.env);
}

export function parseServerEnv() {
  return serverEnvSchema.safeParse(process.env);
}

export function requirePublicEnv() {
  if (!publicEnv.success) {
    throw new Error(
      'Missing Supabase public environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.'
    );
  }
  return publicEnv.data;
}

export function requireServerEnv() {
  if (!publicEnv.success || !serverEnv.success) {
    throw new Error(
      'Missing Supabase environment variables. Public URL/publishable key and SUPABASE_SECRET_KEY are required.'
    );
  }
  return { ...publicEnv.data, ...serverEnv.data };
}
