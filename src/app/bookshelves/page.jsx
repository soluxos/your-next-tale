import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "My Bookshelves | Your Next Tale"
};

export default async function BookshelvesPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profile?.username) {
    redirect(`/u/${encodeURIComponent(profile.username)}`);
  }

  // Fallback if no username set
  redirect("/account");
}
