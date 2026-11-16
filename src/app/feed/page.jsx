import { createClient } from "@/utils/supabase/server";
import { getFeed } from "@/lib/activities";
import { getSuggestedReaders } from "@/lib/suggestions";
import { generateBookSlug } from "@/lib/slugify";
import { redirect } from "next/navigation";
import FeedClient from "./FeedClient";

export const metadata = {
  title: "Feed | Your Next Tale"
};

const PAGE_SIZE = 30;

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/feed");

  const [page, suggested, { count: followingCount }, { data: viewer }] = await Promise.all([
    loadPage(supabase, user.id, 0),
    getSuggestedReaders(supabase, user.id),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", user.id)
      .eq("status", "accepted"),
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
  ]);

  async function loadMore(offset) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { activities: [], hasMore: false };
    return loadPage(supabase, user.id, Math.max(0, Number(offset) || 0));
  }

  return (
    <div className="FeedPage page-x pt-8 sm:pt-12 pb-24">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="font-ppMondwest text-ink text-[36px] sm:text-[44px] leading-none">Feed</h1>
          <p className="font-ppMondwest text-[17px] text-textSecondary mt-2">
            What the readers you follow are starting, finishing and reviewing.
          </p>
        </header>
        <FeedClient
          initialActivities={page.activities}
          initialHasMore={page.hasMore}
          pageSize={PAGE_SIZE}
          loadMore={loadMore}
          suggested={suggested}
          followingCount={followingCount || 0}
          viewerUsername={viewer?.username || null}
        />
      </div>
    </div>
  );
}

/**
 * One page of raw activity (getFeed groups it; the client regroups across
 * pages), with book slugs, authors and shelf slugs attached so rows can
 * link out.
 */
async function loadPage(supabase, userId, offset) {
  const groups = await getFeed(supabase, userId, { limit: PAGE_SIZE, offset });
  const activities = groups.flatMap((g) => g.activities);
  if (!activities.length) return { activities, hasMore: false };

  const bookIds = [...new Set(activities.map((a) => a.book_id).filter(Boolean))];
  const shelfIds = [
    ...new Set(activities.filter((a) => a.activity_type === "shelf_create").map((a) => a.shelf_id).filter(Boolean))
  ];
  const [{ data: books }, { data: shelves }] = await Promise.all([
    bookIds.length
      ? supabase.from("books").select("id, title, authors").in("id", bookIds)
      : { data: [] },
    shelfIds.length
      ? supabase.from("bookshelves").select("id, slug").in("id", shelfIds)
      : { data: [] }
  ]);
  const bookById = new Map((books || []).map((b) => [b.id, b]));
  const shelfSlugById = new Map((shelves || []).map((s) => [s.id, s.slug]));

  return {
    // getFeed counts raw rows, so a full page means there may be more
    hasMore: activities.length === PAGE_SIZE,
    activities: activities.map((a) => {
      const book = bookById.get(a.book_id);
      return {
        ...a,
        // Same slug the book page resolves (title + first author)
        book_slug: book ? generateBookSlug(book.title, book.authors?.[0]) : null,
        book_author: book?.authors?.[0] || null,
        shelf_slug: shelfSlugById.get(a.shelf_id) || null
      };
    })
  };
}
