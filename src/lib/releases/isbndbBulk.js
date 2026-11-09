// ISBNdb's bulk endpoint: up to 100 ISBNs in one request. Used to fill in
// the facts for books a retailer list names but whose page we don't read.
// Server only — ISBNDB_API_KEY never reaches the browser.
//
// The daily allowance (5,000) counts books, not requests: a bulk request for
// 100 ISBNs uses 100 of it. Bulk saves requests and time, not allowance.
import { sanitiseDescription } from "@/lib/books/sanitiseDescription";
import { describeWork, authorsOverlap, isBundle, normalise as plainText } from "@/lib/books/sameBook";

const CHUNK = 100;
const GAP_MS = 1100;

/**
 * ISBNdb's daily allowance is used up (it answers 429). Thrown rather than
 * returning nothing, so a sync stops and keeps its last list instead of
 * publishing a thin one, and doesn't cache "no editions" for a month.
 */
export class IsbndbLimitError extends Error {}

// One ISBNdb request at a time, a little over a second apart, however many
// callers there are (the sync checks three books at once).
let nextSlot = 0;
async function waitTurn() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + GAP_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

// ISBNdb writes authors "Maas, Sarah J."; everything else we hold says
// "Sarah J. Maas".
function flipName(name) {
  const s = String(name || "").trim();
  const m = s.match(/^([^,]+),\s*([^,]+)$/);
  return m ? `${m[2]} ${m[1]}` : s;
}

// "Science Fiction & Fantasy" is a shelf, not a genre: it says nothing about
// which of the two a book is.
const SHELF = /^(?:science fiction (?:&|and) fantasy|fantasy (?:&|and) science fiction|sci-fi (?:&|and) fantasy)$/i;

export function genresFromSubjects(subjects) {
  const out = new Set();
  for (const raw of subjects || []) {
    const s = String(raw).trim();
    if (SHELF.test(s)) continue;
    if (/fantasy|romantasy|sword & sorcery|dragons|fairies|magic/i.test(s)) out.add("fantasy");
    if (/science fiction|space opera|cyberpunk|dystopi|time travel|aliens/i.test(s)) out.add("science-fiction");
  }
  return [...out];
}

