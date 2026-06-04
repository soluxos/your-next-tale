import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AdminNav from "./AdminNav";

export const metadata = {
  title: "Admin | Your Next Tale"
};

export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/login");

  return (
    <div className="AdminLayout min-h-screen flex bg-[#f9f9fb] border-t border-border">
      <aside className="w-56 shrink-0 border-r border-border bg-white flex flex-col gap-1 p-4">
        <div className="mb-6">
          <p className="font-departureMono uppercase text-[10px] text-textSecondary">
            Admin
          </p>
          <p className="font-ppMondwest text-textPrimary text-[18px]">
            Your Next Tale
          </p>
        </div>
        <AdminNav />
      </aside>

      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
