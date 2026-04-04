import { createClient } from "@/utils/supabase/server";
import { TABLES } from "@/lib/supabase/types";
import { redirect } from "next/navigation";
import ShelfView from "./ShelfView";

export default async function ShelfLayout({ children, modal, params }) {
  const { username, shelfSlug } = await params;
  const supabase = await createClient();

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

  let shelfId = null;
  let shelfName = "All Books";
  let defaultView = "books";

  if (shelfSlug !== "all") {
    const shelf = (shelves || []).find((s) => s.slug === shelfSlug);
    if (!shelf) redirect(`/u/${encodeURIComponent(username)}/all`);
    shelfId = shelf.id;
    shelfName = shelf.name;
    defaultView = shelf.default_view || "books";
  }

  return (
    <>
      <ShelfView
        shelfSlug={shelfSlug}
        shelfId={shelfId}
        shelfName={shelfName}
        isOwner={isOwner}
        userId={profile.id}
        username={username}
        shelves={shelves || []}
        defaultView={defaultView}
      />
      {children}
      {modal}
    </>
  );
}
