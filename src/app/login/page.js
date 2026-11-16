import { redirect } from "next/navigation";
import LoginPage from "@/components/pages/login/LoginPage";
import { createClient } from "@/utils/supabase/server";
import { getShowcaseBooks } from "@/lib/showcase";

export const metadata = { title: "Sign in | Your Next Tale" };

const safeNext = (next) =>
  typeof next === "string" && /^\/(?!\/)/.test(next) && !next.startsWith("/login") ? next : null;

export default async function Login({ searchParams }) {
  const params = await searchParams;
  const message = params?.message || null;
  const next = safeNext(params?.next);

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) redirect(next || "/");

  const showcase = await getShowcaseBooks(supabase);
  return <LoginPage message={message} next={next} showcase={showcase} />;
}
