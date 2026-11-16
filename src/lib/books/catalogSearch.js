import { TABLES } from "@/lib/supabase/types";
import {
  describeWork,
  sameWork,
  titlesCompatible,
  normalise
} from "@/lib/books/sameBook";

/**
 * Catalogue search over our own `books` table.
 *
 * PostgREST can't do partial matches inside a text[] column (authors), and
 * raw user input inside an `.or()` filter breaks on commas / parentheses.
 * Instead we keep a small in-memory index of { id, title, authors, isbn } and
 * match every query token against "title + authors". The catalogue is a few
 * thousand rows at most, so this is cheap and gives far better results
 * ("wight cradle", "leckie", "harry potter 3" all work).
 */

const INDEX_TTL_MS = 5 * 60 * 1000;
let indexCache = { rows: null, builtAt: 0, promise: null };

export const CATALOG_SELECT =
  "id, title, authors, isbn_13, isbn_10, cover_url, is_incomplete, description, genres, page_count, published_date, publisher, language, bookshop_affiliate_link, source, last_synced_at, hardcover_id, created_at";

export function normaliseText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function looksLikeIsbn(q) {
  const digits = (q || "").replace(/[^0-9xX]/g, "");
  return digits.length === 10 || digits.length === 13;
}

async function loadIndex(supabase) {
  const fresh = Date.now() - indexCache.builtAt < INDEX_TTL_MS;
  if (indexCache.rows && fresh) return indexCache.rows;
  if (indexCache.promise) return indexCache.promise;

  indexCache.promise = (async () => {
    const rows = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(TABLES.BOOKS)
        .select("id, title, authors, isbn_13, isbn_10, created_at")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    const indexed = rows.map((r) => {
      const title = normaliseText(r.title);
      const authors = normaliseText((r.authors || []).join(" "));
      return {
        id: r.id,
        title,
        authors,
        haystack: `${title} ${authors}`,
        work: describeWork(r),
        isbn_13: r.isbn_13,
        isbn_10: r.isbn_10,
        created_at: r.created_at
      };
    });
    indexCache = { rows: indexed, builtAt: Date.now(), promise: null };
    return indexed;
  })();

  try {
    return await indexCache.promise;
  } catch (e) {
    indexCache.promise = null;
    throw e;
  }
}

/** Call after inserting a book so it becomes searchable immediately. */
export function invalidateCatalogIndex() {
  indexCache = { rows: null, builtAt: 0, promise: null };
}

function scoreRow(row, q, tokens) {
  let score = 0;
  if (row.title === q) score += 100;
  else if (row.title.startsWith(q)) score += 60;
  else if (row.title.includes(q)) score += 40;
  if (row.authors.includes(q)) score += 30;
  for (const t of tokens) {
    if (row.title.split(" ").includes(t)) score += 5;
    if (row.authors.split(" ").includes(t)) score += 4;
  }
  return score;
}

/** Every catalogue row that is the same book as `row` (including itself). */
function copiesOf(index, row) {
  return index.filter((r) => r === row || sameWork(r.work, row.work));
}

const ENGLISH_RE = /^(en|eng|english)\b/i;

/**
 * The catalogue has the same book more than once (different editions,
 * imports). Pick the copy to show: a cover, a clean title, English.
 */
export function pickCanonical(rows) {
  const score = (b) => {
    const { core } = describeWork(b);
    const plain = normalise(b.title).replace(/^(?:the|a|an) /, "");
    return (
      (b.cover_url ? 3 : 0) +
      (plain === core ? 3 : 0) +
      (!b.language || ENGLISH_RE.test(b.language) ? 2 : 0) +
      (b.description ? 1 : 0) +
      (!b.is_incomplete ? 1 : 0) +
      (b.isbn_13 ? 1 : 0)
    );
  };
  return [...rows].sort(
    (a, b) =>
      score(b) - score(a) ||
      String(a.created_at || "").localeCompare(String(b.created_at || ""))
  )[0];
}

