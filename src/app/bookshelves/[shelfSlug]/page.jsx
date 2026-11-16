import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Legacy URL — shelves now live at /u/[username]/[shelfSlug].
export default async function LegacyShelfPage({ params }) {
  const { shelfSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile?.username) redirect("/account");
  redirect(
    `/u/${encodeURIComponent(profile.username)}/${encodeURIComponent(shelfSlug)}`
  );
}
