import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(request, { params }) {
  const { id } = await params;
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

  const { data: book } = await supabase
    .from("books")
    .select("id, cover_url, title")
    .eq("id", id)
    .single();

  if (!book) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Remove related user_books first (foreign key)
  await supabase.from("user_books").delete().eq("book_id", id);

  // Remove related bookshelf_books entries
  const { data: userBookIds } = await supabase
    .from("user_books")
    .select("id")
    .eq("book_id", id);

  if (userBookIds?.length) {
    await supabase
      .from("bookshelf_books")
      .delete()
      .in(
        "user_book_id",
        userBookIds.map((ub) => ub.id)
      );
  }

  const { error } = await supabase.from("books").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clean up cover from storage
  if (book.cover_url) {
    await supabase.storage.from("books").remove([book.cover_url]);
  }

  return NextResponse.json({ success: true, deleted: book.title });
}
