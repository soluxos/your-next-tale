import { TABLES } from "@/lib/supabase/types";

/**
 * Fetch a public profile by username.
 */
export async function getProfileByUsername(supabase, username) {
  const { data, error } = await supabase
    .from(TABLES.PROFILES)
    .select("id, full_name, username, avatar_url, bio, is_private")
    .eq("username", username)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data;
}

/**
 * Fetch all shelves for a profile, with a book count for each shelf.
 */
export async function getProfileShelves(supabase, userId) {
  const { data: shelves, error } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("id, name, slug, is_default, is_exclusive, display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  if (error) throw error;

  // Fetch book counts per shelf
  const withCounts = await Promise.all(
    (shelves || []).map(async (shelf) => {
      const { count } = await supabase
        .from(TABLES.BOOKSHELF_BOOKS)
        .select("id", { count: "exact", head: true })
        .eq("bookshelf_id", shelf.id);

      return { ...shelf, bookCount: count || 0 };
    })
  );

  return withCounts;
}
