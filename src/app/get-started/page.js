import { Suspense } from "react";
import { redirect } from "next/navigation";
import SignupPage from "@/components/pages/get-started/SignupPage";
import { createClient } from "@/utils/supabase/server";
import { getShowcaseBooks } from "@/lib/showcase";

export const metadata = { title: "Create your bookcase | Your Next Tale" };

export default async function GetStarted() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const showcase = await getShowcaseBooks(supabase);
  return (
    <Suspense>
      <SignupPage showcase={showcase} />
    </Suspense>
  );
}
