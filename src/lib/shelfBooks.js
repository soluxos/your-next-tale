import { TABLES } from "@/lib/supabase/types";
import { getOrCreateUserBook } from "@/lib/userBooks";
import { recordActivity } from "@/lib/activities";

/**
 * Add a book to a shelf.
 * - Ensures a user_books row exists.
 * - If the target shelf is exclusive, removes the book from all other
 *   exclusive shelves for this user before inserting.
 * - `silent` skips the feed activity (imports add hundreds of books at once).
 */
export async function addBookToShelf(
  supabase,
  userId,
  bookId,
  shelfId,
  { silent = false } = {}
) {
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

  // 4. New books go to the front of the shelf. Rather than bumping every
  //    existing row (one request per book), take a position just before the
  //    current first one — "user" sort is ascending, so it lands on top.
  const { data: first } = await supabase
    .from(TABLES.BOOKSHELF_BOOKS)
    .select("position")
    .eq("bookshelf_id", shelfId)
    .not("position", "is", null)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const position = first?.position != null ? first.position - 1 : 1;

  // 5. Insert into bookshelf_books (re-adding moves it to the front)
  const { data, error } = await supabase
    .from(TABLES.BOOKSHELF_BOOKS)
    .upsert(
      { bookshelf_id: shelfId, user_book_id: userBook.id, position },
      { onConflict: "bookshelf_id,user_book_id" }
    )
    .select()
    .single();

  if (error) throw error;

  const result = { ...data, user_book: userBook, previous_shelf_id: previousShelfId };
  if (silent) return result;

  // 6. Fetch book data for activity snapshot
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

  return result;
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
    const { error: ubErr } = await supabase
      .from(TABLES.USER_BOOKS)
      .delete()
      .eq("id", userBookId);
    if (ubErr) throw ubErr;
  }
}

/**
 * Remove a book from the user's library entirely — every shelf, plus the
 * user_books row (rating, review, progress).
 */
export async function removeBookFromLibrary(supabase, userBookId) {
  // Delete the library row first: if it goes, its shelf links go with it,
  // and if it can't, nothing has changed. Deleting the links first could
  // leave a book in your library on no shelf at all.
  const first = await supabase
    .from(TABLES.USER_BOOKS)
    .delete()
    .eq("id", userBookId)
    .select("id");
  if (!first.error && first.data?.length) return;
  if (!first.error) {
    throw new Error("This book couldn’t be removed from your library. Please try again.");
  }
  const blockedByLinks =
    first.error.code === "23503" &&
    /bookshelf_books/.test(`${first.error.message} ${first.error.details || ""}`);
  if (!blockedByLinks) throw first.error;

  // Shelf links block the delete (no cascade) — remove them, then retry.
  const { error: linkErr } = await supabase
    .from(TABLES.BOOKSHELF_BOOKS)
    .delete()
    .eq("user_book_id", userBookId);
  if (linkErr) throw linkErr;

  const { data, error } = await supabase
    .from(TABLES.USER_BOOKS)
    .delete()
    .eq("id", userBookId)
    .select("id");
  if (error) throw error;
  if (!data?.length) {
    throw new Error("This book couldn’t be removed from your library. Please try again.");
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
