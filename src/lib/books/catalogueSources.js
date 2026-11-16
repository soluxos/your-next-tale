// Which books the catalogue import should fetch, and how popular each one is.
//
// ISBNdb has the facts, covers and blurbs but no idea what people read, so
// that comes from elsewhere:
//
//   Open Library   reading-log counts: the long tail of well-read books
//   Hardcover      most read by genre, new this year, and its trending lists
//                  (aggregate data, used with credit: see hardcover.app's terms)
//   Bookshop.org   best-seller and new-book lists, US and UK: what's selling
//   Seattle Public Library
//                  monthly checkouts (public domain): what's borrowed now.
//                  A signal only, never a reason to import a book.
//
// Each source describes a book its own way. They're merged into one "work"
// per book, carrying every source's ISBNs and numbers, and the works the
// catalogue lacks are ordered by how much interest there is in them.
//
// Nothing here touches the network itself: the readers take the fetchers
// they should use, so the import script can cache and pace them.
import {
  IMPORT_SLICES,
  YOUNG_CHILDREN,
  NOT_A_NOVEL,
  CJK_TITLE,
  isComicWork,
  openLibraryWorks,
  candidateIsbns,
  isbn10to13,
  firstYear
} from "@/lib/books/catalogueImport";
import { describeWork, sameWork, authorsOverlap, isBundle, normalise } from "@/lib/books/sameBook";
import { isEnglishIsbn } from "@/lib/books/isbnUtils";
import { extractAuthors, cleanTitle } from "@/lib/books/sources/hardcover";
import { BOOKSHOP_CHARTS, readBookshopList } from "@/lib/releases/retailers/bookshop";
import { BlockedError } from "@/lib/releases/retailers/politeFetch";
import { hcScale, olScale, splScale, listScore } from "@/lib/books/catalogueScores";

// ───────────────────────────── Hardcover ─────────────────────────────

// Genre tags: Fantasy 2, Science Fiction 6, Sci-fi 3088, Romantasy 669.
const FANTASY_TAGS = [2];
const SCIFI_TAGS = [6, 3088];
const ROMANTASY_TAGS = [669];
const HC_PAGE = 500;

const BOOK_FIELDS = `
    id title release_year release_date users_count users_read_count ratings_count rating
    book_category_id compilation cached_contributors
    genres: cached_tags(path: "Genre")
    default_physical_edition { isbn_13 edition_format }
    default_ebook_edition { isbn_13 }
    default_cover_edition { isbn_13 }
    editions(where: {isbn_13: {_is_null: false}, language_id: {_eq: 1}}, order_by: {users_count: desc}, limit: 5) {
      isbn_13 edition_format users_count
    }`;

const listQuery = (orderBy) => `query CatalogueList($tags: [Int!]!, $from: Int!, $to: Int!, $limit: Int!, $offset: Int!) {
  books(
    where: { taggings: {tag_id: {_in: $tags}}, release_year: {_gte: $from, _lte: $to}, book_status_id: {_eq: 1}, canonical_id: {_is_null: true} }
    order_by: [{${orderBy}: desc}, {id: asc}]
    limit: $limit
    offset: $offset
  ) {${BOOK_FIELDS}
  }
}`;
const TRENDING_QUERY = `query CatalogueTrending($duration: TrendingDuration!, $limit: Int!, $offset: Int!) {
  books_trending(duration: $duration, limit: $limit, offset: $offset) { ids error }
}`;
const BY_IDS_QUERY = `query CatalogueBooksByIds($ids: [Int!]!) {
  books(where: {id: {_in: $ids}}, limit: 1000) {${BOOK_FIELDS}
  }
}`;
const BY_ISBN_QUERY = `query CatalogueEditionsByIsbn($isbns: [String!]!) {
  editions(where: {isbn_13: {_in: $isbns}}, limit: 1000) { isbn_13 book_id }
}`;

/**
 * The Hardcover lists worth reading. `by` is the count the list is ordered
 * by; it stops at `take` books or once that count falls under `min`.
 * Recent books get a low bar: they haven't had time to gather readers.
 */
