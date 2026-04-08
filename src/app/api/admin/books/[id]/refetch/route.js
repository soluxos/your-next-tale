import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check — must be admin
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

  // Fetch the book
  const { data: book } = await supabase
    .from("books")
    .select("id, title, isbn_13, isbn_10, authors")
    .eq("id", id)
    .single();

  if (!book)
    return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "ISBNDB_API_KEY not set" },
      { status: 500 }
    );

  // Collect all candidate books from ISBNdb
  const candidates = [];

  // 1. Fetch by ISBN-13 if available
  if (book.isbn_13) {
    try {
      const res = await fetch(`https://api2.isbndb.com/book/${book.isbn_13}`, {
        headers: { Authorization: apiKey }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.book)
          candidates.push(normaliseIsbndbBook(json.book, "isbn_direct"));
      }
    } catch {
      /* continue */
    }
  }

  // 2. Search by title — returns up to 10 results
  if (book.title) {
    try {
      const encoded = encodeURIComponent(book.title);
      const res = await fetch(
        `https://api2.isbndb.com/books/${encoded}?page=1&pageSize=10&language=en`,
        { headers: { Authorization: apiKey } }
      );
      if (res.ok) {
        const json = await res.json();
        const books = json.books || [];
        for (const b of books) {
          candidates.push(normaliseIsbndbBook(b, "title_search"));
        }
      }
    } catch {
      /* continue */
    }
  }

  // 3. Search by ISBN-10 if available and no ISBN-13 result
  if (book.isbn_10 && candidates.length < 3) {
    try {
      const res = await fetch(`https://api2.isbndb.com/book/${book.isbn_10}`, {
        headers: { Authorization: apiKey }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.book)
          candidates.push(normaliseIsbndbBook(json.book, "isbn10_direct"));
      }
    } catch {
      /* continue */
    }
  }

  // Deduplicate candidates by isbn_13
  const seen = new Set();
  const deduped = candidates.filter((c) => {
    const key = c.isbn_13 || c.isbn_10 || c.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ candidates: deduped });
}

function normaliseIsbndbBook(raw, source) {
  return {
    source,
    isbn_13: raw.isbn13 || raw.isbn_13 || null,
    isbn_10: raw.isbn || raw.isbn_10 || null,
    title: raw.title || raw.title_long || null,
    authors: Array.isArray(raw.authors)
      ? raw.authors
      : raw.authors
        ? [raw.authors]
        : [],
    description: raw.synopsis || raw.overview || raw.description || null,
    publisher: raw.publisher || null,
    published_date: raw.date_published || raw.published_date || null,
    page_count: raw.pages ? parseInt(raw.pages, 10) : null,
    language: raw.language || null,
    genres: Array.isArray(raw.subjects) ? raw.subjects.slice(0, 10) : [],
    // ISBNdb cover URLs — try multiple sizes
    cover_urls: [
      raw.image,
      raw.cover,
      raw.isbn13
        ? `https://images.isbndb.com/covers/${raw.isbn13.slice(-4, -2)}/${raw.isbn13.slice(-2)}/${raw.isbn13}.jpg`
        : null
    ].filter(Boolean)
  };
}