/** Fetch rows for groups of ids → canonical row per group, with catalog_ids. */
async function loadCanonical(supabase, idGroups) {
  const ids = [...new Set(idGroups.flat())];
  if (!ids.length) return idGroups.map(() => null);
  const { data, error } = await supabase
    .from(TABLES.BOOKS)
    .select(CATALOG_SELECT)
    .in("id", ids);
  if (error) {
    console.error("[catalogSearch] fetch failed:", error.message);
    return idGroups.map(() => null);
  }
  const byId = new Map((data || []).map((b) => [b.id, b]));
  return idGroups.map((group) => {
    const rows = group.map((id) => byId.get(id)).filter(Boolean);
    if (!rows.length) return null;
    return { ...pickCanonical(rows), catalog_ids: rows.map((r) => r.id) };
  });
}

/**
 * Given external search hits ({ title, author(s), isbn_13, isbn_10 }), find
 * the catalogue book each one is, so we show (and add) our copy instead of
 * creating a duplicate. Returns Map<hitIndex, canonicalBookRow>.
 */
export async function findCatalogMatches(supabase, hits) {
  const out = new Map();
  if (!hits.length) return out;

  let index;
  try {
    index = await loadIndex(supabase);
  } catch {
    return out;
  }

  const byIsbn = new Map();
  const byTitle = new Map(); // main title and "series: title" subtitle
  const addTitle = (key, row) => {
    if (!key) return;
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(row);
  };
  for (const row of index) {
    if (row.isbn_13) byIsbn.set(row.isbn_13, row);
    if (row.isbn_10) byIsbn.set(row.isbn_10, row);
    addTitle(row.work.core, row);
    addTitle(row.work.alt, row);
  }

  const matched = [];
  hits.forEach((hit, i) => {
    const work = describeWork(hit);
    let row =
      (hit.isbn_13 && byIsbn.get(hit.isbn_13)) ||
      (hit.isbn_10 && byIsbn.get(hit.isbn_10)) ||
      null;
    // Catalogue ISBNs aren't always right — the titles must agree too.
    if (row && !titlesCompatible(row.work.core, work.core)) row = null;
    if (!row) {
      const candidates = [
        ...(byTitle.get(work.core) || []),
        ...(work.alt ? byTitle.get(work.alt) || [] : [])
      ];
      row = candidates.find((c) => sameWork(c.work, work));
    }
    if (row) matched.push([i, copiesOf(index, row).map((r) => r.id)]);
  });

  const books = await loadCanonical(
    supabase,
    matched.map(([, ids]) => ids)
  );
  matched.forEach(([i], n) => {
    if (books[n]) out.set(i, books[n]);
  });
  return out;
}

/**
 * Search the catalogue. Returns one row per book (the best copy, with
 * `catalog_ids` listing every copy of it), best match first.
 */
export async function searchCatalog(supabase, rawQuery, limit = 12) {
  const q = normaliseText(rawQuery);
  if (!q) return [];

  let index;
  try {
    index = await loadIndex(supabase);
  } catch (e) {
    console.error("[catalogSearch] index load failed:", e.message);
    return [];
  }

  // Exact ISBN lookup first
  if (looksLikeIsbn(rawQuery)) {
    const isbn = rawQuery.replace(/[^0-9xX]/g, "").toUpperCase();
    const hits = index.filter((r) => r.isbn_13 === isbn || r.isbn_10 === isbn);
    if (hits.length) {
      const groups = groupRows(index, hits, limit);
      return (await loadCanonical(supabase, groups)).filter(Boolean);
    }
  }

  const tokens = q.split(" ").filter(Boolean);
  const matches = [];
  for (const row of index) {
    if (tokens.every((t) => row.haystack.includes(t))) {
      matches.push({ row, score: scoreRow(row, q, tokens) });
    }
  }
  matches.sort((a, b) => b.score - a.score);

  const groups = groupRows(
    index,
    matches.map((m) => m.row),
    limit
  );
  return (await loadCanonical(supabase, groups)).filter(Boolean);
}

/** Ranked rows → up to `limit` books, each the ids of all its copies. */
function groupRows(index, rows, limit) {
  const groups = [];
  for (const row of rows) {
    if (groups.some((g) => g.rows.some((r) => r === row))) continue;
    if (groups.length >= limit) break;
    groups.push({ rows: copiesOf(index, row) });
  }
  return groups.map((g) => g.rows.map((r) => r.id));
}
