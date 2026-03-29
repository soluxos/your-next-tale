import { createClient } from "@/utils/supabase/server";
import { TABLES } from "@/lib/supabase/types";
import PublicShelvesClient from "./PublicShelvesClient";

export async function generateMetadata({ params }) {
  const { username } = await params;
  return {
    title: `${username}'s Shelves | Your Next Tale`
  };
}

export default async function PublicShelvesPage({ params }) {
  const { username } = await params;
  const supabase = await createClient();

  // Look up the profile by username
  const { data: profile, error: profileError } = await supabase
    .from(TABLES.PROFILES)
    .select("id, username, is_private")
    .eq("username", username)
    .single();

  if (profileError || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">User not found.</p>
      </div>
    );
  }

  // Check if the viewer is the owner
  const {
    data: { user: viewer }
  } = await supabase.auth.getUser();

  const isOwner = viewer?.id === profile.id;

  // If private and not owner, show private message
  if (profile.is_private && !isOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-2xl">🔒</p>
          <p className="text-muted-foreground">This profile is private.</p>
        </div>
      </div>
    );
  }

  // Fetch all bookshelves for this user
  const { data: shelves } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("*")
    .eq("user_id", profile.id)
    .order("display_order", { ascending: true });

  const shelvesWithBooks = await Promise.all(
    (shelves || []).map(async (shelf) => {
      const { data: shelfBooks } = await supabase
        .from(TABLES.BOOKSHELF_BOOKS)
        .select(
          `
          id,
          user_book_id,
          user_books (
            id,
            rating,
            review,
            progress_pages,
            progress_percent,
            date_started,
            date_finished,
            books (id, title, authors, cover_url, page_count, description)
          )
        `
        )
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
            date_finished: sb.user_books?.date_finished
          }
        }))
        .filter((b) => b.id);

      return { ...shelf, books };
    })
  );

  return (
    <PublicShelvesClient
      username={profile.username}
      shelves={shelvesWithBooks}
    />
  );
}
