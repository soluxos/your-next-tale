import { createClient } from "@/utils/supabase/server";
import { TABLES } from "@/lib/supabase/types";
import { notFound } from "next/navigation";
import ProfileLayout from "./ProfileLayout";
import PrivateProfile from "@/components/profile/PrivateProfile";
import { getFollowCounts, getFollowStatus } from "@/lib/follows";
import { ensureDefaultShelves } from "@/lib/bookshelves";

export async function generateMetadata({ params }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from(TABLES.PROFILES)
    .select("full_name, username")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return { title: "Reader not found | Your Next Tale" };
  const name = profile.full_name || profile.username;
  return {
    title: `${name}'s bookcase | Your Next Tale`,
    description: `See what ${name} is reading, has read and wants to read on Your Next Tale.`
  };
}

export default async function UserLayout({ children, params }) {
  const { username } = await params;
  const supabase = await createClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from(TABLES.PROFILES)
    .select(
      "id, full_name, username, avatar_url, bio, is_private, facehash_color"
    )
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();

  // Auth check
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  // Private bookcases are visible to their owner and accepted followers only.
  if (profile.is_private && !isOwner) {
    const status = user ? await getFollowStatus(supabase, user.id, profile.id) : "none";
    if (status !== "accepted") {
      return <PrivateProfile profile={profile} signedIn={!!user} followStatus={status} />;
    }
  }

  // Fetch user shelves
  let { data: shelves, error: shelvesError } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("id, name, slug, is_default, is_exclusive, default_view")
    .eq("user_id", profile.id)
    .order("display_order", { ascending: true });

  if (shelvesError) {
    const { data: shelvesFallback } = await supabase
      .from(TABLES.BOOKSHELVES)
      .select("id, name, slug, is_default, is_exclusive")
      .eq("user_id", profile.id)
      .order("display_order", { ascending: true });
    shelves = shelvesFallback;
  }

  shelves = shelves || [];

  // Owners always get the four default status shelves
  if (isOwner) {
    shelves = await ensureDefaultShelves(supabase, profile.id, shelves);
  }

  // Book counts per shelf (for the tab labels) + total library size
  const shelfIds = shelves.map((s) => s.id);
  const [{ data: shelfLinks }, { count: libraryCount }] = await Promise.all([
    shelfIds.length
      ? supabase
          .from(TABLES.BOOKSHELF_BOOKS)
          .select("bookshelf_id")
          .in("bookshelf_id", shelfIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from(TABLES.USER_BOOKS)
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
  ]);
  const shelfCounts = { all: libraryCount || 0 };
  for (const link of shelfLinks || []) {
    shelfCounts[link.bookshelf_id] = (shelfCounts[link.bookshelf_id] || 0) + 1;
  }

  // Resolve avatar URL — full HTTP URLs (OAuth) are used directly;
  // storage paths are resolved via the public bucket URL.
  let avatarUrl = null;
  if (profile.avatar_url) {
    avatarUrl = profile.avatar_url.startsWith("http")
      ? profile.avatar_url
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`;
  }

  const [followCounts, followStatus] = await Promise.all([
    getFollowCounts(supabase, profile.id),
    user && !isOwner
      ? getFollowStatus(supabase, user.id, profile.id)
      : Promise.resolve("none")
  ]);

  // Determine if the logged-in viewer is an admin
  let isAdmin = false;
  if (user) {
    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = viewerProfile?.role === "admin";
  }

  return (
    <ProfileLayout
      profile={{ ...profile, avatarUrl }}
      shelves={shelves}
      shelfCounts={shelfCounts}
      isOwner={isOwner}
      isAdmin={isAdmin}
      currentUserId={user?.id || null}
      followCounts={followCounts}
      followStatus={followStatus}
    >
      {children}
    </ProfileLayout>
  );
}
