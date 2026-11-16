import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assessCover, COVER_REJECT } from "@/lib/books/coverQuality";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check — admin only
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    cover_url_remote, // remote URL to download and re-upload
    ...fields // all other editable fields
  } = body;

  // Validate allowed fields — only update what we explicitly permit
  const ALLOWED = [
    "title",
    "authors",
    "description",
    "isbn_13",
    "isbn_10",
    "publisher",
    "published_date",
    "page_count",
    "language",
    "genres",
    "source",
    "is_incomplete",
    "hardcover_id",
    "bookshop_affiliate_link"
  ];
  const sanitised = {};
  for (const key of ALLOWED) {
    if (key in fields) sanitised[key] = fields[key];
  }

  // Handle cover re-upload if a remote URL was provided
  if (cover_url_remote) {
    try {
      const coverRes = await fetch(cover_url_remote);
      if (!coverRes.ok)
        throw new Error(`Cover fetch failed: ${coverRes.status}`);

      const buffer = Buffer.from(await coverRes.arrayBuffer());
      // A person chose this one, so only refuse what can't be a cover at all.
      const check = await assessCover(buffer);
      if (check.tier === COVER_REJECT)
        throw new Error(`that image doesn't look like a cover (${check.reason})`);
      const { contentType, ext } = check;

      const identifier = sanitised.isbn_13 || fields.isbn_13 || id;
      const filename = `${identifier}-${Date.now()}${ext}`;

      // Use service-role admin client for storage upload
      let adminClient;
      try {
        adminClient = createAdminClient();
      } catch (e) {
        throw new Error("Admin client init failed: " + e.message);
      }

      const { error: uploadError } = await adminClient.storage
        .from("books")
        .upload(filename, buffer, { contentType, upsert: false });

      if (uploadError) throw uploadError;
      sanitised.cover_url = filename;
    } catch (e) {
      return NextResponse.json(
        { error: `Cover upload failed: ${e.message}` },
        { status: 422 }
      );
    }
  }

  sanitised.last_synced_at = new Date().toISOString();

  // If all major fields now present, mark complete
  if (sanitised.title && sanitised.description && sanitised.cover_url) {
    sanitised.is_incomplete = false;
  }

  const { data: updated, error } = await supabase
    .from("books")
    .update(sanitised)
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/books");
  revalidatePath(`/books/${updated.slug || id}`);

  return NextResponse.json({ book: updated });
}

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
    return NextResponse.json(
      { error: "Admin client init failed: " + e.message },
      { status: 500 }
    );
  }

  const { data: book, error: bookError } = await admin
    .from("books")
    .select("id, cover_url, title")
    .eq("id", id)
    .single();

  if (!book) {
    console.error("[admin delete] book lookup error:", bookError);
    return NextResponse.json(
      { error: bookError?.message ?? "Not found" },
      { status: 404 }
    );
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

  // 6. Revalidate cached pages so the site reflects the deletion
  revalidatePath("/");
  revalidatePath("/books");

  return NextResponse.json({ success: true, deleted: book.title });
}
