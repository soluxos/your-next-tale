import { createClient } from "@/utils/supabase/server";
import { getFollowers } from "@/lib/follows";
import UserListItem from "@/components/profile/UserListItem";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }) {
  const { username } = await params;
  return { title: `${username}'s Followers | Your Next Tale` };
}

export default async function FollowersPage({ params }) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, is_private")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  if (profile.is_private && !isOwner) {
    return (
      <div className="p-8 text-center">
        <p className="font-departureMono uppercase text-[11px] text-textSecondary">
          This profile is private
        </p>
      </div>
    );
  }

  let followers = [];
  try {
    followers = await getFollowers(supabase, profile.id);
  } catch (e) {
    console.error("getFollowers error:", e);
  }

  return (
    <div className="grid grid-cols-[16px_auto_16px]">
      <div className="w-4 border border-border" />
      <div className="max-w-2xl mx-auto w-full p-4 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/u/${username}`}
            className="font-departureMono uppercase text-[10px] text-textSecondary hover:text-textPrimary"
          >
            ← {profile.full_name || username}
          </Link>
          <span className="text-textSecondary">/</span>
          <h1 className="font-ppMondwest text-[22px]">Followers</h1>
          <span className="font-departureMono uppercase text-[11px] text-textSecondary">
            {followers.length}
          </span>
        </div>

        {followers.length === 0 ? (
          <p className="font-departureMono uppercase text-[11px] text-textSecondary text-center py-12">
            No followers yet
          </p>
        ) : (
          <div className="space-y-1">
            {followers.map((user) => (
              <UserListItem key={user.id} user={user} />
            ))}
          </div>
        )}
      </div>
      <div className="w-4 border border-border" />
    </div>
  );
}
