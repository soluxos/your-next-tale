import { parseCsvObjects, readFormulaSafe } from "@/lib/import/csv";
import { describeWork, sameWork, titlesCompatible } from "@/lib/books/sameBook";
import { shelfSlug } from "@/lib/bookshelves";

/**
 * Reading a Goodreads library export (My Books → Import and export → Export
 * library) — or our own export, which uses the same columns — into rows we
 * can put on shelves.
 *
 *   Exclusive Shelf  read / currently-reading / to-read  → status shelf
 *   Bookshelves      anything else                       → custom shelves
 *   My Rating, My Review, Date Read, Date Added (+ our Date Started)
 *
 * Pure functions only: matching against the catalogue and writing happen in
 * the import dialog.
 */

export const STATUS_SLUGS = [
  "read",
  "currently-reading",
  "want-to-read",
  "did-not-finish"
];

// Goodreads exclusive shelf → our status shelf. Goodreads only ships the
// first three; "did not finish" variants are common custom exclusive shelves.
const EXCLUSIVE_SHELVES = {
  read: "read",
  "currently-reading": "currently-reading",
  "to-read": "want-to-read",
  "want-to-read": "want-to-read",
  "did-not-finish": "did-not-finish",
  dnf: "did-not-finish",
  "not-finished": "did-not-finish",
  abandoned: "did-not-finish",
  "gave-up": "did-not-finish",
  "gave-up-on": "did-not-finish",
  "on-hold-dnf": "did-not-finish"
};

/** Our status slug → the Goodreads exclusive shelf name (for export). */
export const GOODREADS_SHELF_FOR = {
  read: "read",
  "currently-reading": "currently-reading",
  "want-to-read": "to-read",
  "did-not-finish": "did-not-finish"
};

export class ImportFormatError extends Error {}

const MAX_ROWS = 5000;

function shelfKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

/** Goodreads exclusive shelf name → status slug (unknown → null). */
export function statusForShelf(name) {
  return EXCLUSIVE_SHELVES[shelfKey(name)] || null;
}

/**
 * "science-fiction" → "Science fiction". Names that already look typed by a
 * person (our export: "Sci-Fi", "Book club") are kept as they are.
 */
export function shelfDisplayName(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/[A-Z ]/.test(s)) return s;
  // Hyphens become spaces, except in words that are hyphenated anyway
  // ("sci-fi", "non-fiction", "self-help").
  const parts = s.split(/[-_]+/).filter(Boolean);
  const words = parts.reduce((out, part, i) => {
    const prev = parts[i - 1];
    if (prev && (HYPHEN_PREFIX.has(prev) || part === "fi")) out[out.length - 1] += `-${part}`;
    else out.push(part);
    return out;
  }, []);
  const name = words.join(" ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const HYPHEN_PREFIX = new Set(["non", "sci", "self", "post", "pre", "anti", "semi", "co", "re"]);

/** `="9780441013593"`, `978-0-441-01359-3`, `=""` → digits (or null). */
export function cleanIsbn(value) {
  const s = String(value || "").toUpperCase().replace(/[^0-9X]/g, "");
  if (/^\d{13}$/.test(s)) return s;
  if (/^\d{9}[\dX]$/.test(s)) return s;
  return null;
}

export function isbn10to13(isbn10) {
  if (!isbn10 || isbn10.length !== 10) return null;
  const core = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 ? 3 : 1);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

const pad = (n) => String(n).padStart(2, "0");

/** "2023/05/14", "2023-05-14", "2023/05" → "2023-05-14" (or null). */
export function parseDate(value) {
  const s = String(value || "").trim();
  const m = s.match(/^(\d{4})[/-](\d{1,2})(?:[/-](\d{1,2}))?(?:$|[T\s])/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3] || 1);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1) return null; // 2023/02/30
  return `${y}-${pad(mo)}-${pad(d)}`;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

// Only the tags Goodreads actually puts in reviews — "<3" stays.
const REVIEW_TAG =
  /<\/?(?:b|i|em|strong|u|s|strike|a|span|div|p|blockquote|spoiler|ul|ol|li|h[1-6]|font|sup|sub)\b[^>]*>/gi;

/** Goodreads reviews are HTML-ish ("<br/>", "<i>") → plain text. */
export function reviewText(value) {
  let s = readFormulaSafe(value);
  if (!s.trim()) return null;
  s = s
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p\b[^>]*>/gi, "\n\n")
    .replace(REVIEW_TAG, "");
  s = decodeEntities(s)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s || null;
}

/**
 * "The Final Empire (Mistborn, #1)" → "The Final Empire" — for lookups.
 * Any trailing bracket with a series number counts: "(Series #2, Part 1 of
 * 2)", "(A, #1; B, #3)", "(Series, #0.5)".
 */
