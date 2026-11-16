import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SORTS, countCatalogue, listCatalogue } from "@/lib/books/catalogueRanks";

// The catalogue as a wall of covers. Books still waiting for a cover are left
// out (search and their own pages still find them).
//   GET /api/books?start=0&end=44&genre=fantasy&sort=popular
// genre: a Discover genre, or "sff" for fantasy and sci-fi together.
// sort:  "popular", "newest" (by publication date); otherwise newest added.
// The first page also says how many books there are in all.
export async function GET(request) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const start = Math.max(0, parseInt(searchParams.get("start")) || 0);
  const end = Math.min(start + 99, Math.max(start, parseInt(searchParams.get("end")) || start + 20));
  const genre = searchParams.get("genre");
  const sort = SORTS.includes(searchParams.get("sort")) ? searchParams.get("sort") : null;

  try {
    const [{ books, hasMore }, total] = await Promise.all([
      listCatalogue(supabase, { genre, sort, start, end }),
      start === 0 && searchParams.has("count") ? countCatalogue(supabase, genre) : undefined
    ]);
    const response = NextResponse.json({ books, hasMore, total });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
