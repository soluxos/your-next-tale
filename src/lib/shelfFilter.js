/**
 * Filter an array of shelfBook objects by the given filter state.
 *
 * filters shape:
 * {
 *   genres: string[]         — book must have ALL matching genres (case-insensitive)
 *   minPages: number|''      — book.page_count >= minPages
 *   maxPages: number|''      — book.page_count <= maxPages
 *   minRating: number|0      — user_book.rating >= minRating (0 = no filter)
 *   hasReview: boolean       — only books with a written review
 * }
 */
export function filterShelfBooks(books, filters) {
  return books.filter((shelfBook) => {
    const book = shelfBook.book || {};
    const userBook = shelfBook.user_book || {};

    // Genre filter — ALL typed genres must appear in the book's genres array
    if (filters.genres?.length) {
      const bookGenres = (book.genres || []).map((g) => g.toLowerCase());
      const matches = filters.genres.every((fg) =>
        bookGenres.some((bg) => bg.includes(fg.toLowerCase()))
      );
      if (!matches) return false;
    }

    // Page count filters
    if (filters.minPages !== "" && filters.minPages !== undefined) {
      const min = parseInt(filters.minPages, 10);
      if (!isNaN(min) && (book.page_count || 0) < min) return false;
    }
    if (filters.maxPages !== "" && filters.maxPages !== undefined) {
      const max = parseInt(filters.maxPages, 10);
      if (!isNaN(max) && book.page_count && book.page_count > max) return false;
    }

    // Minimum rating filter
    if (filters.minRating && filters.minRating > 0) {
      const rating = userBook.rating || 0;
      if (rating < filters.minRating) return false;
    }

    // Has review filter
    if (filters.hasReview) {
      if (!userBook.review?.trim()) return false;
    }

    return true;
  });
}

/**
 * Returns true if any filter is active (i.e. would actually reduce results).
 */
export function hasActiveFilters(filters) {
  return (
    filters.genres?.length > 0 ||
    (filters.minPages !== "" && filters.minPages !== undefined) ||
    (filters.maxPages !== "" && filters.maxPages !== undefined) ||
    filters.minRating > 0 ||
    filters.hasReview
  );
}

export const DEFAULT_FILTERS = {
  genres: [],
  minPages: "",
  maxPages: "",
  minRating: 0,
  hasReview: false
};
