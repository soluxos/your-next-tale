import { createClient } from "@/utils/supabase/server";
import { TABLES } from "@/lib/supabase/types";
import { redirect } from "next/navigation";
import ShelfView from "./ShelfView";

export default async function ShelfPage({ params }) {
  const { username, shelfSlug } = await params;
  const supabase = await createClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from(TABLES.PROFILES)
    .select("id, is_private")
    .eq("username", username)
    .single();

  if (!profile) redirect("/");

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  if (profile.is_private && !isOwner) redirect("/");

  // Fetch all shelves for the user (needed for BookDetailPanel shelf selector)
  const { data: shelves } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("id, name, slug, is_default, is_exclusive")
    .eq("user_id", profile.id)
    .order("display_order", { ascending: true });

  // Virtual "all" shelf — fetch every user_book
  let books = [];
  let shelfId = null;
  let shelfName = "All Books";

  if (shelfSlug === "all") {
    const { data: userBooks } = await supabase
      .from(TABLES.USER_BOOKS)
      .select(
        `
        id,
        book_id,
        rating,
        review,
        progress_pages,
        progress_percent,
        date_started,
        date_finished,
        books (*)
      `
      )
      .eq("user_id", profile.id);

    books = (userBooks || []).map((ub) => ({
      ...ub.books,
      userBook: {
        id: ub.id,
        rating: ub.rating,
        review: ub.review,
        progress_pages: ub.progress_pages,
        progress_percent: ub.progress_percent,
        date_started: ub.date_started,
        date_finished: ub.date_finished
      }
    }));
  } else {
    // Find the shelf by slug
    const { data: shelf } = await supabase
      .from(TABLES.BOOKSHELVES)
      .select("id, name, slug")
      .eq("user_id", profile.id)
      .eq("slug", shelfSlug)
      .single();

    if (!shelf) redirect(`/u/${encodeURIComponent(username)}`);

    shelfId = shelf.id;
    shelfName = shelf.name;

    // Fetch books on this shelf
    const { data: shelfBooks } = await supabase
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
      .eq("bookshelf_id", shelf.id);

    books = (shelfBooks || [])
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

  return (
    <ShelfView
      books={books}
      shelfName={shelfName}
      shelfId={shelfId}
      shelfSlug={shelfSlug}
      isOwner={isOwner}
      userId={profile.id}
      shelves={shelves || []}
    />
  );
}
