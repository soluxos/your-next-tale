import UserSettings from "@/components/pages/user-settings/UserSettings";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "Settings | Your Next Tale" };

export default async function Account({ searchParams }) {
  const params = await searchParams;
  const initialTab = params?.tab === "password" ? "password" : "profile";
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Load the profile here so the form renders filled in, not blank-then-filled.
  // No server user (cookie not hydrated yet after an email link) falls back
  // to the client-side fetch in UserSettings.
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, username, website, is_private, facehash_color")
      .eq("id", user.id)
      .maybeSingle();
    // No row yet is still "loaded": saving creates it
    profile = data ?? {};
  }

  return <UserSettings user={user} initialProfile={profile} initialTab={initialTab} />;
}
