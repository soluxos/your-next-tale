import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { TABLES } from "@/lib/supabase/types";
import ShelfViewClient from "./ShelfViewClient";

export async function generateMetadata({ params }) {
  const { shelfSlug } = await params;
  return {
    title: `${shelfSlug.replace(/-/g, " ")} | Your Next Tale`,
  };
}

export default async function ShelfPage({ params }) {
  const { shelfSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the shelf by slug + user
  const { data: shelf, error: shelfError } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("*")
    .eq("user_id", user.id)
    .eq("slug", shelfSlug)
    .single();

  if (shelfError || !shelf) {
    redirect("/bookshelves");
  }

  // Fetch books on this shelf
  const { data: shelfBooks } = await supabase
    .from(TABLES.BOOKSHELF_BOOKS)
    .select(`
      id,
      user_book_id,
      user_books (
        id,
        book_id,
        rating,
        review,
        progress_pages,
        progress_percent,
        date_started,
        date_finished,
        books (id, title, authors, cover_url, page_count, description)
      )
    `)
    .eq("bookshelf_id", shelf.id);

  const books = (shelfBooks || [])
    .map((sb) => ({
      ...sb.user_books?.books,
      userBook: {
        id: sb.user_books?.id,
        rating: sb.user_books?.rating,
        review: sb.user_books?.review,
        progress_pages: sb.user_books?.progress_pages,
        progress_percent: sb.user_books?.progress_percent,
        date_started: sb.user_books?.date_started,
        date_finished: sb.user_books?.date_finished,
      },
    }))
    .filter((b) => b.id);

  return (
    <ShelfViewClient shelf={shelf} books={books} userId={user.id} />
  );
}
