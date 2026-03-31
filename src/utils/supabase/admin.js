import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the service role key.
 * Bypasses RLS — use only in server-side admin API routes.
 * NEVER import this in client components or expose to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!serviceKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
