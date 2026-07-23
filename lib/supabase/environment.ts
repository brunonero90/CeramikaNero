import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const publicEnv = publicEnvSchema.safeParse(process.env);
export const serverEnv = serverEnvSchema.safeParse(process.env);

export function requirePublicEnv() {
  if (!publicEnv.success) {
    throw new Error(
      "Missing Supabase public environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }
  return publicEnv.data;
}

export function requireServerEnv() {
  if (!publicEnv.success || !serverEnv.success) {
    throw new Error(
      "Missing Supabase environment variables. Public URL/anon key and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }
  return { ...publicEnv.data, ...serverEnv.data };
}
