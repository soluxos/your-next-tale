/**
 * Public readers worth following: people with books on their shelves whom the
 * viewer doesn't already follow, busiest bookcases first, each with a few
 * recent covers to show what they read.
 */
export async function getSuggestedReaders(supabase, userId, { limit = 6 } = {}) {
  const { data: followRows } = userId
    ? await supabase.from("follows").select("following_id").eq("follower_id", userId)
    : { data: [] };
  const exclude = new Set([userId, ...(followRows || []).map((f) => f.following_id)].filter(Boolean));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, facehash_color, bio")
    .eq("is_private", false)
    .not("username", "is", null)
    .limit(60);

  const candidates = (profiles || []).filter((p) => !exclude.has(p.id));
  if (!candidates.length) return [];

  const { data: rows } = await supabase
    .from("user_books")
    .select("user_id, created_at, books (id, title, cover_url)")
    .in(
      "user_id",
      candidates.map((p) => p.id)
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  const byUser = new Map();
  for (const row of rows || []) {
    const entry = byUser.get(row.user_id) || { count: 0, covers: [] };
    entry.count += 1;
    if (row.books?.cover_url && entry.covers.length < 3) entry.covers.push(row.books);
    byUser.set(row.user_id, entry);
  }

  return candidates
    .map((p) => ({ ...p, bookCount: byUser.get(p.id)?.count || 0, covers: byUser.get(p.id)?.covers || [] }))
    .filter((p) => p.bookCount > 0)
    .sort((a, b) => b.bookCount - a.bookCount)
    .slice(0, limit);
}
