import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ReviewModal from "@/components/shelves/ReviewModal";

// On a hard-refresh of the review URL, [shelfSlug]/layout.jsx renders ShelfView
// as the background. This page only needs to supply the ReviewModal on top of it.
// Normal in-app navigation never reaches this page — the modal is opened as
// client-side state in ShelfView via window.history.pushState.

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
