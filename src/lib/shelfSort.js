/**
 * Sort an array of shelfBook objects (each has .position, .book, .user_book)
 * according to the given sort key.
 *
 * 'user'       — by position asc (the owner's saved order)
 * 'date_added' — by user_book.created_at desc (newest first)
 * 'rating'     — by user_book.rating desc, unrated books last
 * 'az'         — by book.title asc, case-insensitive
 * 'za'         — by book.title desc, case-insensitive
 * 'finished'   — most recently finished first, unfinished last
 * 'short'      — fewest pages first, unknown length last
 * 'long'       — most pages first, unknown length last
 * 'author'     — by first author's surname
 */
const surname = (b) => {
  const name = (b.book?.authors?.[0] || "").trim();
  const parts = name.split(/\s+/);
  return `${parts[parts.length - 1] || ""} ${name}`.toLowerCase();
};
// Missing values always sort after real ones, whichever direction.
const byValue = (get, dir) => (a, b) => {
  const va = get(a);
  const vb = get(b);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return dir * (va > vb ? 1 : va < vb ? -1 : 0);
};
export function sortShelfBooks(books, sortKey) {
  const copy = [...books];

  switch (sortKey) {
    case "user":
      return copy.sort((a, b) => {
        const pa = a.position ?? Infinity;
        const pb = b.position ?? Infinity;
        return pa - pb;
      });

    case "date_added":
      return copy.sort(
        (a, b) =>
          new Date(b.user_book?.created_at || 0) -
          new Date(a.user_book?.created_at || 0)
      );

    case "rating":
      return copy.sort((a, b) => {
        const ra = a.user_book?.rating ?? 0;
        const rb = b.user_book?.rating ?? 0;
        return rb - ra; // desc — highest rating first
      });

    case "az":
      return copy.sort((a, b) =>
        (a.book?.title || "")
          .toLowerCase()
          .localeCompare((b.book?.title || "").toLowerCase())
      );

    case "za":
      return copy.sort((a, b) =>
        (b.book?.title || "")
          .toLowerCase()
          .localeCompare((a.book?.title || "").toLowerCase())
      );

    case "finished":
      return copy.sort(byValue((x) => x.user_book?.date_finished || null, -1));

    case "short":
      return copy.sort(byValue((x) => x.book?.page_count || null, 1));

    case "long":
      return copy.sort(byValue((x) => x.book?.page_count || null, -1));

    case "author":
      return copy.sort((a, b) => surname(a).localeCompare(surname(b)));

    default:
      return copy;
  }
}
