import ForgotPasswordPage from "@/components/pages/login/ForgotPasswordPage";
import { createClient } from "@/utils/supabase/server";
import { getShowcaseBooks } from "@/lib/showcase";

export const metadata = { title: "Reset your password | Your Next Tale" };

export default async function ForgotPassword() {
  const supabase = await createClient();
  const showcase = await getShowcaseBooks(supabase);
  return <ForgotPasswordPage showcase={showcase} />;
}
