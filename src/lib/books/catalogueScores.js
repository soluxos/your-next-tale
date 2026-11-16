// How popular each catalogue book is, worked out from what the import's
// sources said about it (see catalogueSources.js). Pure: no network, no
// database. The import script feeds it the books and their signals and stores
// the result as the files catalogueRanks.js reads.
//
// A book's signals:
//   ol          { readers, want, rating, ratings }        Open Library reading logs
//   hc          { id, users, read, rating, ratings }      Hardcover shelves
//   hcTrending  { month: { rank, of }, three_month: … }   place on Hardcover's trending lists
//   spl         { checkouts }                             Seattle Public Library, last few months
//   lists       [{ list, rank, size, weight, kind }]      bookshop best-seller and new lists
import { genreMatchValues } from "@/lib/genres";
import { normalise } from "@/lib/books/sameBook";

// Counts span four orders of magnitude, so each is read on a log scale, 0 to 1.
export const hcScale = (users) => Math.min(1, Math.log10(1 + (users || 0)) / 4.3);
export const olScale = (readers) => Math.min(1, Math.log10(1 + (readers || 0)) / 4.5);
export const splScale = (checkouts) => Math.min(1, Math.log10(1 + (checkouts || 0)) / 3.5);

/**
 * The best place a book holds on any bookshop list, 0 to 1: the list's weight
 * at the top, 40% of it at the bottom. `newLists` scales lists of new books,
 * which say less about what's selling than a best-seller list does.
 */
export function listScore(lists, { newLists = 1 } = {}) {
  let best = 0;
  for (const l of lists || []) {
    const place = l.size > 1 ? 1 - 0.6 * (l.rank / (l.size - 1)) : 1;
    best = Math.max(best, (l.weight || 0) * place * (l.kind === "new" ? newLists : 1));
  }
  return best;
}

/**
 * How widely read a book is, 0 to 1, or null when no source knows it.
 * Hardcover's readers are closest to ours, so it leads; a book only one of
 * the two knows gets a discounted guess for the other.
 */
export function popularity(s = {}) {
  const H = s.hc ? hcScale(s.hc.users) : null;
  const O = s.ol ? olScale(s.ol.readers) : null;
  const R = listScore(s.lists);
  if (H == null && O == null && !R) return null;
  return 0.55 * (H ?? 0.6 * (O ?? 0)) + 0.25 * (O ?? 0.6 * (H ?? 0)) + 0.2 * R;
}

/**
 * How much a book is being picked up right now, 0 to 1. `age` is years since
 * it came out: library checkouts of an old favourite are steady, not a trend,
 * so they count half.
 */
export function trendingScore(s = {}, age = 0) {
  const place = (t) => (t && t.of > 0 ? 1 - t.rank / t.of : 0);
  const library = s.spl ? splScale(s.spl.checkouts) * (age > 5 ? 0.5 : 1) : 0;
  // Nineteen Eighty-Four is on every month's list; that's a classic being a
  // classic. The older the book, the less its place says about this month.
  const steady = age <= 2 ? 1 : age <= 6 ? 0.9 : age <= 15 ? 0.7 : 0.5;
  return Math.min(
    1,
    steady * (0.45 * place(s.hcTrending?.month) + 0.2 * place(s.hcTrending?.three_month)) +
      0.2 * library +
      0.3 * listScore(s.lists, { newLists: 0.6 })
  );
}

// "Science Fiction & Fantasy" says a book is one or the other, not which.
const EITHER = new Set(["science fiction & fantasy", "science fiction fantasy", "speculative fiction", "sff"]);

// Subjects that only one of the two has. They settle which genre leads for a
// book filed under both.
const SCIFI_HINT =
  /dystopi|\bspace|\balien|genetic engineering|first contact|apocalyp|cyberpunk|\brobot|artificial intelligence|hard science fiction|military science fiction/;
const FANTASY_HINT =
  /\bepic\b|romantasy|paranormal|\bmagic|occult|supernatural|fair(?:y|ies)|\bfae\b|dragon|\bwitch|wizard|vampire|mytholog|sorcery|(?:dark|urban|high) fantasy/;

/**
 * Which genre a book is. Publishers file a lot of science fiction under
 * fantasy as well, and the other way round. What else it is filed under says
 * which it mainly is (Fahrenheit 451: "fantasy, science fiction, dystopian");
 * when that doesn't settle it, the genre that comes first in its list does:
 *   "f" / "s"  fantasy / science fiction, and not the other
 *   "F" / "S"  both, mainly that one
 *   "b"        nothing says which
 * Null when it is neither. `fantasy` and `scifi` are sets of lower-case
 * genre names.
 */
export function genreFlag(genres, fantasy, scifi) {
  let f = -1;
  let s = -1;
  let either = false;
  let lean = 0; // above zero: more fantasy hints than science fiction ones
  (genres || []).forEach((raw, i) => {
    const g = String(raw || "").toLowerCase();
    if (EITHER.has(g)) {
      either = true;
      return;
    }
    if (fantasy.has(g)) f = f < 0 ? i : f;
    else if (scifi.has(g)) s = s < 0 ? i : s;
    if (SCIFI_HINT.test(g)) lean -= 1;
    else if (FANTASY_HINT.test(g)) lean += 1;
  });
  if (f < 0 && s < 0) return either ? "b" : null;
  if (s < 0) return either ? "F" : "f";
  if (f < 0) return "s";
  if (lean) return lean > 0 ? "F" : "S";
  return f < s ? "F" : "S";
}

