import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { TABLES } from "@/lib/supabase/types";

/**
 * /u/[username] — redirects to the user's first shelf.
 */
export default async function UserProfileRedirect({ params }) {
  const { username } = await params;
  const supabase = await createClient();

  // Look up profile by username
  const { data: profile } = await supabase
    .from(TABLES.PROFILES)
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();

  // Private profiles are gated in layout.jsx: the owner and accepted
  // followers see the bookcase, everyone else gets the request-to-follow page.
  // Redirecting here as well would bounce both of those to the home page.

  // Get first shelf to redirect to
  const { data: shelves } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("slug")
    .eq("user_id", profile.id)
    .order("display_order", { ascending: true })
    .limit(1);

  const firstSlug = shelves?.[0]?.slug || "all";
  redirect(`/u/${encodeURIComponent(username)}/${firstSlug}`);
}