export function hardcoverLists(year) {
  const recent = year - 3;
  const all = [...FANTASY_TAGS, ...SCIFI_TAGS, ...ROMANTASY_TAGS];
  return [
    { label: `new in ${year}`, tags: all, from: year, to: year, by: "users_count", take: 1000, min: 25 },
    { label: `new in ${year - 1}`, tags: all, from: year - 1, to: year - 1, by: "users_count", take: 1000, min: 25 },
    { label: `fantasy ${recent}–${year}`, tags: FANTASY_TAGS, from: recent, to: year, by: "users_read_count", take: 1500, min: 20 },
    { label: `science fiction ${recent}–${year}`, tags: SCIFI_TAGS, from: recent, to: year, by: "users_read_count", take: 1000, min: 20 },
    { label: "romantasy", tags: ROMANTASY_TAGS, from: 1990, to: year, by: "users_read_count", take: 500, min: 20 },
    { label: `fantasy before ${recent}`, tags: FANTASY_TAGS, from: 1930, to: recent - 1, by: "users_read_count", take: 3000, min: 50 },
    { label: `science fiction before ${recent}`, tags: SCIFI_TAGS, from: 1930, to: recent - 1, by: "users_read_count", take: 2000, min: 50 }
  ];
}

/** One list's books, as Hardcover returns them. A failed page ends the list. */
export async function hardcoverListBooks(list, { hardcover, log = () => {} }) {
  const out = [];
  for (let offset = 0; offset < list.take; offset += HC_PAGE) {
    let page;
    try {
      const data = await hardcover(listQuery(list.by), { tags: list.tags, from: list.from, to: list.to, limit: HC_PAGE, offset });
      page = data?.books || [];
    } catch (e) {
      log(`hardcover: ${list.label} stopped at ${offset} (${e.message})`);
      break;
    }
    out.push(...page);
    log(`hardcover: ${list.label} from ${offset} → ${page.length}`);
    if (page.length < HC_PAGE || (page.at(-1)?.[list.by] || 0) < list.min) break;
  }
  return out.filter((b) => (b[list.by] || 0) >= list.min).slice(0, list.take);
}

/** Hardcover's records for these book ids. */
async function hardcoverBooksById(ids, { hardcover, log }) {
  const books = [];
  for (let i = 0; i < ids.length; i += HC_PAGE) {
    try {
      books.push(...((await hardcover(BY_IDS_QUERY, { ids: ids.slice(i, i + HC_PAGE) }))?.books || []));
    } catch (e) {
      log(`hardcover: books by id failed (${e.message})`);
    }
  }
  return books;
}

/**
 * What's trending on Hardcover this month and this quarter, as works whose
 * `signals.hcTrending` holds their place among the fantasy and science
 * fiction on each list. The lists cover every genre and come as bare ids.
 */
export async function hardcoverTrendingWorks({ hardcover, log = () => {}, today }) {
  const ranked = {};
  for (const [duration, pages] of [["month", 5], ["three_month", 3]]) {
    const ids = [];
    for (let p = 0; p < pages; p++) {
      let got = [];
      try {
        const t = (await hardcover(TRENDING_QUERY, { duration, limit: 100, offset: p * 100 }))?.books_trending;
        got = (t?.ids || []).map(Number).filter((id) => id && !ids.includes(id));
      } catch (e) {
        log(`hardcover: trending ${duration} stopped (${e.message})`);
      }
      if (!got.length) break;
      ids.push(...got);
    }
    ranked[duration] = ids;
  }
  const books = new Map();
  for (const b of await hardcoverBooksById([...new Set(Object.values(ranked).flat())], { hardcover, log })) books.set(b.id, b);

  const works = new Map();
  for (const [duration, ids] of Object.entries(ranked)) {
    const kept = ids
      .map((id) => works.get(id) || hardcoverWork(books.get(id), { today }))
      .filter(Boolean);
    kept.forEach((w, rank) => {
      w.signals.hcTrending = { ...(w.signals.hcTrending || {}), [duration]: { rank, of: kept.length } };
      works.set(w.hc.id, w);
    });
    log(`hardcover: trending ${duration} → ${ids.length} books, ${kept.length} fantasy or science fiction`);
  }
  return [...works.values()];
}

