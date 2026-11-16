import { createClient } from "@/utils/supabase/server";
import { getFollowing } from "@/lib/follows";
import FollowList, { withBookCounts } from "@/components/profile/FollowList";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }) {
  const { username } = await params;
  return { title: `People ${username} follows | Your Next Tale` };
}

export default async function FollowingPage({ params }) {
  const { username } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: { user } }] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, is_private").eq("username", username).maybeSingle(),
    supabase.auth.getUser()
  ]);

  if (!profile) notFound();

  // Private profiles are gated by the parent layout (owner + accepted followers only).
  let people = [];
  try {
    people = await withBookCounts(supabase, await getFollowing(supabase, profile.id));
  } catch (e) {
    console.error("getFollowing error:", e);
  }

  const isOwner = user?.id === profile.id;
  const name = profile.full_name || profile.username;
  // The feed suggests readers to follow, so that's where the empty state points.

  return (
    <FollowList
      title="Following"
      people={people}
      emptyTitle={isOwner ? "You’re not following anyone yet" : `${name} isn’t following anyone yet`}
      emptyText={
        isOwner ? "Follow readers to see what they’re reading and reviewing in your feed." : null
      }
      emptyAction={user ? { href: "/feed", label: isOwner ? "Find readers to follow" : "Find readers" } : null}
    />
  );
}
