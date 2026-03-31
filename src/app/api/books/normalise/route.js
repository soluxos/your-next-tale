import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchAndNormaliseBook } from "@/lib/books/fetchAndNormaliseBook";

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

    const book = await fetchAndNormaliseBook(body, supabase);

    if (!book) {
      return NextResponse.json(
        { error: "Could not fetch book data" },
        { status: 422 }
      );
    }

    return NextResponse.json({ book });
  } catch (e) {
    console.error("[/api/books/normalise]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
