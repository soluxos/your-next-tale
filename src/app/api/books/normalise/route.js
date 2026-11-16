import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchAndNormaliseBook } from "@/lib/books/fetchAndNormaliseBook";
import {
  invalidateCatalogIndex,
  findCatalogMatches
} from "@/lib/books/catalogSearch";

/**
 * POST /api/books/normalise
 * Server-side proxy for fetchAndNormaliseBook.
 * Accepts a search result object { _raw, source, preview, hardcover_id? }
 * and returns the normalised, uploaded book row.
 *
 * Must run server-side because:
 *  - Cover images from external CDNs (e.g. Hardcover) are CORS-restricted
 *  - External API keys (ISBNDB_API_KEY etc.) are server-only env vars
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body || (!body.source && !body.isbn)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Adding a book found online: if the catalogue already has this book
    // (any edition — the import only de-dupes by ISBN), use that copy rather
    // than creating another row for the same book.
    if (body.source !== "local" && body.preview?.title) {
      const existing = (await findCatalogMatches(supabase, [body.preview])).get(0);
      if (existing) return NextResponse.json({ book: existing });
    }

    // strict: library imports — only save books an online source confirms
    const book = await fetchAndNormaliseBook(body, supabase, {
      strict: body.strict === true
    });

    if (!book) {
      return NextResponse.json(
        { error: "Could not fetch book data" },
        { status: 422 }
      );
    }

    // New catalogue rows should be searchable straight away.
    if (body.source !== "local") invalidateCatalogIndex();

    return NextResponse.json({ book });
  } catch (e) {
    console.error("[/api/books/normalise]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
