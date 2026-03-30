import { createClient } from "@/utils/supabase/server";
import { TABLES } from "@/lib/supabase/types";
import { redirect } from "next/navigation";
import ShelfView from "./ShelfView";

export default async function ShelfPage({ params }) {
  const { username, shelfSlug } = await params;
  const supabase = await createClient();

  // Privacy / existence check (must stay server-side)
  const { data: profile } = await supabase
    .from(TABLES.PROFILES)
    .select("id, is_private")
    .eq("username", username)
    .single();

  if (!profile) redirect("/");

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  if (profile.is_private && !isOwner) redirect("/");

  // Fetch shelves — lightweight, needed for BookDetailPanel shelf selector
  const { data: shelves } = await supabase
    .from(TABLES.BOOKSHELVES)
    .select("id, name, slug, is_default, is_exclusive")
    .eq("user_id", profile.id)
    .order("display_order", { ascending: true });

  // Resolve shelfId / shelfName from the already-fetched shelves list
  // (no extra DB query needed)
  let shelfId = null;
  let shelfName = "All Books";

  if (shelfSlug !== "all") {
    const shelf = (shelves || []).find((s) => s.slug === shelfSlug);
    if (!shelf) redirect(`/u/${encodeURIComponent(username)}/all`);
    shelfId = shelf.id;
    shelfName = shelf.name;
  }

  // Books are fetched client-side inside ShelfView so the shelf chrome
  // renders immediately on every tab navigation without a loading flash.
  return (
    <ShelfView
      shelfSlug={shelfSlug}
      shelfId={shelfId}
      shelfName={shelfName}
      isOwner={isOwner}
      userId={profile.id}
      shelves={shelves || []}
    />
  );
}
