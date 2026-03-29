import { TABLES } from "@/lib/supabase/types";

/**
 * Get or create a user_books row for a given user + book.
 * Uses the unique(user_id, book_id) constraint.
 */
export async function getOrCreateUserBook(supabase, userId, bookId) {
  const { data, error } = await supabase
    .from(TABLES.USER_BOOKS)
    .upsert(
      { user_id: userId, book_id: bookId },
      { onConflict: "user_id,book_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Partial update of a user_books row.
 * Handles progress_pages <-> progress_percent calculation when page_count is known.
 *
 * @param {object} fields - May include rating, review, progress_pages,
 *   progress_percent, date_started, date_finished.
 * @param {number|null} pageCount - The book's total page count (for progress calc).
 */
export async function updateUserBook(
  supabase,
  userBookId,
  fields,
  pageCount = null
) {
  const update = { ...fields };

  if (pageCount && pageCount > 0) {
    if (update.progress_pages != null && update.progress_percent == null) {
      update.progress_percent = Math.round(
        (update.progress_pages / pageCount) * 100
      );
    } else if (
      update.progress_percent != null &&
      update.progress_pages == null
    ) {
      update.progress_pages = Math.round(
        (update.progress_percent / 100) * pageCount
      );
    }
  }

  const { data, error } = await supabase
    .from(TABLES.USER_BOOKS)
    .update(update)
    .eq("id", userBookId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Returns the user_books row joined with the current exclusive shelf
 * the book sits on (if any).
 */
export async function getUserBookWithShelf(supabase, userId, bookId) {
  // First get the user_book
  const { data: userBook, error: ubError } = await supabase
    .from(TABLES.USER_BOOKS)
    .select("*")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single();

  if (ubError) {
    if (ubError.code === "PGRST116") return null; // not found
    throw ubError;
  }

  // Find the exclusive shelf this book is on
  const { data: shelfBooks } = await supabase
    .from(TABLES.BOOKSHELF_BOOKS)
    .select(
      `
      id,
      bookshelf_id,
      bookshelves (id, name, slug, is_exclusive)
    `
    )
    .eq("user_book_id", userBook.id);

  const exclusiveShelf =
    shelfBooks?.find((sb) => sb.bookshelves?.is_exclusive)?.bookshelves || null;

  return { ...userBook, exclusiveShelf };
}
