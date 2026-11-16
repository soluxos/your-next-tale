/** A handful of catalogue covers to dress marketing / auth pages. */
export async function getShowcaseBooks(supabase, count = 6) {
  const { data } = await supabase
    .from("books")
    .select("id, title, authors, cover_url")
    .not("cover_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(48);
  const books = data || [];
  // Spread the picks across the list so one series doesn't fill the shelf.
  const step = Math.max(1, Math.floor(books.length / count));
  return Array.from({ length: Math.min(count, books.length) }, (_, i) => books[i * step]).filter(Boolean);
}
