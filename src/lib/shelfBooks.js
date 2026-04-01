import { TABLES } from "@/lib/supabase/types";
import { getOrCreateUserBook } from "@/lib/userBooks";
import { recordActivity } from "@/lib/activities";

/**
 * Add a book to a shelf.
 * - Ensures a user_books row exists.
 * - If the target shelf is exclusive, removes the book from all other
 *   exclusive shelves for this user before inserting.
 */
export async function addBookToShelf(supabase, userId, bookId, shelfId) {
  // 1. Ensure user_books row
  const userBook = await getOrCreateUserBook(supabase, userId, bookId);

  // 2. Fetch target shelf (including name for activity snapshot)
  const { data: shelf, error: shelfErr } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("id, name, is_exclusive")
    .eq("id", shelfId)
    .single();

  if (shelfErr) throw shelfErr;

  // 3. If exclusive, remove from any other exclusive shelves
  let previousShelfId = null;
  let previousShelfName = null;
  if (shelf.is_exclusive) {
    // Find current exclusive shelf (for move detection)
    const { data: exclusiveShelves } = await supabase
      .from(TABLES.BOOKSHELVES)
      .select("id, name")
      .eq("user_id", userId)
      .eq("is_exclusive", true);

    const exclusiveIds = (exclusiveShelves || []).map((s) => s.id);

    if (exclusiveIds.length > 0) {
      // Check if already on an exclusive shelf (this would be a move)
      const { data: existingEntry } = await supabase
        .from(TABLES.BOOKSHELF_BOOKS)
        .select("bookshelf_id")
        .eq("user_book_id", userBook.id)
        .in("bookshelf_id", exclusiveIds)
        .single();

      if (
        existingEntry?.bookshelf_id &&
        existingEntry.bookshelf_id !== shelfId
      ) {
        previousShelfId = existingEntry.bookshelf_id;
        const prevShelf = exclusiveShelves.find(
          (s) => s.id === previousShelfId
        );
        previousShelfName = prevShelf?.name || null;
      }

      await supabase
        .from(TABLES.BOOKSHELF_BOOKS)
        .delete()
        .eq("user_book_id", userBook.id)
        .in("bookshelf_id", exclusiveIds);
    }
  }

  // 4. Insert into bookshelf_books
  const { data, error } = await supabase
    .from(TABLES.BOOKSHELF_BOOKS)
    .upsert(
      { bookshelf_id: shelfId, user_book_id: userBook.id },
      { onConflict: "bookshelf_id,user_book_id" }
    )
    .select()
    .single();

  if (error) throw error;

  // 5. Fetch book data for activity snapshot
  const { data: book } = await supabase
    .from(TABLES.BOOKS)
    .select("id, title, cover_url, isbn_13")
    .eq("id", bookId)
    .single();

  const isMove = !!previousShelfId;
  recordActivity(supabase, {
    userId,
    type: isMove ? "shelf_move" : "shelf_add",
    bookId: book?.id,
    shelfId: shelf.id,
    fromShelfId: previousShelfId,
    userBookId: userBook.id,
    bookTitle: book?.title,
    bookCoverUrl: book?.cover_url,
    bookIsbn13: book?.isbn_13,
    shelfName: shelf.name,
    fromShelfName: previousShelfName
  });

  return data;
}

/**
 * Remove a book from a shelf.
 * If the user_book is no longer on any shelf, also delete the user_books row.
 */
export async function removeBookFromShelf(supabase, userBookId, shelfId) {
  const { error } = await supabase
    .from(TABLES.BOOKSHELF_BOOKS)
    .delete()
    .eq("user_book_id", userBookId)
    .eq("bookshelf_id", shelfId);

  if (error) throw error;

  // Check if the user_book is still on any shelf
  const { data: remaining } = await supabase
    .from(TABLES.BOOKSHELF_BOOKS)
    .select("id")
    .eq("user_book_id", userBookId)
    .limit(1);

  if (!remaining || remaining.length === 0) {
    await supabase.from(TABLES.USER_BOOKS).delete().eq("id", userBookId);
  }
}

/**
 * Get all books on a shelf, joined with book and user_book data.
 */
export async function getShelfBooks(supabase, shelfId) {
  const { data, error } = await supabase
    .from(TABLES.BOOKSHELF_BOOKS)
    .select(
      `
      id,
      bookshelf_id,
      user_books (
        id,
        book_id,
        rating,
        review,
        progress_pages,
        progress_percent,
        date_started,
        date_finished,
        books (*)
      )
    `
    )
    .eq("bookshelf_id", shelfId);

  if (error) throw error;

  return (data || [])
    .map((sb) => {
      const ub = sb.user_books;
      if (!ub?.books) return null;
      return {
        ...ub.books,
        bookshelf_id: sb.bookshelf_id,
        userBook: {
          id: ub.id,
          rating: ub.rating,
          review: ub.review,
          progress_pages: ub.progress_pages,
          progress_percent: ub.progress_percent,
          date_started: ub.date_started,
          date_finished: ub.date_finished
        }
      };
    })
    .filter(Boolean);
}
