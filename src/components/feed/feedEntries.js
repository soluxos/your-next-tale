/**
 * Turns the flat activity list from getFeed into what the feed renders:
 *
 *   groups  – one per reader, for a run of their activity within 30 minutes
 *   entries – one per book inside a group, so "moved to Read", "rated" and
 *             "reviewed" on the same book read as a single sentence
 *
 * Grouping happens here rather than trusting getFeed's groups so pages
 * fetched with "Load more" join up with the run they continue.
 */

const GROUP_WINDOW_MS = 30 * 60 * 1000;

// Default shelves read as verbs; anything else is a named custom shelf.
const STATUS_VERBS = {
  read: "finished",
  "currently reading": "started reading",
  "want to read": "wants to read",
  "did not finish": "didn’t finish"
};

export function buildFeed(activities) {
  const groups = [];
  for (const activity of activities) {
    const last = groups[groups.length - 1];
    const time = new Date(activity.created_at).getTime();
    if (last && last.userId === activity.user_id && last.oldest - time < GROUP_WINDOW_MS) {
      last.activities.push(activity);
      last.oldest = time;
    } else {
      groups.push({
        key: activity.id,
        userId: activity.user_id,
        user: activity.profile,
        oldest: time,
        activities: [activity]
      });
    }
  }
  return groups.map(({ key, user, activities: list }) => ({ key, user, entries: collapse(list, user) }));
}

/** Merge adjacent activities on the same book into one entry. */
function collapse(activities, user) {
  const entries = [];
  for (const activity of activities) {
    const bookKey = activity.book_id || activity.book_title;
    const last = entries[entries.length - 1];
    if (bookKey && last?.bookKey === bookKey) last.activities.push(activity);
    else entries.push({ bookKey, activities: [activity] });
  }
  return entries.map((e) => describeEntry(e.activities, user));
}

/**
 * Everything one row needs: the sentence parts, a rating, a review snippet
 * and where the row links to. Activities arrive newest first.
 */
function describeEntry(activities, user) {
  const [latest] = activities;
  const username = user?.username;
  const book = latest.book_title
    ? {
        id: latest.book_id,
        title: latest.book_title,
        cover_url: latest.book_cover_url,
        author: latest.book_author,
        slug: latest.book_slug
      }
    : null;

  const shelfEvents = activities.filter((a) => a.activity_type === "shelf_add" || a.activity_type === "shelf_move");
  const statusEvent = shelfEvents.find((a) => STATUS_VERBS[a.shelf_name?.toLowerCase()]);
  const customShelves = [
    ...new Set(shelfEvents.filter((a) => !STATUS_VERBS[a.shelf_name?.toLowerCase()]).map((a) => a.shelf_name))
  ];
  const rating = activities.find((a) => a.activity_type === "rating")?.metadata?.rating || null;
  const review = activities.find((a) => a.activity_type === "review")?.metadata?.review_snippet?.trim() || null;
  const createdShelf = activities.find((a) => a.activity_type === "shelf_create");

  // Main verb, then follow-ons: "finished Dune and rated it"
  let verb;
  let target = null; // custom shelf the book went onto, for "added Dune to Favourites"
  const extras = [];
  if (statusEvent) {
    verb = STATUS_VERBS[statusEvent.shelf_name.toLowerCase()];
    if (customShelves.length) extras.push(`added it to ${list(customShelves)}`);
  } else if (customShelves.length) {
    verb = shelfEvents[0].activity_type === "shelf_move" ? "moved" : "added";
    target = list(customShelves);
  } else if (review) {
    verb = "reviewed";
  } else if (rating) {
    verb = "rated";
  } else if (createdShelf) {
    verb = "started a new shelf called";
  } else {
    verb = "updated";
  }
  const leadsWithReview = verb === "reviewed";
  const leadsWithRating = verb === "rated";
  if (!leadsWithReview && !leadsWithRating) {
    if (rating && review) extras.push("rated and reviewed it");
    else if (rating) extras.push("rated it");
    else if (review) extras.push("reviewed it");
  }

  // Reviews open the review; everything else about a book opens the book.
  let href = null;
  if (review && latest.book_id && username) {
    href = `/u/${encodeURIComponent(username)}/all/review/${latest.book_id}`;
  } else if (book?.slug) {
    href = `/books/${book.slug}`;
  } else if (createdShelf && username) {
    href = createdShelf.shelf_slug
      ? `/u/${encodeURIComponent(username)}/${createdShelf.shelf_slug}`
      : `/u/${encodeURIComponent(username)}`;
  }

  return {
    key: activities.map((a) => a.id).join("-"),
    createdAt: latest.created_at,
    book,
    verb,
    target,
    shelfName: createdShelf && !book ? createdShelf.shelf_name : null,
    // "added it to Favourites and rated it"
    extras: list(extras),
    rating,
    review,
    // Snippets are cut at 200 characters when recorded
    reviewTruncated: review?.length >= 199,
    href,
    linkLabel: review ? "Read the review" : book ? "View the book" : "View the shelf"
  };
}

// ["A", "B", "C"] → "A, B and C"
function list(items) {
  if (items.length < 2) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function firstName(user) {
  const full = user?.full_name?.trim();
  return full ? full.split(/\s+/)[0] : user?.username || "Someone";
}

export function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
