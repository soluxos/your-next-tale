import { NextResponse } from "next/server";
import { fetchBookSources } from "@/lib/books/fetchAndNormaliseBook";

/**
 * POST /api/books/preview
 * Fetches book data from all external sources and returns a preview
 * with per-source descriptions and cover candidates — without saving to DB.
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

    const result = await fetchBookSources(body);

    if (!result || !result.merged?.title) {
      return NextResponse.json(
        { error: "Could not fetch book data" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      merged: {
        title: result.merged.title,
        authors: result.merged.authors || [],
        description: result.merged.description || null,
        isbn_13: result.merged.isbn_13 || null,
        isbn_10: result.merged.isbn_10 || null,
        genres: result.merged.genres || [],
        page_count: result.merged.page_count || null,
        published_date: result.merged.published_date || null,
        publisher: result.merged.publisher || null,
        cover_remote: result.merged.cover_remote || null
      },
      sources: result.sources,
      coverCandidates: result.coverCandidates
    });
  } catch (e) {
    console.error("[/api/books/preview]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
