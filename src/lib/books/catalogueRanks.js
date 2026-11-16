import { genreMatchValues } from "@/lib/genres";

/**
 * How popular each catalogue book is doesn't fit in the books table, so the
 * import writes two small files beside the covers:
 *
 *   catalogue/ranks.json  every fantasy and sci-fi book, most popular first
 *                         { generatedAt, order: [bookId…], flags: "fsFSb…" }
 *                         (flags[i] says which genre order[i] is: f or s, F or S
 *                         when it is filed under both and that one leads, b when
 *                         nothing says which)
 *   catalogue/home.json   the home page's short lists
 *                         { generatedAt, lists: { trending, new, fantasy, "science-fiction" } }
 *
 * Nothing breaks without them: Discover falls back to newest added, and home
 * to plain catalogue queries.
 */
export const RANKS_PATH = "catalogue/ranks.json";
export const HOME_LISTS_PATH = "catalogue/home.json";
// What each source said about each book, kept so the lists can be rebuilt
// without asking again. Not read by the site.
export const SIGNALS_PATH = "catalogue/signals.json";

export const catalogueFileUrl = (path) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${path}`;

export const SORTS = ["popular", "newest"];
// How many covers Discover loads at a time.
export const PAGE_SIZE = 45;

// Enough for a cover, its caption, and the hover card and drawer it opens.
const CARD_FIELDS =
  "id, title, authors, cover_url, genres, published_date, page_count, publisher, isbn_13, isbn_10, bookshop_affiliate_link";
const TTL = 5 * 60_000;
let ranksCache = { at: 0, data: null };

async function loadRanks() {
  if (Date.now() - ranksCache.at < TTL) return ranksCache.data;
  let data = null;
  try {
    const res = await fetch(catalogueFileUrl(RANKS_PATH), { cache: "no-store" });
    const json = res.ok ? await res.json() : null;
    if (Array.isArray(json?.order) && json.order.length) data = json;
  } catch {}
  ranksCache = { at: Date.now(), data };
  return data;
}

// A genre's books, most popular first: those that are mainly that genre, then
// those filed under it as well as the other (The Martian is "fantasy" to some
// publishers, and shouldn't open the fantasy shelf).
function rankedIds(ranks, genre) {
  const [main, also] = genre === "fantasy" ? ["fFb", "S"] : genre === "science-fiction" ? ["sSb", "F"] : [];
  if (!main || typeof ranks.flags !== "string") return ranks.order;
  const pick = (flags) => ranks.order.filter((_, i) => flags.includes(ranks.flags[i]));
  return [...pick(main), ...pick(also)];
}

const today = () => new Date().toISOString().slice(0, 10);

function base(supabase, genre, fields = "*", options) {
  let q = supabase.from("books").select(fields, options).not("cover_url", "is", null);
  const values = genre ? genreMatchValues(genre) : null;
  if (values) q = q.overlaps("genres", values);
  return q;
}

/**
 * One page of the catalogue, covers only.
 *   genre  a Discover genre slug, "sff" for fantasy and sci-fi together, or none
 *   sort   "popular" (the ranks file, then anything added since), "newest"
 *          (by publication date, out already), else newest added
 * Returns { books, hasMore }.
 */
export async function listCatalogue(supabase, { genre = null, sort = null, start = 0, end = 44 } = {}) {
  const size = end - start + 1;
  const page = (rows) => ({ books: rows.slice(0, size), hasMore: rows.length > size });

  if (sort === "newest") {
    const { data, error } = await base(supabase, genre)
      .lte("published_date", today())
      .order("published_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(start, end + 1);
    if (error) throw error;
    return page(data || []);
  }

  const ranks = sort === "popular" && genre ? await loadRanks() : null;
  if (!ranks) {
    const { data, error } = await base(supabase, genre).order("created_at", { ascending: false }).range(start, end + 1);
    if (error) throw error;
    return page(data || []);
  }

  const ids = rankedIds(ranks, genre);
  const slice = ids.slice(start, end + 1);
  let books = [];
  if (slice.length) {
    const { data, error } = await supabase.from("books").select("*").in("id", slice).not("cover_url", "is", null);
    if (error) throw error;
    const byId = new Map((data || []).map((b) => [b.id, b]));
    books = slice.map((id) => byId.get(id)).filter(Boolean);
  }
  if (ids.length > end + 1) return { books, hasMore: true };

  // Past the ranked books: whatever has been added since the file was written.
  const from = Math.max(0, start - ids.length);
  const to = end - ids.length;
  const { data: tail, error } = await base(supabase, genre)
    .gt("created_at", ranks.generatedAt)
    .order("created_at", { ascending: false })
    .range(from, to + 1);
  if (error) throw error;
  const room = to - from + 1;
  return { books: [...books, ...(tail || []).slice(0, room)], hasMore: (tail || []).length > room };
}

/** How many books with covers a genre has. */
export async function countCatalogue(supabase, genre) {
  const { count } = await base(supabase, genre, "id", { count: "exact", head: true });
  return count ?? null;
}

const HOME_LISTS = ["trending", "new", "fantasy", "science-fiction"];
const HOME_ROW = 24;

/**
 * Home's rows: { trending, new, fantasy, "science-fiction" }, each a list of
 * books. Read from the lists file when there is one, else from the catalogue.
 */
export async function loadHomeLists(supabase) {
  let lists = null;
  try {
    const res = await fetch(catalogueFileUrl(HOME_LISTS_PATH), { next: { revalidate: 300 } });
    const json = res.ok ? await res.json() : null;
    if (json?.lists && HOME_LISTS.some((k) => json.lists[k]?.length)) lists = json.lists;
  } catch {}

  if (lists) {
    const ids = [...new Set(HOME_LISTS.flatMap((k) => (lists[k] || []).slice(0, HOME_ROW)))];
    const { data } = await supabase.from("books").select(CARD_FIELDS).in("id", ids).not("cover_url", "is", null);
    const byId = new Map((data || []).map((b) => [b.id, b]));
    return Object.fromEntries(
      HOME_LISTS.map((k) => [k, (lists[k] || []).slice(0, HOME_ROW).map((id) => byId.get(id)).filter(Boolean)])
    );
  }

  const recent = new Date();
  recent.setMonth(recent.getMonth() - 18);
  const newest = (genre) => base(supabase, genre, CARD_FIELDS).order("created_at", { ascending: false }).limit(HOME_ROW);
  const [trending, fresh, fantasy, scifi] = await Promise.all([
    newest("sff"),
    base(supabase, "sff", CARD_FIELDS)
      .lte("published_date", today())
      .gte("published_date", recent.toISOString().slice(0, 10))
      .order("published_date", { ascending: false })
      .limit(HOME_ROW),
    newest("fantasy"),
    newest("science-fiction")
  ]);
  return {
    trending: trending.data || [],
    new: fresh.data || [],
    fantasy: fantasy.data || [],
    "science-fiction": scifi.data || []
  };
}
