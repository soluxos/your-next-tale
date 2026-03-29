import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import BookshelvesClient from "./BookshelvesClient";
import { getUserShelves } from "@/lib/bookshelves";
import { TABLES } from "@/lib/supabase/types";

export const metadata = {
  title: "My Bookshelves | Your Next Tale",
};

export default async function BookshelvesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const shelves = await getUserShelves(supabase, user.id);

  // For each shelf, fetch its books
  const shelvesWithBooks = await Promise.all(
    shelves.map(async (shelf) => {
      const { data: shelfBooks } = await supabase
        .from(TABLES.BOOKSHELF_BOOKS)
        .select(`
          id,
          user_book_id,
          user_books (
            id,
            book_id,
            rating,
            books (id, title, authors, cover_url)
          )
        `)
        .eq("bookshelf_id", shelf.id);

      const books = (shelfBooks || [])
        .map((sb) => sb.user_books?.books)
        .filter(Boolean);

      return { ...shelf, books };
    })
  );

  return <BookshelvesClient shelves={shelvesWithBooks} userId={user.id} />;
}
