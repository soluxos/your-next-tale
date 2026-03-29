import { redirect } from "next/navigation";
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
    .select("id, is_private")
    .eq("username", username)
    .single();

  if (!profile) {
    redirect("/");
  }

  // Privacy check — only the owner can view a private profile
  if (profile.is_private) {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user || user.id !== profile.id) {
      redirect("/");
    }
  }

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