/**
 * Hardcover's works for books a bookshop lists, found by ISBN, so a list
 * pick gets its real first year and reader counts rather than its newest
 * edition's. Each work carries the list's ISBN.
 */
export async function hardcoverWorksByIsbn(isbns, { hardcover, log = () => {}, today }) {
  const list = [...new Set(isbns)];
  if (!list.length) return [];
  const bookOf = new Map();
  for (let i = 0; i < list.length; i += HC_PAGE) {
    try {
      const data = await hardcover(BY_ISBN_QUERY, { isbns: list.slice(i, i + HC_PAGE) });
      for (const e of data?.editions || []) if (e.book_id && !bookOf.has(e.isbn_13)) bookOf.set(e.isbn_13, e.book_id);
    } catch (e) {
      log(`hardcover: editions by ISBN failed (${e.message})`);
    }
  }
  const works = new Map();
  for (const b of await hardcoverBooksById([...new Set(bookOf.values())], { hardcover, log })) {
    const w = hardcoverWork(b, { today });
    if (w) works.set(b.id, w);
  }
  for (const [isbn, id] of bookOf) {
    const w = works.get(id);
    if (w && !w.isbn.includes(isbn)) w.isbn.push(isbn);
  }
  log(`hardcover: ${list.length} bookshop ISBNs → ${works.size} works`);
  return [...works.values()];
}

// Tags that say what kind of thing a book is, not what it's about.
const BROAD_TAG = /^(?:fiction|adult|young adult|ya|new adult|teen|juvenile|audiobooks?|e-?books?|novels?|literature|classics?|general)$/i;
const SFF_TAG = /fantasy|science fiction|sci-?fi|romantasy|space opera|dystopia|cyberpunk|litrpg/i;
const COMIC_TAG = /\bcomics\b|comic books?|graphic novels?|\bmanga\b|picture books?/i;
const PRINT = /hardcover|hardback|paperback|softcover|mass market|trade/i;
const EBOOK = /kindle|e-?book|digital|epub/i;
const AUDIO = /audi|\bcd\b|mp3/i;

/**
 * A Hardcover book as a work, or null when it isn't a published fantasy or
 * science fiction novel. Genre comes from how readers tagged it (one of its
 * three strongest genre tags), not from the list it was on: a tag filter
 * alone lets in every thriller someone once called fantasy.
 */
