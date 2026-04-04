import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ReviewModal from "@/components/shelves/ReviewModal";

// ShelfView is always rendered by [shelfSlug]/layout.jsx above this page.
// This page only needs to render the modal on top of it.

export async function generateMetadata({ params }) {
  const { username } = await params;
  return { title: `Review by ${username} | Your Next Tale` };
}

export default async function StandaloneReviewPage({ params }) {
  const { username, shelfSlug, bookId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, facehash_color")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const { data: userBook } = await supabase
    .from("user_books")
    .select(
      `
      id, rating, review,
      book:book_id (
        id, title, authors, cover_url, isbn_13, description
      )
    `
    )
    .eq("user_id", profile.id)
    .eq("book_id", bookId)
    .single();

  if (!userBook || (!userBook.rating && !userBook.review)) notFound();

  return (
    <ReviewModal
      userBook={userBook}
      profile={profile}
      username={username}
      shelfSlug={shelfSlug}
      closeHref={`/u/${username}/${shelfSlug}`}
    />
  );
}
