import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ReviewModal from "@/components/shelves/ReviewModal";

export default async function InterceptedReviewPage({ params }) {
  const { username, shelfSlug, bookId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, facehash_color")
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();

  const { data: userBook } = await supabase
    .from("user_books")
    .select(
      `
      id, rating, review,
      book:book_id (
        id, title, authors, cover_url, isbn_13, description, page_count, published_date, genres
      )
    `
    )
    .eq("user_id", profile.id)
    .eq("book_id", bookId)
    .maybeSingle();

  if (!userBook) notFound();

  return (
    <ReviewModal
      userBook={userBook}
      profile={profile}
      username={username}
      shelfSlug={shelfSlug}
    />
  );
}