export function hardcoverWork(b, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!b || b.book_category_id !== 1 || b.compilation) return null;
  const title = cleanTitle(b.title || "");
  if (!title || NOT_A_NOVEL.test(title) || CJK_TITLE.test(title) || isBundle(title)) return null;
  const author_name = extractAuthors(b.cached_contributors).slice(0, 4);
  if (!author_name.length) return null;

  const tags = (Array.isArray(b.genres) ? b.genres : [])
    .filter((t) => t?.tag && !BROAD_TAG.test(t.tag))
    .sort((x, y) => (y.count || 0) - (x.count || 0));
  if (!tags.length) return null;
  const bar = tags[Math.min(2, tags.length - 1)].count || 0;
  const top = tags.filter((t) => (t.count || 0) >= bar);
  if (!top.some((t) => SFF_TAG.test(t.tag)) || top.some((t) => COMIC_TAG.test(t.tag))) return null;

  // Out already. A date of 1 January is what Hardcover says when it only
  // knows the year, so in the current year it takes readers to prove it.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.release_date || "") ? b.release_date : null;
  const exact = !!date && !date.endsWith("-01-01");
  const year = Number(b.release_year) || (date ? Number(date.slice(0, 4)) : 0);
  const thisYear = Number(today.slice(0, 4));
  if (exact ? date > today : year > thisYear) return null;
  if (!exact && year === thisYear && (b.users_read_count || 0) < 20) return null;

  // The editions its readers shelve, print first: that's the cover they know.
  const found = new Map();
  const consider = (isbn, format, users, tier) => {
    if (!isbn || !isEnglishIsbn(isbn) || AUDIO.test(format || "")) return;
    const t = tier ?? (PRINT.test(format || "") ? 0 : EBOOK.test(format || "") ? 2 : 1);
    const had = found.get(isbn);
    found.set(isbn, { isbn, tier: Math.min(t, had?.tier ?? t), users: Math.max(users || 0, had?.users || 0) });
  };
  for (const e of b.editions || []) consider(e.isbn_13, e.edition_format, e.users_count);
  consider(b.default_physical_edition?.isbn_13, b.default_physical_edition?.edition_format, 0, 0);
  consider(b.default_cover_edition?.isbn_13, "", 0);
  consider(b.default_ebook_edition?.isbn_13, "ebook", 0, 2);
  const editions = [...found.values()].sort((x, y) => x.tier - y.tier || y.users - x.users);

  // Its tags as publisher-style categories, for the genre check on ISBNdb's
  // subjects: only tags a real share of its readers gave it.
  const strongest = top[0].count || 0;
  const subject_key = new Set();
  for (const t of top) {
    if ((t.count || 0) < Math.max(2, strongest / 3)) continue;
    const name = t.tag.toLowerCase();
    if (/romantasy/.test(name)) subject_key.add("fiction_fantasy_romance");
    else if (/space opera/.test(name)) subject_key.add("fiction_science_fiction_space_opera");
    else if (/dystopia/.test(name)) subject_key.add("fiction_dystopian");
    else if (/cyberpunk/.test(name)) subject_key.add("fiction_science_fiction_cyberpunk");
    else if (/science fiction|sci-?fi/.test(name)) subject_key.add("fiction_science_fiction_general");
    else if (/fantasy/.test(name)) subject_key.add("fiction_fantasy_general");
  }

  return {
    key: `hc:${b.id}`,
    keys: [`hc:${b.id}`],
    title,
    author_name,
    isbn: editions.map((e) => e.isbn),
    prefer: editions.slice(0, 4).map(({ isbn, tier }) => ({ isbn, tier })),
    subject_key: [...subject_key],
    hc: {
      id: b.id,
      users: b.users_count || 0,
      read: b.users_read_count || 0,
      rating: b.rating ? Math.round(b.rating * 100) / 100 : null,
      ratings: b.ratings_count || 0,
      releaseDate: exact ? date : null,
      year: year || null
    },
    signals: {}
  };
}

// ──────────────────────────── Open Library ────────────────────────────

/** An Open Library search doc as a work. */
export function openLibraryWork(doc) {
  return {
    ...doc,
    keys: [doc.key],
    ol: {
      readers: doc.readinglog_count || 0,
      want: doc.want_to_read_count || 0,
      rating: doc.ratings_average ? Math.round(doc.ratings_average * 100) / 100 : null,
      ratings: doc.ratings_count || 0
    },
    signals: {}
  };
}

// ───────────────────────────── Bookshops ─────────────────────────────

/**
 * Bookshop.org's best-seller and new-book lists as works, one per pick. A
 * shop that answers with a bot check is left alone for the rest of the run.
 */
export async function bookshopChartWorks({ fetchPage, log = () => {} }) {
  const works = [];
  const blocked = new Set();
  for (const chart of BOOKSHOP_CHARTS) {
    const shop = chart.base || "bookshop.org";
    if (blocked.has(shop)) continue;
    let picks = [];
    try {
      picks = await readBookshopList(chart, { log, fetchPage });
    } catch (e) {
      if (e instanceof BlockedError) blocked.add(shop);
      log(`bookshop: ${chart.label} not read (${e.message})`);
      continue;
    }
    log(`bookshop: ${chart.label} → ${picks.length} books`);
    for (const p of picks) {
      if (!isEnglishIsbn(p.isbn) || AUDIO.test(p.format || "")) continue;
      if (!p.title || NOT_A_NOVEL.test(p.title) || CJK_TITLE.test(p.title) || isBundle(p.title)) continue;
      works.push({
        key: `isbn:${p.isbn}`,
        keys: [`isbn:${p.isbn}`],
        title: p.title,
        author_name: p.authors || [],
        isbn: [p.isbn],
        prefer: [{ isbn: p.isbn, tier: PRINT.test(p.format || "") ? 0 : EBOOK.test(p.format || "") ? 2 : 1 }],
        subject_key: chart.genre === "fantasy" ? ["fiction_fantasy_general"] : [],
        signals: { lists: [{ list: p.list, rank: p.rank, size: p.size, weight: chart.weight, kind: chart.kind }] }
      });
    }
  }
  return works;
}

