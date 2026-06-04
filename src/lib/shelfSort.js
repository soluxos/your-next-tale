/**
 * Sort an array of shelfBook objects (each has .position, .book, .user_book)
 * according to the given sort key.
 *
 * 'user'       — by position asc (the owner's saved order)
 * 'date_added' — by user_book.created_at desc (newest first)
 * 'rating'     — by user_book.rating desc, unrated books last
 * 'az'         — by book.title asc, case-insensitive
 * 'za'         — by book.title desc, case-insensitive
 */
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

    default:
      return copy;
  }
}