function normalise(raw) {
  const date = String(raw.date_published || "");
  return {
    shop: "isbndb",
    isbn: raw.isbn13 || null,
    title: raw.title || null,
    authors: (raw.authors || []).map(flipName).filter(Boolean),
    description: sanitiseDescription(raw.synopsis || raw.overview || null),
    // A year on its own ("2026") isn't a release date.
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    published: date || null,
    // The latest day a vaguer date could mean ("2025" → 2025-12-31), for
    // spotting editions of books that are already out.
    dateHint: /^\d{4}$/.test(date) ? `${date}-12-31` : /^\d{4}-\d{2}$/.test(date) ? `${date}-28` : null,
    pages: Number(raw.pages) || null,
    publisher: raw.publisher || null,
    isbn10: raw.isbn10 || null,
    format: raw.binding || null,
    language: raw.language || null,
    // The full-size artwork first (often 1500px+), then ISBNdb's resized copy.
    covers: [...new Set([raw.image_original, raw.image].filter(Boolean))],
    subjects: raw.subjects || [],
    genres: genresFromSubjects(raw.subjects),
    children: (raw.subjects || []).some((s) => /juvenile fiction|children's books/i.test(s))
  };
}

// What is left of today's allowance, from ISBNdb's
// `ratelimit: "daily";r=<left>;t=<seconds to reset>` header. Null until the
// first request. The header says what was left before the request it answers
// (a 100-ISBN request reads 4999 on a fresh day, the next one 4899), so the
// request's own cost comes off it here.
let quota = null;
export function isbndbQuota() {
  return quota;
}
function noteQuota(res, cost) {
  const m = String(res.headers.get("ratelimit") || "").match(/"daily";r=(\d+);t=(\d+)/);
  if (m) quota = { remaining: Math.max(0, Number(m[1]) - cost), resetsAt: new Date(Date.now() + Number(m[2]) * 1000) };
}

// A 429 with a short wait is the per-minute limit: wait once and retry. A
// long one is the daily allowance. `cost`: how many books the request asks for.
async function isbndbFetch(url, init, cost = 1) {
  for (let attempt = 0; ; attempt++) {
    await waitTurn();
    const res = await fetch(url, init());
    noteQuota(res, res.ok ? cost : 0);
    if (res.status !== 429) return res;
    const wait = Number(res.headers.get("retry-after")) || 0;
    if (attempt || !wait || wait > 65) throw new IsbndbLimitError("ISBNdb's daily allowance is used up");
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

/** Map of ISBN-13 → facts, for whichever of `isbns` ISBNdb knows. */
export async function isbndbBooks(isbns, { log = () => {} } = {}) {
  const key = process.env.ISBNDB_API_KEY;
  const out = new Map();
  const list = [...new Set(isbns.filter((i) => /^97[89]\d{10}$/.test(i)))];
  if (!key || !list.length) return out;
  for (let i = 0; i < list.length; i += CHUNK) {
    const chunk = list.slice(i, i + CHUNK);
    try {
      const res = await isbndbFetch(
        "https://api2.isbndb.com/books",
        () => ({
          method: "POST",
          headers: { Authorization: key, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: `isbns=${chunk.join(",")}`,
          signal: AbortSignal.timeout(30000)
        }),
        chunk.length
      );
      if (!res.ok) {
        log(`isbndb: bulk lookup answered ${res.status}`);
        continue;
      }
      const json = await res.json();
      for (const raw of json.data || []) if (raw.isbn13) out.set(raw.isbn13, normalise(raw));
    } catch (e) {
      if (e instanceof IsbndbLimitError) throw e;
      log(`isbndb: bulk lookup failed (${e.message})`);
    }
  }
  return out;
}

/** Best guess at the trade ISBN for a title and author (for shop-exclusive editions). */
export async function isbndbFindIsbn(title, author) {
  const key = process.env.ISBNDB_API_KEY;
  if (!key) return [];
  const q = encodeURIComponent(`${title} ${author || ""}`.trim());
  try {
    const res = await isbndbFetch(`https://api2.isbndb.com/books/${q}?page=1&pageSize=20&language=en`, () => ({
      headers: { Authorization: key, Accept: "application/json" },
      signal: AbortSignal.timeout(20000)
    }));
    if (!res.ok) return [];
    const json = await res.json();
    return (json.books || []).map(normalise);
  } catch (e) {
    if (e instanceof IsbndbLimitError) throw e;
    return [];
  }
}

/**
 * ISBNdb's other editions of this book → { first, editions }.
 *
 * `first`: the earliest date any edition came out, or null. A shop's "new"
 * hardback of a book that was out (self-published, or in another country)
 * months ago is a reissue.
 * `editions`: each edition's ISBN, format, covers and description, for when
 * the edition the shops list has no usable cover or blurb (a deluxe edition
 * whose only picture is a 3D mock-up of its sprayed edges).
 *
 * Stricter than sameWork: the edition's full title has to be this title,
 * maybe with a subtitle added. "Red Dwarf" (1996) isn't "Red Dwarf: Titan",
 * and "On the Calculation of Volume (Book I)" isn't Book V.
 */
export async function isbndbEditions(title, author, releaseDate) {
  const want = describeWork({ title, authors: author ? [author] : [] });
  const key = titleKey(title);
  if (!key || !want.authors.size) return { first: null, editions: [] };
  // A month counts as its last days. A bare year only counts when it's two or
  // more years back: "2021" for Winterset Hollow, not "2026" for a book whose
  // record was made before its date was set.
  const year = Number(String(releaseDate || "").slice(0, 4)) || 0;
  const when = (b) =>
    b.releaseDate ||
    (/^\d{4}-\d{2}$/.test(b.published || "") ? `${b.published}-28` : null) ||
    (/^\d{4}$/.test(b.published || "") && year && Number(b.published) <= year - 2 ? `${b.published}-12-31` : null);
  const editions = (await isbndbFindIsbn(title, author)).filter((b) => {
    if (isBundle(b.title || "")) return false;
    const have = describeWork({ title: b.title, authors: b.authors });
    const k = titleKey(b.title);
    return have.authors.size && authorsOverlap(want.authors, have.authors) && (k === key || k.startsWith(`${key} `));
  });
  const dates = editions.map(when).filter((d) => d && d >= "1900").sort();
  return {
    first: dates[0] || null,
    editions: editions.map((b) => ({
      isbn: b.isbn,
      title: b.title,
      format: b.format,
      releaseDate: b.releaseDate,
      covers: b.covers,
      description: b.description
    }))
  };
}

// "Cello's Gate - The Exhilarating First Book in…" / "…: A Novel" → the title.
const titleKey = (t) =>
  plainText(
    String(t || "")
      .replace(/\s+[-–—]\s+.*$/, "")
      .replace(/:\s*a novel$/i, "")
  );
