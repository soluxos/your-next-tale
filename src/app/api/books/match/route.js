import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { findCatalogMatches } from "@/lib/books/catalogSearch";

const MAX_BOOKS = 1000;

function cleanIsbn(value) {
  const s = String(value || "").toUpperCase().replace(/[^0-9X]/g, "");
  return s.length === 10 || s.length === 13 ? s : null;
}

/**
 * POST /api/books/match
 * Body: { books: [{ title, authors, isbn_13, isbn_10 }] } (up to 1000)
 * → { matches: { [index]: { id, title, authors, isbn_13, isbn_10,
 *                             cover_url, is_incomplete, catalog_ids } } }
 *
 * Which of these books are already in our catalogue? ISBN-13, then ISBN-10,
 * then title + author — the same rules search uses (lib/books/sameBook), so
 * an import never adds a second copy of a book we have. Used by the library
 * import preview; reads only.
 */
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to import books" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.books)) {
    return NextResponse.json({ error: "Expected { books: [...] }" }, { status: 400 });
  }
  if (body.books.length > MAX_BOOKS) {
    return NextResponse.json(
      { error: `Send at most ${MAX_BOOKS} books per request` },
      { status: 413 }
    );
  }

  const hits = body.books.map((b) => ({
    title: String(b?.title || "").slice(0, 500),
    authors: (Array.isArray(b?.authors) ? b.authors : [])
      .slice(0, 10)
      .map((a) => String(a).slice(0, 200)),
    isbn_13: cleanIsbn(b?.isbn_13),
    isbn_10: cleanIsbn(b?.isbn_10)
  }));

  try {
    const found = await findCatalogMatches(supabase, hits);
    const matches = {};
    for (const [i, book] of found) {
      matches[i] = {
        id: book.id,
        title: book.title,
        authors: book.authors || [],
        isbn_13: book.isbn_13,
        isbn_10: book.isbn_10,
        cover_url: book.cover_url,
        is_incomplete: !!book.is_incomplete,
        catalog_ids: book.catalog_ids || [book.id]
      };
    }
    return NextResponse.json({ matches });
  } catch (e) {
    console.error("[/api/books/match]", e.message);
    return NextResponse.json({ error: "Couldn't check the catalogue" }, { status: 500 });
  }
}
