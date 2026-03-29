import { createClient } from "@supabase/supabase-js";

// Create a Supabase client for static generation (no cookies needed)
// This should only be used in generateStaticParams and generateMetadata
export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}
