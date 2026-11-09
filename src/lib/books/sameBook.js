/**
 * "Are these the same book?" — one answer shared by the search API, the
 * Add books drawer and the reader's library, so every surface agrees.
 *
 * Catalogue rows and online sources describe one work in many ways:
 *   "Dune" · "Dune (Deluxe Edition)" · "Dune (Edición de Lujo) / Dune (…)"
 *   "The Hobbit" · "The Hobbit, Or, There and Back Again"
 *   "Project Hail Mary" · "Project Hail Mary: A Novel" · "…Mary A Novel"
 * and authors as "J. R. R. Tolkien" · "John Ronald Reuel Tolkien" ·
 * "Tolkien, J.R.R." — or, from bad metadata, the publisher
 * ("Turtleback Books Publishing").
 *
 * A work is reduced to { core, authors }: the title with edition noise
 * removed, and the set of author surnames. Two works are the same book when
 * their cores are equal and their authors overlap (or one side has none).
 *
 * Deliberately conservative: "Dune" and "Dune Messiah" stay apart.
 */

export function normalise(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Trailing words that describe an edition rather than the work.
const EDITION_TAIL =
  /\s+(?:a novel|a memoir|novel|(?:[a-z]+ )?edition|unabridged|abridged|illustrated|annotated|paperback|hardcover|hardback|mass market|large print|reissue|(?:movie|media|tv )?tie in|\d+(?:st|nd|rd|th)(?: anniversary)?|anniversary)$/;

// Series info appended without a colon (common in catalogue imports):
// "The Way of Kings Book One of the Stormlight Archive", "The Alloy of Law A
// Mistborn Novel".
const SERIES_TAIL =
  / (?:book|volume|vol|part) (?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) of (?:the )?[a-z0-9 ]+$/;
const SERIES_NOVEL_TAIL = / an? (?:[a-z0-9]+ ){1,3}(?:novel|novella)$/;

// " / " separates either translations of one title ("Dune (Edición…) /
// Dune (Deluxe…)") or several books sold together ("The Martian / Artemis /
// Project Hail Mary"). "Either/Or" has no spaces and is left alone.
const SLASH = /\s+\/\s*|\s*\/\s+/;

/** True for "The Martian / Artemis / Project Hail Mary" — several books. */
export function isBundle(title) {
  const parts = String(title || "").split(SLASH);
  if (parts.length < 2) return false;
  const cores = parts.map((p) => singleTitleCore(p));
  return cores.some((c) => c !== cores[0]);
}

/** "The Hobbit, Or, There and Back Again (Deluxe Edition)" → "hobbit" */
export function titleCore(title) {
  const t = String(title || "");
  const parts = t.split(SLASH);
  if (parts.length < 2) return singleTitleCore(t);
  const cores = parts.map((p) => singleTitleCore(p));
  // Same title in two languages → that title; a bundle → the whole thing,
  // so it never matches any one of the books in it.
  return cores.every((c) => c === cores[0]) ? cores[0] : normalise(t);
}

function singleTitleCore(title) {
  let t = String(title || "");
  // "(Book 1)", "[Paperback]", and a dangling "(Deluxe…"
  t = t.replace(/\(.*?\)|\[.*?\]/g, " ").replace(/[([].*$/, " ");
  // Subtitles: "Title: Sub", "Title; or, Sub", "Title — Sub", "Title - Sub"
  t = t.split(/\s*[:;]\s*|\s+[-–—]\s+/)[0];
  // Alternate titles: "The Hobbit, Or, There and Back Again"
  t = t.replace(/,\s*or\b.*$/i, "");

  let core = normalise(t).replace(/^(?:the|a|an) /, "");
  for (let prev = null; prev !== core; ) {
    prev = core;
    core = core
      .replace(SERIES_TAIL, "")
      .replace(SERIES_NOVEL_TAIL, "")
      .replace(EDITION_TAIL, "");
  }
  return core || normalise(title);
}

// Words that mark a subtitle as edition / series info rather than a title.
const NOT_A_TITLE =
  /\b(?:edition|novel|novella|book|books|volume|vol|part|series|saga|trilogy|collection|anniversary|illustrated|unabridged|abridged|stories|tales)\b/;

/**
 * "Mistborn: The Final Empire" is often listed as just "The Final Empire".
 * The part after the colon is a second possible title — but only when it
 * looks like one (2+ words, no edition/series words), so "Chapterhouse: Dune"
 * never matches "Dune" and "…: Deluxe Edition" never matches anything.
 */
export function subtitleCore(title) {
  if (isBundle(title)) return null;
  const t = String(title || "")
    .split(SLASH)[0]
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[([].*$/, " ");
  const i = t.indexOf(":");
  if (i === -1) return null;
  const sub = normalise(t.slice(i + 1)).replace(/^(?:the|a|an) /, "");
  if (!sub || NOT_A_TITLE.test(sub) || sub.split(" ").length < 2) return null;
  return sub;
}

// Names that are really a publisher / imprint / placeholder, not a person.
const ORG_RE =
  /\b(?:books?|publish\w*|press|inc|llc|ltd|limited|editions?|classics|media|group|company|corp\w*|studios?|staff|editors?|various|anonymous|unknown|collective)\b/;

export function isOrgName(name) {
  return ORG_RE.test(normalise(name));
}

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "md"]);

/** "Tolkien, J.R.R." / "J. R. R. Tolkien" → "tolkien"; publishers → null */
export function authorKey(name) {
  let n = String(name || "").trim();
  if (!n) return null;
  // "Surname, Given" → "Given Surname"
  const comma = n.match(/^([^,]+),\s*([^,]+)$/);
  if (comma) n = `${comma[2]} ${comma[1]}`;
  const norm = normalise(n);
  if (!norm || ORG_RE.test(norm)) return null;
  const parts = norm.split(" ").filter((p) => !NAME_SUFFIXES.has(p));
  return parts.pop() || null;
}

/** Normalised full names (≥ 2 words) — used to spot titles *about* a book. */
export function fullAuthorNames(authors) {
  return (authors || [])
    .filter((a) => a && !isOrgName(a))
    .map((a) => {
      const comma = String(a).match(/^([^,]+),\s*([^,]+)$/);
      return normalise(comma ? `${comma[2]} ${comma[1]}` : a);
    })
    .filter((n) => n.split(" ").length >= 2);
}

/** { title, authors?, author? } → { core, authors: Set<surname> } */
export function describeWork(book) {
  const list = book?.authors?.length
    ? book.authors
    : book?.author
      ? [book.author]
      : [];
  const core = titleCore(book?.title);
  const authors = new Set();
  for (const a of list.slice(0, 4)) {
    // Bad metadata sometimes repeats the title as the author ("Neuromancer"
    // by "Neuromancer") — treat that as unknown rather than a different book.
    if (normalise(a) === normalise(book?.title) || normalise(a) === core) continue;
    const k = authorKey(a);
    if (k) authors.add(k);
  }
  return { core, alt: subtitleCore(book?.title), authors };
}

export function authorsOverlap(a, b) {
  if (!a.size || !b.size) return true;
  for (const x of a) if (b.has(x)) return true;
  return false;
}

// Split editions: "The Name of the Wind, Book 2" is half of the same novel.
const VOLUME_TAIL =
  /^(.+?) (?:book|part|volume|vol|tome) (?:\d{1,2}|one|two|three|i{1,3}|iv)$/;

// Series info glued on with no colon: "This Inevitable Ruin Dungeon Crawler
// Carl Book 7" is "This Inevitable Ruin". The words before "Book 7" have to
// read as a series name, so they can't repeat the title's own words: "Dune
// Messiah Dune Chronicles Book 2" is not "Dune".
const SERIES_SUFFIX =
  /^((?:[a-z0-9]+ ){1,5})(?:book|volume|vol|part|no|number) (?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$/;
const MINOR_WORDS = new Set(["the", "of", "a", "an", "and", "in", "on", "to", "for"]);

function hasSeriesSuffix(longer, shorter) {
  if (!longer.startsWith(shorter + " ")) return false;
  const m = longer.slice(shorter.length + 1).match(SERIES_SUFFIX);
  if (!m) return false;
  const titleWords = new Set(shorter.split(" "));
  return m[1]
    .trim()
    .split(" ")
    .every((w) => MINOR_WORDS.has(w) || !titleWords.has(w));
}

function sameCore(a, b) {
  if (a === b) return true;
  const ma = a.match(VOLUME_TAIL);
  const mb = b.match(VOLUME_TAIL);
  if ((!!ma && ma[1] === b) || (!!mb && mb[1] === a)) return true;
  return hasSeriesSuffix(a, b) || hasSeriesSuffix(b, a);
}

/** Both arguments are describeWork() results. */
export function sameWork(a, b) {
  if (!a.core || !b.core || !authorsOverlap(a.authors, b.authors)) return false;
  if (sameCore(a.core, b.core)) {
    // "Mistborn: The Final Empire" vs "Mistborn: Secret History" — a series
    // prefix with two different titles after it is two different books.
    return !(a.alt && b.alt && a.alt !== b.alt);
  }
  return (!!a.alt && a.alt === b.core) || (!!b.alt && b.alt === a.core);
}

/**
 * Shared-ISBN sanity check — catalogue ISBNs are sometimes wrong (a box set's
 * ISBN on "The Fellowship of the Ring"). Only trust an ISBN match when one
 * title's words are contained in the other's.
 */
export function titlesCompatible(coreA, coreB) {
  if (!coreA || !coreB) return true;
  if (coreA === coreB) return true;
  const a = new Set(coreA.split(" "));
  const b = new Set(coreB.split(" "));
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const w of small) if (!big.has(w)) return false;
  return true;
}