// ─────────────────────── Seattle Public Library ───────────────────────

const SEATTLE = "https://data.seattle.gov/resource/tmmm-ytt6.json";
// The data runs two or three months behind, so the last five calendar
// months hold two or three months of checkouts.
const SEATTLE_MONTHS = 5;

function seattleTitle(t) {
  return String(t || "")
    .replace(/\s+\/\s+.*$/, "")
    .replace(/\s*\[(?:electronic resource|sound recording|text \(large print\)|large print)\]/gi, "")
    .replace(/\s*\((?:un)?abridged\)/gi, "")
    .replace(/\s*[:;,.]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// "Yarros, Rebecca, 1981-" → "Rebecca Yarros"
function seattleCreator(c) {
  let s = String(c || "")
    .replace(/,?\s*\d{4}-(\d{4})?\.?$/, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
  if (/,/.test(s)) {
    const [last, first] = s.split(/,\s*/);
    s = `${first || ""} ${last}`.trim();
  }
  return s.replace(/\.$/, "").replace(/\s+/g, " ");
}

/**
 * Fantasy and science fiction checked out of Seattle's libraries lately:
 * [{ title, creator, isbn, checkouts }], print, ebook and audiobook loans
 * of a title added together. `fetchJson(url)` returns the parsed rows.
 */
export async function seattleCheckouts({ fetchJson, log = () => {}, now = new Date() }) {
  const byYear = new Map();
  for (let i = 1; i <= SEATTLE_MONTHS; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    if (!byYear.has(d.getUTCFullYear())) byYear.set(d.getUTCFullYear(), []);
    byYear.get(d.getUTCFullYear()).push(d.getUTCMonth() + 1);
  }
  const when = [...byYear].map(([y, months]) => `(checkoutyear=${y} AND checkoutmonth in (${months.join(",")}))`).join(" OR ");
  const params = {
    $select:
      "title,creator,materialtype,max(isbn) as isbns,sum(checkouts) as total",
    $where: `(${when}) AND materialtype in ('BOOK','EBOOK','AUDIOBOOK') AND (lower(subjects) like '%fantasy%' OR lower(subjects) like '%science fiction%')`,
    $group: "title,creator,materialtype",
    $having: "total>=10",
    $order: "total DESC",
    $limit: "50000"
  };
  const url = `${SEATTLE}?${Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
  const rows = await fetchJson(url);
  if (!Array.isArray(rows)) {
    log("seattle: no answer");
    return [];
  }
  const merged = new Map();
  for (const r of rows) {
    const title = seattleTitle(r.title);
    const creator = seattleCreator(r.creator);
    if (!title || !creator) continue;
    const k = `${title.toLowerCase()}|${creator.toLowerCase()}`;
    const row = merged.get(k) || { title, creator, isbn: [], checkouts: 0 };
    row.checkouts += Number(r.total) || 0;
    for (const i of String(r.isbns || "").match(/\b97[89]\d{10}\b/g) || []) if (!row.isbn.includes(i)) row.isbn.push(i);
    merged.set(k, row);
  }
  log(`seattle: ${rows.length} rows → ${merged.size} titles`);
  return [...merged.values()];
}

// ─────────────────────────────── Merging ───────────────────────────────

const to13 = (i) => (String(i).length === 13 ? String(i) : isbn10to13(i));
const isbn13s = (work) => [...new Set((work.isbn || []).map(to13).filter(Boolean))];
// Which source's own identifier a key is. A source tells its own works
// apart, so two of them are never merged on a shared ISBN alone.
const keyKind = (k) => (k.startsWith("hc:") ? "hc" : k.startsWith("/works/") ? "ol" : null);

// sameWork() reads what comes before a colon or dash as the title, which is
// right for "Babel: An Arcane History" and wrong for "Star Wars: Aftermath"
// and "Star Wars - Darth Bane - Rule of Two": one author's books in a series
// would all be one work. So when two titles both go on after the first part,
// they have to use the same words. A missed merge costs a spare lookup (the
// catalogue check still stops a second copy); a wrong one loses a book.
const EDITION_NOTE =
  /\b(?:edition|novel|novella|book|books|volume|vol|part|series|saga|trilogy|collection|anniversary|illustrated|unabridged|abridged|text)\b/;
const SMALL_WORDS = new Set(["the", "a", "an", "of", "and", "or", "in", "on", "to", "for"]);
function seriesWords(title) {
  const t = String(title || "")
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[([].*$/, " ");
  const parts = t.split(/\s*[:;]\s*|\s+[-–—]\s+/).map(normalise).filter(Boolean);
  if (parts.length < 2 || EDITION_NOTE.test(parts.slice(1).join(" "))) return null;
  return new Set(
    parts
      .join(" ")
      .split(" ")
      .filter((w) => !SMALL_WORDS.has(w))
  );
}
const sameWords = (a, b) => !a || !b || (a.size === b.size && [...a].every((w) => b.has(w)));

/** Signals from two sources about one book, combined. */
export function mergeSignals(a = {}, b = {}) {
  const out = { ...a };
  if (b.lists?.length) {
    const best = new Map((a.lists || []).map((l) => [l.list, l]));
    for (const l of b.lists) if (!best.has(l.list) || l.rank < best.get(l.list).rank) best.set(l.list, l);
    out.lists = [...best.values()];
  }
  if (b.hcTrending) {
    out.hcTrending = { ...(a.hcTrending || {}) };
    for (const [duration, t] of Object.entries(b.hcTrending)) {
      if (!out.hcTrending[duration] || t.rank < out.hcTrending[duration].rank) out.hcTrending[duration] = t;
    }
  }
  if (b.spl) out.spl = { checkouts: (a.spl?.checkouts || 0) + (b.spl.checkouts || 0) };
  return out;
}

/** What a work's sources say about it, in the shape the scores read. */
export function workSignals(work) {
  const s = { ...(work.signals || {}) };
  if (work.ol) s.ol = work.ol;
  if (work.hc) s.hc = { id: work.hc.id, users: work.hc.users, read: work.hc.read, rating: work.hc.rating, ratings: work.hc.ratings };
  return s;
}

/** Two sets of signals for the same book: the fuller record of each kind. */
export function combineSignals(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = mergeSignals(a, b);
  if (b.ol && (!a.ol || (b.ol.readers || 0) > (a.ol.readers || 0))) out.ol = b.ol;
  if (b.hc && (!a.hc || (b.hc.users || 0) > (a.hc.users || 0))) out.hc = b.hc;
  return out;
}

/**
 * The works, one per book. `add(work)` merges it into the work it matches or
 * files it as new; `find(probe)` looks without adding. A match is, in order:
 *   1. a shared source key;
 *   2. the same title and author (both sides must name an author);
 *   3. shared ISBNs with an author in common, for books that go by two
 *      titles (Northern Lights / The Golden Compass). Crowd-sourced records
 *      file the odd ISBN under the wrong book, so a work with three or more
 *      ISBNs has to share two.
 * The first source to describe a book keeps its title, authors and years.
 */
export function workIndex() {
  const works = [];
  const byKey = new Map();
  const byIsbn = new Map();
  const byTitle = new Map();
  const shapes = new Map();

  const describe = (work) =>
    [work.title, ...(work.altTitles || [])].map((title) => ({
      ...describeWork({ title, authors: work.author_name || [] }),
      words: seriesWords(title)
    }));

  const file = (work) => {
    for (const k of work.keys || []) byKey.set(k, work);
    for (const i of isbn13s(work)) if (!byIsbn.has(i)) byIsbn.set(i, work);
    const d = describe(work);
    shapes.set(work, d);
    for (const s of d) {
      for (const k of [s.core, s.alt].filter(Boolean)) {
        if (!byTitle.has(k)) byTitle.set(k, []);
        if (!byTitle.get(k).includes(work)) byTitle.get(k).push(work);
      }
    }
  };

  const find = (probe) => {
    for (const k of probe.keys || []) if (byKey.has(k)) return byKey.get(k);
    const d = describe(probe);
    if (!d[0].authors.size) return null;
    for (const s of d) {
      for (const k of [s.core, s.alt].filter(Boolean)) {
        const hit = (byTitle.get(k) || []).find((x) =>
          shapes.get(x).some((o) => o.authors.size && sameWork(s, o) && sameWords(s.words, o.words))
        );
        if (hit) return hit;
      }
    }
    if (isBundle(probe.title)) return null;
    const mine = isbn13s(probe);
    const kinds = new Set((probe.keys || []).map(keyKind).filter(Boolean));
    const shared = new Map();
    for (const i of mine) {
      const x = byIsbn.get(i);
      if (x) shared.set(x, (shared.get(x) || 0) + 1);
    }
    const need = mine.length >= 3 ? 2 : 1;
    for (const [x, n] of [...shared].sort((p, q) => q[1] - p[1])) {
      if (n < need) break;
      if ((x.keys || []).some((k) => kinds.has(keyKind(k))) || isBundle(x.title)) continue;
      const o = shapes.get(x)[0];
      if (o.authors.size && authorsOverlap(o.authors, d[0].authors)) return x;
    }
    return null;
  };

  const absorb = (a, b) => {
    const known = new Set(shapes.get(a).flatMap((s) => [s.core, s.alt]).filter(Boolean));
    for (const title of [b.title, ...(b.altTitles || [])]) {
      const core = describeWork({ title, authors: [] }).core;
      if (core && !known.has(core)) {
        a.altTitles = [...(a.altTitles || []), title];
        known.add(core);
      }
    }
    a.keys = [...new Set([...(a.keys || []), ...(b.keys || [])])];
    a.isbn = [...new Set([...(a.isbn || []), ...(b.isbn || [])])];
    a.subject_key = [...new Set([...(a.subject_key || []), ...(b.subject_key || [])])];
    // The editions to try first, across sources: print before ebook.
    const prefer = new Map();
    for (const p of [...(a.prefer || []), ...(b.prefer || [])]) {
      if (!prefer.has(p.isbn) || p.tier < prefer.get(p.isbn).tier) prefer.set(p.isbn, p);
    }
    a.prefer = [...prefer.values()].sort((x, y) => x.tier - y.tier);
    if (!a.author_name?.length && b.author_name?.length) a.author_name = b.author_name;
    if (b.hc && (!a.hc || (b.hc.users || 0) > (a.hc.users || 0))) a.hc = b.hc;
    if (b.ol && (!a.ol || (b.ol.readers || 0) > (a.ol.readers || 0))) a.ol = b.ol;
    a.signals = mergeSignals(a.signals, b.signals);
    file(a);
    return a;
  };

  const add = (work) => {
    const hit = find(work);
    if (hit) return hit === work ? hit : absorb(hit, work);
    works.push(work);
    file(work);
    return work;
  };

  return { works, add, find };
}

/**
 * Read every source and merge them. The fetchers:
 *   fetchJson(url)              Open Library search → parsed JSON
 *   hardcover(query, variables) Hardcover GraphQL → data (throws on failure)
 *   fetchPage(url)              a bookshop list page → HTML (through politeFetch)
 *   fetchSeattle(url)           Seattle's open data → parsed JSON
 * A source that fails is logged and left out; the rest still count.
 *
 * Returns { works, find, checkouts, counts }: `checkouts` are the Seattle
 * titles that matched no work, for the caller to try against the catalogue.
 */
export async function gatherWorks({ fetchJson, hardcover, fetchPage, fetchSeattle, log = () => {}, now = new Date() }) {
  const today = now.toISOString().slice(0, 10);
  const safely = (what, fallback, run) =>
    run().catch((e) => {
      log(`${what} failed (${e.message})`);
      return fallback;
    });

  // Different sites at once; each site one request at a time.
  const [docs, hc, charts, loans] = await Promise.all([
    safely("open library", [], async () => {
      const out = [];
      for (const slice of IMPORT_SLICES) out.push(...(await openLibraryWorks(slice, { log, fetchJson })));
      return out;
    }),
    safely("hardcover", { lists: [], trending: [] }, async () => {
      const lists = [];
      for (const list of hardcoverLists(now.getUTCFullYear())) lists.push(await hardcoverListBooks(list, { hardcover, log }));
      return { lists, trending: await hardcoverTrendingWorks({ hardcover, log, today }) };
    }),
    safely("bookshop lists", [], () => bookshopChartWorks({ fetchPage, log })),
    safely("seattle", [], () => seattleCheckouts({ fetchJson: fetchSeattle, log, now }))
  ]);
  const listed = await safely("hardcover by ISBN", [], () =>
    hardcoverWorksByIsbn(charts.map((w) => w.isbn[0]), { hardcover, log, today })
  );

  const index = workIndex();
  for (const doc of docs) index.add(openLibraryWork(doc));
  const afterOl = index.works.length;
  let fromHardcover = 0;
  for (const books of hc.lists) {
    for (const b of books) {
      const w = hardcoverWork(b, { today });
      if (!w) continue;
      fromHardcover++;
      index.add(w);
    }
  }
  for (const w of [...hc.trending, ...listed]) index.add(w);
  const afterHc = index.works.length;
  for (const w of charts) index.add(w);

  const checkouts = [];
  let borrowed = 0;
  for (const row of loans) {
    const hit = index.find({ title: row.title, author_name: [row.creator], isbn: row.isbn, keys: [] });
    if (hit) {
      hit.signals = mergeSignals(hit.signals, { spl: { checkouts: row.checkouts } });
      borrowed++;
    } else checkouts.push(row);
  }

  const counts = {
    openLibrary: afterOl,
    hardcoverBooks: fromHardcover,
    hardcoverNew: afterHc - afterOl,
    bookshopPicks: charts.length,
    bookshopNew: index.works.length - afterHc,
    seattleMatched: borrowed,
    works: index.works.length
  };
  log(
    `sources: ${counts.openLibrary} works from Open Library; Hardcover adds ${counts.hardcoverNew} (of ${counts.hardcoverBooks}); ` +
      `bookshop lists add ${counts.bookshopNew} (of ${counts.bookshopPicks}); ${counts.seattleMatched} have library checkouts → ${counts.works} works`
  );
  return { works: index.works, find: index.find, checkouts, counts };
}

// ───────────────────────────── Candidates ─────────────────────────────

/** Why a work the catalogue lacks isn't worth looking up, or null. */
export function screenCandidate(work, { year = new Date().getUTCFullYear() } = {}) {
  const title = work.title || "";
  if (NOT_A_NOVEL.test(title) || CJK_TITLE.test(title) || isBundle(title)) return "not a single novel";
  if ((work.subject_key || []).some((k) => YOUNG_CHILDREN.test(k))) return "for young children";
  if (isComicWork(work)) return "a comic";
  // Only Open Library knows it: its first year is all there is to go on.
  if (!work.hc && !work.signals?.lists?.length) {
    const first = Number(work.first_publish_year) || 0;
    if (!first || first > year) return "not out yet";
  }
  if (!candidateIsbns(work).length) return "no English ISBN";
  return null;
}

/**
 * How much there is to gain from having a work: how widely it's read, plus
 * what's selling, trending or new. Decides the order works are looked up
 * in, so the books readers are after come first when the allowance is short.
 */
export function interest(work, { year = new Date().getUTCFullYear() } = {}) {
  const H = work.hc ? hcScale(work.hc.users) : 0;
  const O = work.ol ? olScale(work.ol.readers) : 0;
  const s = work.signals || {};
  const place = (t) => (t && t.of > 0 ? 1 - t.rank / t.of : 0);
  const now = Math.max(0.5 * place(s.hcTrending?.month), 0.3 * place(s.hcTrending?.three_month), 0.3 * splScale(s.spl?.checkouts));
  const first = firstYear(work) >= 1800 ? firstYear(work) : work.hc?.year || 0;
  const recency = first >= year - 2 ? 0.25 : first >= year - 5 ? 0.1 : 0;
  return Math.max(H, O) + 0.3 * Math.min(H, O) + 0.5 * listScore(s.lists) + now + recency;
}
