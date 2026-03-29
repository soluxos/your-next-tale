import { createClient } from "@/utils/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [booksResult, incompleteResult, profilesResult, shelvesResult] =
    await Promise.all([
      supabase.from("books").select("*", { count: "exact", head: true }),
      supabase
        .from("books")
        .select("*", { count: "exact", head: true })
        .eq("is_incomplete", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("bookshelves").select("*", { count: "exact", head: true })
    ]);

  const stats = [
    { label: "Total Books", value: booksResult.count ?? 0 },
    { label: "Incomplete Books", value: incompleteResult.count ?? 0 },
    { label: "Total Users", value: profilesResult.count ?? 0 },
    { label: "Total Bookshelves", value: shelvesResult.count ?? 0 }
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="font-departureMono uppercase text-[10px] text-white/40">
          Overview
        </p>
        <p className="font-ppMondwest text-white text-[28px] mt-1">Dashboard</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border border-white/10 rounded-[8px] p-6"
          >
            <p className="font-departureMono uppercase text-[10px] text-white/40">
              {stat.label}
            </p>
            <p className="font-ppMondwest text-white text-[40px] leading-none mt-2">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <a
          href="/admin/seed-books"
          className="border border-white/30 text-white font-departureMono uppercase text-[11px] rounded-[8px] px-6 py-3 hover:bg-white/5 transition-colors"
        >
          Seed Books
        </a>
        <a
          href="/admin/add-new-book"
          className="border border-white/30 text-white font-departureMono uppercase text-[11px] rounded-[8px] px-6 py-3 hover:bg-white/5 transition-colors"
        >
          Add Book
        </a>
      </div>
    </div>
  );
}
