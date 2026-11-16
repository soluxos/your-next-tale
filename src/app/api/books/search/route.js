import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { normaliseISBNdb } from "@/lib/books/adapters/isbndb";
import { normaliseOpenLibrary } from "@/lib/books/adapters/openlibrary";
import { normaliseGoogleBooks } from "@/lib/books/adapters/googlebooks";
import { searchGoogleBooks } from "@/lib/books/sources/googlebooks";
import { searchHardcover } from "@/lib/books/sources/hardcover";
import { isEnglish } from "@/lib/books/normaliseLanguage";
import {
  searchCatalog,
  findCatalogMatches,
  pickCanonical,
  looksLikeIsbn,
  normaliseText
} from "@/lib/books/catalogSearch";
import {
  describeWork,
  sameWork,
  titlesCompatible,
  fullAuthorNames,
  isOrgName,
  isBundle,
  normalise
} from "@/lib/books/sameBook";

// Any single external source that takes longer than this is skipped so one
// slow API never holds up the whole result list.
const SOURCE_TIMEOUT_MS = 6000;

/**
 * GET /api/books/search?q=...&source=local|online|all
 *
 *  - local  → our catalogue only (fast, used for instant results)
 *  - online → everything the instant "local" call didn't already return
 *              (online hits, plus catalogue books found via those hits)
 *  - all    → both, merged (default)
 *
 * One row per book: catalogue duplicates, editions and the same book from
 * several sources collapse into one (see lib/books/sameBook). Every result:
 *   { source, is_incomplete, in_catalog, catalog_ids, _raw, hardcover_id?,
 *     preview: { title, author, authors, year, isbn_13, isbn_10,
 *                cover_preview_url, all_covers } }
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 200);
  const mode = searchParams.get("source") || "all";

  if (!q) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const localBooks = await searchCatalog(supabase, q, 12);
  const localResults = localBooks.map(localToResult);

  if (mode === "local") {
    return NextResponse.json({ results: localResults });
  }

  const isIsbn = looksLikeIsbn(q);
  const isbnQuery = isIsbn ? q.replace(/[^0-9xX]/g, "") : null;
  const askIsbndb = !catalogueAnswers(localResults, isIsbn ? [] : significantTokens(q), isbnQuery);

  const [isbndbResults, olResults, gbResults, hcResults] = await Promise.all([
    withTimeout(askIsbndb ? fetchISBNdb(q, isbnQuery) : Promise.resolve([])),
    withTimeout(fetchOpenLibrary(q, isbnQuery)),
    withTimeout(searchGoogleBooks(isbnQuery ? `isbn:${isbnQuery}` : q, 8)),
    withTimeout(isIsbn ? Promise.resolve([]) : searchHardcover(q))
  ]);

  const external = [];

  for (const raw of isbndbResults) {
    const n = normaliseISBNdb(raw);
    if (n.language && !isEnglish(n.language)) continue;
    external.push(externalToResult("isbndb", raw, n));
  }
  for (const doc of olResults) {
    const n = normaliseOpenLibrary(doc);
    if (n.language && !isEnglish(n.language)) continue;
    external.push(externalToResult("openlibrary", doc, n));
  }
  for (const volumeInfo of gbResults) {
    const n = normaliseGoogleBooks(volumeInfo);
    if (n.language && !isEnglish(n.language)) continue;
    external.push(externalToResult("googlebooks", volumeInfo, n));
  }
  for (const result of hcResults) {
    result.preview.authors = result._raw?.author_names?.length
      ? result._raw.author_names
      : result.preview.author
        ? [result.preview.author]
        : [];
    result.preview.year = extractPublishYear(result._raw) || null;
    result.in_catalog = false;
    external.push(result);
  }

  // ── Swap in our catalogue copy for any online hit we already have ──────
  const matches = await findCatalogMatches(
    supabase,
    external.map((r) => r.preview)
  );
  const seenLocal = new Set(localResults.flatMap((r) => r.catalog_ids));
  const extraLocal = [];
  const matchedHits = []; // [online hit, catalogue book it is]
  const remaining = [];
  external.forEach((r, i) => {
    const book = matches.get(i);
    if (!book) return remaining.push(r);
    matchedHits.push([r, book]);
    if (book.catalog_ids.some((id) => seenLocal.has(id))) return;
    book.catalog_ids.forEach((id) => seenLocal.add(id));
    extraLocal.push(localToResult(book));
  });

  // ── One group per book ─────────────────────────────────────────────────
  // Catalogue copies first so they anchor their group; online hits we
  // matched to one join it (they keep the words the reader searched for —
  // "Mistborn: The Final Empire" is "The Final Empire" in our catalogue);
  // then everything else.
  const groups = [];
  const groupByCatalogId = new Map();
  function place(result, direct, into) {
    const work = describeWork(result.preview);
    const isbns = [result.preview?.isbn_13, result.preview?.isbn_10].filter(
      Boolean
    );
    let group =
      into ||
      groups.find((g) => sameWork(g.work, work)) ||
      groups.find(
        (g) =>
          isbns.some((i) => g.isbns.has(i)) &&
          titlesCompatible(g.work.core, work.core)
      );
    if (!group) {
      group = {
        work: { core: work.core, alt: work.alt, authors: new Set() },
        isbns: new Set(),
        members: [],
        direct: false
      };
      groups.push(group);
    }
    for (const a of work.authors) group.work.authors.add(a);
    isbns.forEach((i) => group.isbns.add(i));
    group.members.push(result);
    if (direct) group.direct = true;
    for (const id of result.catalog_ids || []) groupByCatalogId.set(id, group);
  }
  localResults.forEach((r) => place(r, true));
  extraLocal.forEach((r) => place(r, false));
  matchedHits.forEach(([r, book]) =>
    place(r, false, groupByCatalogId.get(book.id))
  );
  remaining.forEach((r) => place(r, false));

  const books = groups.map((g) => ({
    ...g,
    best: pickBest(g.members),
    local: g.members.some((r) => r.source === "local"),
    popularity: Math.max(0, ...g.members.map(popularity))
  }));

  // ── Drop what isn't the book being searched for ─────────────────────────
  const queryNorm = normalise(q);
  const queryTokens = isIsbn ? [] : significantTokens(q);

  // Full names of the real authors in these results ("george orwell") —
  // a title that mentions one but is by someone else is *about* that book.
  const knownAuthors = new Set();
  for (const b of books) {
    if (b.local || b.best.source === "hardcover") {
      fullAuthorNames(b.best.preview.authors).forEach((n) =>
        knownAuthors.add(n)
      );
    }
  }

  let kept = books.filter((b) => {
    if (b.direct) return true;
    const p = b.best.preview;
    // Any copy may carry the words searched for — "Mistborn: The Final
    // Empire" online is "The Final Empire" in our catalogue.
    if (!b.members.some((r) => matchesAll(r, queryTokens))) return false;
    if (b.local) return true;
    if (isKnockoff(p.title, queryNorm) || isBundle(p.title)) return false;
    if (!isIsbn && isAboutAnotherBook(p, knownAuthors, queryNorm)) return false;
    return true;
  });

  // Same title, different author ("Piranesi" by Susanna Clarke vs four
  // obscure "Piranesi"s): show the book people mean, plus any namesake that
  // is in our catalogue, well read, or whose author the query names.
  const byCore = new Map();
  for (const b of kept) {
    if (!byCore.has(b.work.core)) byCore.set(b.work.core, []);
    byCore.get(b.work.core).push(b);
  }
  const hidden = new Set();
  for (const [core, twins] of byCore) {
    if (twins.length < 2) continue;
    const primary =
      twins.find((b) => b.local) ||
      [...twins].sort((a, b) => b.popularity - a.popularity)[0];
    // Words the reader typed beyond the title — "piranesi harvey" names an
    // author; plain "piranesi" doesn't, even though an artist is called that.
    const coreWords = new Set(core.split(" "));
    const extra = queryNorm.split(" ").filter((w) => w && !coreWords.has(w));
    for (const b of twins) {
      if (b === primary || b.local || b.popularity >= 100) continue;
      if ([...b.work.authors].some((a) => extra.includes(a))) continue;
      hidden.add(b);
    }
  }
  kept = kept.filter((b) => !hidden.has(b));

  // Catalogue first (in relevance order), then online results — those with
  // a cover before those without, then well-read books, then source order.
  const ranked = [
    ...kept.filter((b) => b.local),
    ...kept
      .filter((b) => !b.local)
      .map((b, i) => ({ b, i }))
      .sort(
        (x, y) =>
          !!y.b.best.preview?.cover_preview_url -
            !!x.b.best.preview?.cover_preview_url ||
          (y.b.popularity >= 100) - (x.b.popularity >= 100) ||
          sourceRank(x.b.best.source) - sourceRank(y.b.best.source) ||
          x.i - y.i
      )
      .map(({ b }) => b)
  ];

  // "online" is the second half of a two-request search: the client already
  // shows the instant catalogue hits, so only return what's new.
  const results = (
    mode === "online" ? ranked.filter((b) => !b.direct) : ranked
  ).map((b) => b.best);

  return NextResponse.json({ results: results.slice(0, 24) });
}

// ── Result shaping ─────────────────────────────────────────────────────────

function localToResult(book) {
  return {
    source: "local",
    in_catalog: true,
    is_incomplete: book.is_incomplete || false,
    catalog_ids: book.catalog_ids || [book.id],
    _raw: book,
    preview: {
      title: book.title,
      // Bad imports list the publisher as author — show no author instead.
      author: book.authors?.find((a) => !isOrgName(a)) || null,
      authors: (book.authors || []).filter((a) => !isOrgName(a)),
      year: extractPublishYear(book) || null,
      isbn_13: book.isbn_13,
      isbn_10: book.isbn_10,
      cover_preview_url: book.cover_url
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${book.cover_url}`
        : null
    }
  };
}

function externalToResult(source, raw, n) {
  return {
    source,
    in_catalog: false,
    is_incomplete: checkIncomplete(n),
    _raw: raw,
    preview: {
      title: n.title,
      author: n.authors?.[0] || null,
      authors: n.authors || [],
      year: extractPublishYear(raw) || null,
      isbn_13: n.isbn_13,
      isbn_10: n.isbn_10,
      cover_preview_url: n.cover_remote || null
    }
  };
}

function pickBest(group) {
  // A catalogue copy always wins — it's already normalised and has our cover.
  const locals = group.filter((r) => r.source === "local");
  const score = (r) => {
    let s = 0;
    if (r.preview?.cover_preview_url) s += 2;
    if (r.preview?.isbn_13) s += 1;
    if (r.preview?.author) s += 1;
    if (!r.is_incomplete) s += 1;
    if (r.source === "hardcover") s += 15;
    const reads = popularity(r);
    if (reads > 1000) s += 10;
    else if (reads > 100) s += 5;
    // Prefer more recent editions — newer covers & ISBNs.
    const year = extractPublishYear(r._raw);
    if (year >= 2015) s += 3;
    else if (year >= 2005) s += 2;
    else if (year >= 1990) s += 1;
    return s;
  };
  let best;
  if (locals.length > 1) {
    const canonical = pickCanonical(locals.map((r) => r._raw));
    best = locals.find((r) => r._raw === canonical);
  } else {
    best = locals[0] || [...group].sort((a, b) => score(b) - score(a))[0];
  }
  const out = { ...best, preview: { ...best.preview } };
  if (locals.length) {
    out.catalog_ids = [...new Set(locals.flatMap((r) => r.catalog_ids))];
  }

  const covers = [];
  for (const r of group) {
    const url = r.preview?.cover_preview_url;
    if (url && !covers.includes(url)) covers.push(url);
  }
  out.preview.all_covers = covers;

  for (const field of ["isbn_13", "isbn_10", "year"]) {
    if (!out.preview[field]) {
      const donor = group.find((r) => r.preview?.[field]);
      if (donor) out.preview[field] = donor.preview[field];
    }
  }
  // "Turtleback Books Publishing" isn't who wrote Chapterhouse: Dune.
  if (!out.preview.author || isOrgName(out.preview.author)) {
    const donor = group.find(
      (r) => r.preview?.author && !isOrgName(r.preview.author)
    );
    if (donor) {
      out.preview.author = donor.preview.author;
      out.preview.authors = donor.preview.authors?.length
        ? donor.preview.authors
        : [donor.preview.author];
    }
  }
  if (!out.preview.cover_preview_url && covers[0]) {
    out.preview.cover_preview_url = covers[0];
  }
  return out;
}

/** How many readers a source says this book has (0 if it doesn't say). */
function popularity(r) {
  return (
    r.preview?.users_read_count ||
    r._raw?.users_read_count ||
    r._raw?.readinglog_count ||
    r._raw?.ratingsCount ||
    0
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function withTimeout(promise, ms = SOURCE_TIMEOUT_MS) {
  return Promise.race([
    promise.catch(() => []),
    new Promise((resolve) => setTimeout(() => resolve([]), ms))
  ]);
}

/**
 * Extract a publication year from the raw object returned by any source.
 */
function extractPublishYear(raw) {
  const d =
    raw?.publishedDate ||
    raw?.date_published ||
    raw?.publish_date ||
    raw?.published_date ||
    raw?.first_publish_year ||
    raw?.release_year ||
    null;
  if (!d) return 0;
  const m = String(d).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

// Study guides, summaries, "epilogue for…" cash-ins, scraped listings and
// companion books clog up online results for popular titles and are almost
// never what someone is adding. A term the query itself asks for is allowed
// ("hobbit companion" still finds the companion).
const KNOCKOFF_TERMS = [
  /\bsummary (?:of|and|&)\b|\bsummary:|^summary\b/i,
  /\bstudy guide\b/i,
  /\banalysis of\b/i,
  /\bworkbook (?:for|on)\b/i,
  /\bepilogue for\b/i,
  /\bsparknotes\b|\bcliffs ?notes\b/i,
  /\bbook review of\b/i,
  /\(author\)/i, // "(The Name of the Wind) By Rothfuss, Patrick (Author) Paperback"
  /\bthings you (?:don'?t|didn'?t|never)\b/i,
  /\bintimate revelations\b/i,
  /\btrivia\b|\bquiz\b/i,
  /\bunofficial\b/i,
  /\bcompanion\b/i,
  /\bsketchbook\b/i,
  /\bcolou?ring book\b/i,
  /\badapt(?:ed|ation)\b/i,
  /\btext guide\b|\b(?:study|york|coles|atar) notes\b|\breader'?s guide\b|\bteaching guide\b|\blesson plans?\b/i,
  /\bbox(?:ed)? set\b|\bcollection set\b|\b\d+ books? (?:collection|set|bundle)\b|\bbooks? \d+\s*[-–]\s*\d+\b/i,
  /\bsampler\b/i
];

function isKnockoff(title, queryNorm) {
  const t = title || "";
  return KNOCKOFF_TERMS.some((re) => {
    const m = t.match(re);
    if (!m) return false;
    const words = normalise(m[0]).split(" ").filter(Boolean);
    return !words.every((w) => queryNorm.split(" ").includes(w));
  });
}

// "George Orwell's 1984" by Robert Owens, "The Art of The Hobbit by J.R.R.
// Tolkien" by Wayne Hammond: the title names an author who didn't write it.
function isAboutAnotherBook(preview, knownAuthors, queryNorm) {
  const title = ` ${normalise(preview?.title)} `;
  const own = new Set(fullAuthorNames(preview?.authors));
  for (const name of knownAuthors) {
    if (own.has(name) || queryNorm.includes(name)) continue;
    if (title.includes(` ${name} `)) return true;
  }
  return false;
}

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "by", "in", "on"]);

function significantTokens(q) {
  return normaliseText(q)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Online sources match loosely (full text, subjects…). Only keep hits where
// every meaningful word of the query is in the title, author or series
// ("mistborn" → The Well of Ascension, via Hardcover's series names).
function matchesAll(result, tokens) {
  if (!tokens.length) return true;
  const p = result.preview;
  const hay = normaliseText(
    `${p?.title || ""} ${(p?.authors || []).join(" ")} ${p?.author || ""} ${(result._raw?.series_names || []).join(" ")}`
  );
  return tokens.every((t) => hay.includes(t));
}

const SOURCE_RANK = { hardcover: 0, googlebooks: 1, isbndb: 2, openlibrary: 3 };
function sourceRank(source) {
  return SOURCE_RANK[source] ?? 9;
}

function checkIncomplete(n) {
  if (!n.title) return true;
  if (!n.authors || n.authors.length === 0) return true;
  if (!n.description) return true;
  if (!n.isbn_13 && !n.isbn_10) return true;
  if (!n.cover_remote) return true;
  return false;
}

// ── ISBNdb: metered ────────────────────────────────────────────────────────
// 5,000 calls a day, shared with the releases sync and the catalogue import.
// The free sources (Open Library, Google Books, Hardcover) run on every
// search; ISBNdb only when our catalogue hasn't already got the book, and a
// query asked again within a few hours is answered from memory.

/** The catalogue already has what was searched for: a complete book matching every word, or that ISBN. */
function catalogueAnswers(localResults, tokens, isbn) {
  if (isbn) {
    return localResults.some((r) => [r.preview?.isbn_13, r.preview?.isbn_10].includes(isbn));
  }
  if (tokens.length === 0 || tokens.join("").length < 3) return true; // too short to be worth a call
  return localResults.some((r) => !r.is_incomplete && matchesAll(r, tokens));
}

const ISBNDB_CACHE_MS = 6 * 60 * 60 * 1000;
const isbndbCache = new Map(); // normalised query → { at, books }
let isbndbPausedUntil = 0; // after a "daily quota used up" answer

async function fetchISBNdb(query, isbn) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey || Date.now() < isbndbPausedUntil) return [];
  const cacheKey = isbn || normaliseText(query);
  const hit = isbndbCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ISBNDB_CACHE_MS) return hit.books;
  try {
    const headers = { Authorization: apiKey, Accept: "application/json" };
    const url = isbn
      ? `https://api2.isbndb.com/book/${isbn}`
      : `https://api2.isbndb.com/books/${encodeURIComponent(query)}?page=1&pageSize=5&language=en`;
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      // A long wait is the daily allowance: stop asking until it resets.
      const wait = Number(res.headers.get("retry-after")) || 0;
      if (wait > 65) isbndbPausedUntil = Date.now() + wait * 1000;
      return [];
    }
    if (!res.ok) return [];
    const data = await res.json();
    const books = isbn ? (data.book ? [data.book] : []) : data.books || [];
    if (isbndbCache.size > 500) isbndbCache.delete(isbndbCache.keys().next().value);
    isbndbCache.set(cacheKey, { at: Date.now(), books });
    return books;
  } catch (e) {
    console.error("ISBNdb search error:", e);
    return [];
  }
}

async function fetchOpenLibrary(query, isbn) {
  try {
    const param = isbn
      ? `isbn=${encodeURIComponent(isbn)}`
      : `q=${encodeURIComponent(query)}`;
    const url = `https://openlibrary.org/search.json?${param}&limit=6&language=eng&fields=*,readinglog_count,ratings_count`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.docs || [];
  } catch (e) {
    console.error("Open Library search error:", e);
    return [];
  }
}
