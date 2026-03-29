import { NextResponse } from "next/server";

/**
 * Proxy ISBNdb book searches through the server so the API key never
 * reaches the browser.
 *
 * Query params:
 *   q        — search query (required)
 *   page     — page number (default 1)
 *   pageSize — results per page (default 20)
 */
export async function GET(request) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ISBNdb API key not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q || !q.trim()) {
    return NextResponse.json({ books: [] });
  }

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(
    parseInt(searchParams.get("pageSize") || "20", 10),
    50
  );

  try {
    const url = `https://api2.isbndb.com/books/${encodeURIComponent(q.trim())}?page=${page}&pageSize=${pageSize}&shouldMatchAll=0&language=en`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey, Accept: "application/json" }
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `ISBNdb returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ books: data.books || [] });
  } catch (e) {
    console.error("ISBNdb proxy error:", e);
    return NextResponse.json(
      { error: "ISBNdb request failed" },
      { status: 500 }
    );
  }
}
