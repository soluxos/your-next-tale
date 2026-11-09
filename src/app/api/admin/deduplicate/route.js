import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { selectAllBooks } from "@/lib/books/selectAllBooks";

function normaliseKey(title, author) {
  const clean = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return `${clean(title)}__${clean(author).split(" ")[0]}`;
}

function scoreBook(book) {
  let score = 0;
  if (book.isbn_13) score += 30;
  if (book.description) score += 20;
  if (book.cover_url) score += 20;
  if (!book.is_incomplete) score += 10;
  if (book.isbn_10) score += 10;
  return score;
}

export async function POST(request) {
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

  const { data: allBooks, error: fetchError } = await selectAllBooks(
    supabase,
    "id, isbn_13, isbn_10, title, authors, description, cover_url, is_incomplete"
  );

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Group by normalised key
  const groups = new Map();
  for (const book of allBooks || []) {
    const author = Array.isArray(book.authors) ? book.authors[0] : null;
    const key = normaliseKey(book.title, author);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(book);
  }

  let mergedGroups = 0;
  let deletedCount = 0;
  const errors = [];

  for (const [key, group] of groups) {
    if (group.length <= 1) continue;

    // Score each record, keep the highest
    group.sort((a, b) => scoreBook(b) - scoreBook(a));
    const keeper = group[0];
    const duplicates = group.slice(1);

    mergedGroups++;

    for (const dup of duplicates) {
      // Reassign user_books from the duplicate to the keeper
      const { error: reassignError } = await supabase
        .from("user_books")
        .update({ book_id: keeper.id })
        .eq("book_id", dup.id);

      if (reassignError) {
        errors.push(
          `Reassign ${dup.id} → ${keeper.id}: ${reassignError.message}`
        );
        continue;
      }

      // Delete the duplicate book
      const { error: deleteError } = await supabase
        .from("books")
        .delete()
        .eq("id", dup.id);

      if (deleteError) {
        errors.push(`Delete ${dup.id}: ${deleteError.message}`);
      } else {
        deletedCount++;
      }

      // Clean up cover from storage
      if (dup.cover_url) {
        await supabase.storage.from("books").remove([dup.cover_url]);
      }
    }
  }

  return NextResponse.json({
    mergedGroups,
    deletedCount,
    errors: errors.length > 0 ? errors : undefined
  });
}
