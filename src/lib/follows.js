/**
 * Get the follow relationship status between the current user and a profile.
 * Returns: 'accepted' | 'pending' | 'none'
 */
export async function getFollowStatus(supabase, currentUserId, targetUserId) {
  if (!currentUserId || currentUserId === targetUserId) return "none";
  const { data } = await supabase
    .from("follows")
    .select("status")
    .eq("follower_id", currentUserId)
    .eq("following_id", targetUserId)
    .single();
  return data?.status || "none";
}

/**
 * Follow a user. If their profile is private, creates a pending request.
 * If public, creates an accepted follow immediately.
 */
export async function followUser(supabase, currentUserId, targetUserId) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_private")
    .eq("id", targetUserId)
    .single();

  const status = profile?.is_private ? "pending" : "accepted";

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: currentUserId, following_id: targetUserId, status });

  if (error) throw error;
  return status;
}

/**
 * Unfollow a user or cancel a pending request.
 */
export async function unfollowUser(supabase, currentUserId, targetUserId) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", targetUserId);
  if (error) throw error;
}

/**
 * Accept a follow request (called by the person being followed).
 */
export async function acceptFollowRequest(supabase, followerId, currentUserId) {
  const { error } = await supabase
    .from("follows")
    .update({ status: "accepted" })
    .eq("follower_id", followerId)
    .eq("following_id", currentUserId)
    .eq("status", "pending");
  if (error) throw error;
}

/**
 * Decline/remove a follow request.
 */
export async function declineFollowRequest(
  supabase,
  followerId,
  currentUserId
) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", currentUserId)
    .eq("status", "pending");
  if (error) throw error;
}

/**
 * Get followers of a user (accepted only, with profile data).
 */
export async function getFollowers(supabase, userId) {
  const { data: follows, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId)
    .eq("status", "accepted");
  if (error) throw error;
  if (!follows || follows.length === 0) return [];

  const ids = follows.map((r) => r.follower_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, is_private, facehash_color")
    .in("id", ids);
  if (profilesError) throw profilesError;
  return profiles || [];
}

/**
 * Get accounts a user is following (accepted only, with profile data).
 */
export async function getFollowing(supabase, userId) {
  const { data: follows, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .eq("status", "accepted");
  if (error) throw error;
  if (!follows || follows.length === 0) return [];

  const ids = follows.map((r) => r.following_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, is_private, facehash_color")
    .in("id", ids);
  if (profilesError) throw profilesError;
  return profiles || [];
}

/**
 * Get pending follow requests sent TO a user (for their notifications).
 */
export async function getPendingRequests(supabase, userId) {
  const { data: follows, error } = await supabase
    .from("follows")
    .select("id, created_at, follower_id")
    .eq("following_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!follows || follows.length === 0) return [];

  const ids = follows.map((r) => r.follower_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, facehash_color")
    .in("id", ids);
  if (profilesError) throw profilesError;

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return follows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    follower: profileMap[r.follower_id] || null
  }));
}

/**
 * Get follower and following counts for a user.
 */
export async function getFollowCounts(supabase, userId) {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId)
      .eq("status", "accepted")
  ]);
  return { followers: followers || 0, following: following || 0 };
}
