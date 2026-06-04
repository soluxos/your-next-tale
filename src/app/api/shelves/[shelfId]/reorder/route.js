import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  const { shelfId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Verify the shelf belongs to the current user
  const { data: shelf } = await supabase
    .from("bookshelves")
    .select("id, user_id")
    .eq("id", shelfId)
    .single();

  if (!shelf)
    return NextResponse.json({ error: "Shelf not found" }, { status: 404 });
  if (shelf.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderedIds } = await request.json();
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return NextResponse.json(
      { error: "orderedIds required" },
      { status: 400 }
    );
  }

  // Update positions — position is 1-indexed
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("bookshelf_books")
      .update({ position: index + 1 })
      .eq("id", id)
      .eq("bookshelf_id", shelfId) // extra safety
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);
  if (errors.length) {
    return NextResponse.json(
      { error: errors[0].error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