// "Most loved": the average rating, pulled towards a typical 3.9 until enough
// people have rated it, with a little extra for being widely read.
const LOVED_MIN_RATINGS = 100;
function lovedScore(s, pop) {
  const hcN = s.hc?.rating ? s.hc.ratings || 0 : 0;
  const olN = s.ol?.rating ? s.ol.ratings || 0 : 0;
  const n = hcN + olN;
  if (n < LOVED_MIN_RATINGS) return null;
  const mean = ((s.hc?.rating || 0) * hcN + (s.ol?.rating || 0) * olN) / n;
  return (mean * n + 3.9 * 150) / (n + 150) + 0.25 * (pop || 0);
}

// "J. R. R. Tolkien" and "John Ronald Reuel Tolkien" are one author.
function authorId(name) {
  const parts = normalise(name || "").split(" ").filter(Boolean);
  return parts.length ? `${parts[parts.length - 1]} ${parts[0][0]}` : "";
}

/** Keep one author from turning up twice within `gap` places. */
export function spaceAuthors(sorted, { gap = 6, lookAhead = 40 } = {}) {
  const pool = [...sorted];
  const out = [];
  while (pool.length) {
    const recent = new Set(out.slice(-gap).map((e) => e.author));
    let i = pool.slice(0, lookAhead).findIndex((e) => !e.author || !recent.has(e.author));
    if (i < 0) i = 0;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Every fantasy and science fiction book with a cover, most popular first.
 * `books` are rows with { id, authors, genres, published_date, created_at,
 * cover_url }; `signals` maps book id → signals. Books no source knows go
 * last, newest added first.
 *
 * Returns { ranks, entries }: `ranks` is the file Discover reads; `entries`
 * carry each book's scores, for homeLists().
 */
export function rankCatalogue(books, signals = {}, { now = new Date() } = {}) {
  const year = now.getUTCFullYear();
  const lower = (slug) => new Set(genreMatchValues(slug).map((g) => g.toLowerCase()));
  const fantasy = lower("fantasy");
  const scifi = lower("science-fiction");
  const entries = [];
  for (const b of books) {
    if (!b.cover_url) continue;
    const flag = genreFlag(b.genres, fantasy, scifi);
    if (!flag) continue;
    const sig = signals[b.id] || {};
    const published = /^\d{4}-\d{2}-\d{2}/.test(b.published_date || "") ? String(b.published_date).slice(0, 10) : null;
    const age = published ? year - Number(published.slice(0, 4)) : 99;
    const pop = popularity(sig);
    const trend = trendingScore(sig, age);
    entries.push({
      id: b.id,
      title: b.title,
      author: authorId((b.authors || [])[0]),
      flag,
      published,
      created: b.created_at || "",
      pop,
      trend,
      loved: lovedScore(sig, pop),
      score: pop == null && !trend ? null : (pop || 0) + 0.15 * trend + (age <= 2 ? 0.06 : age <= 5 ? 0.03 : 0)
    });
  }
  const known = entries.filter((e) => e.score != null).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  const unknown = entries.filter((e) => e.score == null).sort((a, b) => (a.created < b.created ? 1 : -1));
  const ordered = [...spaceAuthors(known), ...unknown];
  return {
    entries: ordered,
    ranks: {
      generatedAt: now.toISOString(),
      order: ordered.map((e) => e.id),
      flags: ordered.map((e) => e.flag).join("")
    }
  };
}

/**
 * Home's rows, from rankCatalogue()'s entries: what's being picked up now,
 * the best of the last eighteen months, and the best loved of each genre.
 * One book per author in a row, and no book in two rows. Each list holds
 * more than a row shows, so a book that loses its cover leaves no gap.
 */
export function homeLists(entries, { now = new Date(), size = 36 } = {}) {
  const today = now.toISOString().slice(0, 10);
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - 18);
  const recent = since.toISOString().slice(0, 10);
  const isOut = (e) => e.published && e.published <= today;

  const used = new Set();
  const pick = (pool) => {
    const authors = new Set();
    const list = [];
    for (const e of pool) {
      if (list.length >= size) break;
      if (used.has(e.id) || (e.author && authors.has(e.author))) continue;
      authors.add(e.author);
      list.push(e.id);
    }
    for (const id of list) used.add(id);
    return list;
  };
  const by = (score) => (a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1);

  const trending = pick(entries.filter((e) => e.trend > 0 && isOut(e)).sort(by((e) => e.trend + 0.05 * (e.pop || 0))));
  const fresh = pick(
    entries.filter((e) => e.pop != null && isOut(e) && e.published >= recent).sort(by((e) => e.pop + 0.1 * e.trend))
  );
  // A book that is mainly the other genre stays off this one's row.
  const loved = (flags) =>
    pick(entries.filter((e) => e.loved != null && flags.includes(e.flag)).sort(by((e) => e.loved)));

  return {
    generatedAt: now.toISOString(),
    lists: { trending, new: fresh, fantasy: loved("fFb"), "science-fiction": loved("sSb") }
  };
}
