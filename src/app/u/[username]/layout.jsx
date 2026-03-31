import { createClient } from "@/utils/supabase/server";
import { TABLES } from "@/lib/supabase/types";
import { redirect } from "next/navigation";
import ProfileLayout from "./ProfileLayout";

const DEFAULT_SHELVES = [
  { name: "Read", slug: "read", display_order: 0 },
  { name: "Currently Reading", slug: "currently-reading", display_order: 1 },
  { name: "Want to Read", slug: "want-to-read", display_order: 2 },
  { name: "Did Not Finish", slug: "did-not-finish", display_order: 3 }
];

export async function generateMetadata({ params }) {
  const { username } = await params;
  return { title: `${username}'s Shelves | Your Next Tale` };
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
    .single();

  if (!profile) redirect("/");

  // Auth check
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  if (profile.is_private && !isOwner) redirect("/");

  // Fetch user shelves
  let { data: shelves } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("id, name, slug, is_default, is_exclusive")
    .eq("user_id", profile.id)
    .order("display_order", { ascending: true });

  shelves = shelves || [];

  // --- Default shelves guard (Problem 2C) ---
  // If the viewer is the owner and any default shelves are missing, create them
  if (isOwner) {
    const existingSlugs = new Set(shelves.map((s) => s.slug));
    const missing = DEFAULT_SHELVES.filter((ds) => !existingSlugs.has(ds.slug));

    if (missing.length > 0) {
      const rows = missing.map((ds) => ({
        user_id: profile.id,
        name: ds.name,
        slug: ds.slug,
        is_default: true,
        is_exclusive: true,
        display_order: ds.display_order
      }));

      await supabase
        .from(TABLES.BOOKSHELVES)
        .upsert(rows, { onConflict: "user_id,slug", ignoreDuplicates: true });

      // Re-fetch shelves after creating missing ones
      const { data: refreshed } = await supabase
        .from(TABLES.BOOKSHELVES)
        .select("id, name, slug, is_default, is_exclusive")
        .eq("user_id", profile.id)
        .order("display_order", { ascending: true });

      shelves = refreshed || shelves;
    }
  }

  // Resolve avatar URL — full HTTP URLs (OAuth) are used directly;
  // storage paths are resolved via the public bucket URL.
  let avatarUrl = null;
  if (profile.avatar_url) {
    avatarUrl = profile.avatar_url.startsWith("http")
      ? profile.avatar_url
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`;
  }

  return (
    <ProfileLayout
      profile={{ ...profile, avatarUrl }}
      shelves={shelves}
      isOwner={isOwner}
    >
      {children}
    </ProfileLayout>
  );
}
