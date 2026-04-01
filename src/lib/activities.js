/**
 * Record an activity. Call this after any user action that should appear in feeds.
 * Safe to call without awaiting — failures are logged but don't break the action.
 */
export async function recordActivity(
  supabase,
  {
    userId,
    type,
    bookId,
    shelfId,
    fromShelfId,
    userBookId,
    metadata = {},
    bookTitle,
    bookCoverUrl,
    bookIsbn13,
    shelfName,
    fromShelfName
  }
) {
  try {
    await supabase.from("activities").insert({
      user_id: userId,
      activity_type: type,
      book_id: bookId || null,
      shelf_id: shelfId || null,
      from_shelf_id: fromShelfId || null,
      user_book_id: userBookId || null,
      metadata,
      book_title: bookTitle || null,
      book_cover_url: bookCoverUrl || null,
      book_isbn_13: bookIsbn13 || null,
      shelf_name: shelfName || null,
      from_shelf_name: fromShelfName || null
    });
  } catch (e) {
    console.error("[recordActivity] failed:", e.message);
  }
}

/**
 * Fetch the activity feed for a user — activity from people they follow,
 * grouped when the same user acts multiple times within 30 minutes.
 */
export async function getFeed(
  supabase,
  userId,
  { limit = 50, offset = 0 } = {}
) {
  const { data: followingData } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .eq("status", "accepted");

  const followingIds = (followingData || []).map((f) => f.following_id);

  if (!followingIds.length) return [];

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id, activity_type, created_at,
      book_id, book_title, book_cover_url, book_isbn_13,
      shelf_id, shelf_name, from_shelf_id, from_shelf_name,
      user_book_id, metadata,
      user_id
    `
    )
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  if (!data?.length) return [];

  // Fetch profiles separately — activities.user_id references auth.users,
  // not public.profiles, so PostgREST can't resolve embedded joins across schemas.
  const uniqueUserIds = [...new Set(data.map((a) => a.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, facehash_color")
    .in("id", uniqueUserIds);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const activities = data.map((a) => ({
    ...a,
    profile: profileMap[a.user_id] || null
  }));

  return groupActivities(activities);
}

/**
 * Group consecutive activities from the same user if within 30 minutes of each other.
 * Returns an array of groups: { user, activities[], groupedAt }
 */
function groupActivities(activities) {
  const WINDOW_MS = 30 * 60 * 1000;
  const groups = [];

  for (const activity of activities) {
    const last = groups[groups.length - 1];
    const actTime = new Date(activity.created_at).getTime();
    const lastTime = last
      ? new Date(last.activities[0].created_at).getTime()
      : 0;

    if (
      last &&
      last.user.id === activity.user_id &&
      Math.abs(actTime - lastTime) < WINDOW_MS
    ) {
      last.activities.push(activity);
    } else {
      groups.push({
        user: activity.profile,
        activities: [activity],
        groupedAt: activity.created_at
      });
    }
  }

  return groups;
}

/**
 * Get a user's own activity (for their profile page — public view).
 */
export async function getUserActivity(supabase, userId, { limit = 20 } = {}) {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id, activity_type, created_at,
      book_title, book_cover_url, book_isbn_13,
      shelf_name, from_shelf_name, metadata
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
