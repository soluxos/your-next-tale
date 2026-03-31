import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

export async function DELETE(request, { params }) {
  const { id } = await params;

  // Auth check uses the user session client
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // All mutations use the service role client to bypass RLS
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[admin delete] createAdminClient failed:", e.message);
    return NextResponse.json({ error: "Admin client init failed: " + e.message }, { status: 500 });
  }

  const { data: book, error: bookError } = await admin
    .from("books")
    .select("id, cover_url, title")
    .eq("id", id)
    .single();

  if (!book) {
    console.error("[admin delete] book lookup error:", bookError);
    return NextResponse.json({ error: bookError?.message ?? "Not found" }, { status: 404 });
  }

  // 1. Fetch user_book IDs before deleting anything
  const { data: userBooks } = await admin
    .from("user_books")
    .select("id")
    .eq("book_id", id);

  // 2. Delete bookshelf_books rows that reference those user_books
  if (userBooks?.length) {
    await admin
      .from("bookshelf_books")
      .delete()
      .in(
        "user_book_id",
        userBooks.map((ub) => ub.id)
      );
  }

  // 3. Delete user_books
  await admin.from("user_books").delete().eq("book_id", id);

  // 4. Delete the book itself
  const { error } = await admin.from("books").delete().eq("id", id);

  if (error) {
    console.error("[admin delete book]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 5. Clean up cover from storage
  if (book.cover_url) {
    await admin.storage.from("books").remove([book.cover_url]);
  }

  return NextResponse.json({ success: true, deleted: book.title });
}
