import { createClient } from "@/utils/supabase/server";
import { getFollowers } from "@/lib/follows";
import FollowList, { withBookCounts } from "@/components/profile/FollowList";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }) {
  const { username } = await params;
  return { title: `People following ${username} | Your Next Tale` };
}

export default async function FollowersPage({ params }) {
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
    people = await withBookCounts(supabase, await getFollowers(supabase, profile.id));
  } catch (e) {
    console.error("getFollowers error:", e);
  }

  const isOwner = user?.id === profile.id;
  const name = profile.full_name || profile.username;
  // The feed suggests readers to follow, so that's where the empty state points.

  return (
    <FollowList
      title="Followers"
      people={people}
      emptyTitle="No followers yet"
      emptyText={
        isOwner
          ? "Follow readers whose shelves you like — they’ll see you, and many follow back."
          : `Nobody follows ${name} yet.`
      }
      emptyAction={user ? { href: "/feed", label: isOwner ? "Find readers to follow" : "Find readers" } : null}
    />
  );
}