export function stripSeries(title) {
  const t = String(title || "").trim();
  const stripped = t.replace(/\s*\([^()]*#\s*\d[^()]*\)\s*$/, "").trim();
  return stripped || t;
}

function positiveInt(value) {
  const n = Math.round(parseFloat(String(value).replace(/,/g, "")));
  return n > 0 ? n : null;
}

function splitList(value) {
  return readFormulaSafe(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function cell(rec, ...names) {
  for (const n of names) {
    if (rec[n] != null && String(rec[n]).trim() !== "") {
      return readFormulaSafe(String(rec[n]).trim());
    }
  }
  return "";
}

/**
 * CSV text → { rows, skipped }.
 *
 * Each row: { line, title, searchTitle, authors, isbn13, isbn10, status,
 *   tags: [{ name, slug }], rating, review, dateRead, dateAdded, dateStarted }
 * Skipped: { line, title, reason } — no title, or the same book twice
 * (Goodreads lists each edition separately; a second edition is merged into
 * the first so its date read / rating / shelves aren't lost).
 */
export function parseLibraryCsv(text) {
  const { headers, records } = parseCsvObjects(text);
  if (!headers.includes("Title")) {
    throw new ImportFormatError(
      "This doesn’t look like a Goodreads export. We couldn’t find a Title column."
    );
  }
  if (!headers.includes("Exclusive Shelf") && !headers.includes("Bookshelves")) {
    throw new ImportFormatError(
      "This doesn’t look like a Goodreads export. We couldn’t find the shelf columns."
    );
  }
  if (records.length > MAX_ROWS) {
    throw new ImportFormatError(
      `That file has ${records.length.toLocaleString()} books. We can import up to ${MAX_ROWS.toLocaleString()} at a time.`
    );
  }

  const rows = [];
  const skipped = [];
  const seen = new Map(); // isbn / title core → earlier row

  records.forEach((rec, i) => {
    const line = i + 2; // header is line 1
    const title = cell(rec, "Title");
    if (!title) {
      skipped.push({ line, title: null, reason: "No title" });
      return;
    }

    const author = cell(rec, "Author");
    const authors = [
      ...(author ? [author] : []),
      ...splitList(rec["Additional Authors"] || "")
    ].filter((a, idx, all) => all.indexOf(a) === idx);

    const isbns = [cleanIsbn(rec.ISBN13), cleanIsbn(rec.ISBN)].filter(Boolean);
    const isbn10 = isbns.find((s) => s.length === 10) || null;
    const isbn13 = isbns.find((s) => s.length === 13) || isbn10to13(isbn10);

    const exclusiveRaw = cell(rec, "Exclusive Shelf");
    const dateRead = parseDate(cell(rec, "Date Read"));
    const status =
      statusForShelf(exclusiveRaw) ||
      (exclusiveRaw ? "want-to-read" : dateRead ? "read" : "want-to-read");

    // Custom shelves. Goodreads repeats the exclusive shelf in Bookshelves;
    // a custom *exclusive* shelf we don't know ("owned-unread") becomes a
    // tag, so nothing is lost.
    const tags = [];
    const tagNames = splitList(rec.Bookshelves || "");
    if (exclusiveRaw && !statusForShelf(exclusiveRaw)) tagNames.unshift(exclusiveRaw);
    for (const raw of tagNames) {
      if (statusForShelf(raw)) continue;
      const name = shelfDisplayName(raw).slice(0, 60);
      const slug = shelfSlug(name);
      if (!slug || STATUS_SLUGS.includes(slug)) continue;
      if (tags.some((t) => t.slug === slug)) continue;
      tags.push({ name, slug });
    }

    // Newer exports write "5.0"; round in case a half star ever turns up.
    const ratingNum = Math.round(parseFloat(cell(rec, "My Rating")));
    const rating = ratingNum >= 1 && ratingNum <= 5 ? ratingNum : null;

    const row = {
      line,
      title,
      searchTitle: stripSeries(title),
      authors,
      isbn13,
      isbn10,
      status,
      tags,
      rating,
      review: reviewText(rec["My Review"]),
      dateRead,
      dateAdded: parseDate(cell(rec, "Date Added")),
      dateStarted: parseDate(cell(rec, "Date Started")),
      pageCount: positiveInt(cell(rec, "Number of Pages")),
      currentPage: positiveInt(cell(rec, "Current Page"))
    };
    row.work = describeWork({ title: row.searchTitle, authors });

    const dup = findDuplicate(seen, row);
    if (dup) {
      mergeDuplicate(dup, row);
      remember(seen, dup); // it may have picked up an ISBN
      skipped.push({ line, title, reason: `Same book as line ${dup.line} (merged)` });
      return;
    }
    remember(seen, row);
    rows.push(row);
  });

  return { rows, skipped };
}

function findDuplicate(seen, row) {
  for (const isbn of [row.isbn13, row.isbn10]) {
    if (isbn && seen.has(`i:${isbn}`)) return seen.get(`i:${isbn}`);
  }
  for (const key of [row.work.core, row.work.alt]) {
    if (!key) continue;
    const match = (seen.get(`t:${key}`) || []).find((r) => sameWork(r.work, row.work));
    if (match) return match;
  }
  return null;
}

function remember(seen, row) {
  for (const isbn of [row.isbn13, row.isbn10]) {
    if (isbn && !seen.has(`i:${isbn}`)) seen.set(`i:${isbn}`, row);
  }
  for (const key of [row.work.core, row.work.alt]) {
    if (!key) continue;
    if (!seen.has(`t:${key}`)) seen.set(`t:${key}`, []);
    const list = seen.get(`t:${key}`);
    if (!list.includes(row)) list.push(row);
  }
}

// How far along a status is — the further one wins when merging.
const STATUS_RANK = {
  "want-to-read": 0,
  "did-not-finish": 1,
  "currently-reading": 2,
  read: 3
};

/**
 * Two rows for one book (two editions on Goodreads) → one, in place on
 * `keep`. The more advanced status wins, and brings its rating and review;
 * anything only one row has is kept; shelves are combined; date added is the
 * earlier one.
 */
export function mergeDuplicate(keep, dup) {
  const dupWins = STATUS_RANK[dup.status] > STATUS_RANK[keep.status];
  const [primary, secondary] = dupWins ? [dup, keep] : [keep, dup];
  keep.status = primary.status;
  keep.rating = primary.rating ?? secondary.rating;
  keep.review = primary.review || secondary.review;
  keep.dateRead = primary.dateRead || secondary.dateRead;
  keep.dateStarted = primary.dateStarted || secondary.dateStarted;
  keep.dateAdded = [keep.dateAdded, dup.dateAdded].filter(Boolean).sort()[0] || null;
  keep.isbn13 = keep.isbn13 || dup.isbn13;
  keep.isbn10 = keep.isbn10 || dup.isbn10;
  if (!keep.authors.length) keep.authors = dup.authors;
  for (const t of dup.tags) {
    if (!keep.tags.some((x) => x.slug === t.slug)) keep.tags.push(t);
  }
  return keep;
}

/**
 * Is this catalogue book the one a row describes? Same work, or the same
 * ISBN with compatible titles (catalogue ISBNs are occasionally wrong).
 */
export function sameBookAs(row, book) {
  if (!book) return false;
  const work = describeWork(book);
  if (sameWork(row.work, work)) return true;
  const isbnMatch =
    (row.isbn13 && book.isbn_13 === row.isbn13) ||
    (row.isbn10 && book.isbn_10 === row.isbn10);
  return !!isbnMatch && titlesCompatible(row.work.core, work.core);
}

/** What we send to /api/books/match and /api/books/normalise for a row. */
export function rowPreview(row) {
  return {
    title: row.searchTitle,
    author: row.authors[0] || null,
    authors: row.authors,
    isbn_13: row.isbn13,
    isbn_10: row.isbn10
  };
}

/** A catalogue book (with catalog_ids) as a search result, for findEntry(). */
export function catalogResult(book) {
  return {
    source: "local",
    _raw: book,
    catalog_ids: book.catalog_ids?.length ? book.catalog_ids : [book.id],
    preview: {
      title: book.title,
      author: book.authors?.[0] || null,
      authors: book.authors || [],
      isbn_13: book.isbn_13,
      isbn_10: book.isbn_10
    }
  };
}

/**
 * Sort rows into what the import will do with them.
 *
 *   matched   in our catalogue, not on your shelves yet
 *   lookup    not in our catalogue — we'll look it up online
 *   owned     already on your shelves (skipped unless you choose to update)
 *   skipped   the same catalogue book as an earlier row
 *
 * `matches` is { [rowIndex]: catalogue book } from /api/books/match;
 * `findEntry` is LibraryProvider's (search result → owned entry).
 */
export function planImport(rows, matches, findEntry) {
  const claimed = new Map(); // catalogue id → row
  // Copies: merging below must not change the parsed rows.
  return rows.map((original, i) => {
    const row = { ...original, tags: [...original.tags] };
    const book = matches[i] || null;
    if (book) {
      const ids = book.catalog_ids?.length ? book.catalog_ids : [book.id];
      const earlier = ids.map((id) => claimed.get(id)).find(Boolean);
      if (earlier) {
        mergeDuplicate(earlier, row);
        return { row, kind: "skipped", book, reason: `Same book as line ${earlier.line} (merged)` };
      }
      ids.forEach((id) => claimed.set(id, row));
      const entry = findEntry(catalogResult(book));
      return { row, kind: entry ? "owned" : "matched", book, entry };
    }
    const entry = findEntry({ source: "goodreads", preview: rowPreview(row) });
    return { row, kind: entry ? "owned" : "lookup", book: null, entry };
  });
}
