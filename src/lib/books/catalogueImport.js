// Bulk catalogue import: the fantasy and science fiction people actually read,
// for a few ISBNdb calls rather than one per book.
//
// Which books: ISBNdb has no popularity data, so other sources say what
// people read (see catalogueSources.js): Open Library's reading-log counts,
// Hardcover's most-read and trending lists, and bookshops' best-seller
// lists. This file holds Open Library's side and everything after the
// candidates are chosen.
//
// What we store: facts, blurb and cover from ISBNdb (licensed for display),
// fetched 100 ISBNs per request. ISBNdb's daily allowance counts each ISBN,
// so each work starts with as few as will do: the one edition Hardcover or a
// bookshop says readers buy, or Open Library's featured edition and one
// other. Only works those don't settle get more, up to six. Covers pass the
// same checks as everywhere else (no 3D mock-ups, no "cover to be
// revealed"), and a book without a usable cover and blurb is left out rather
// than stored incomplete.
//
// Server only: uses ISBNDB_API_KEY and the service-role client.
import crypto from "node:crypto";
import { isbndbBooks, isbndbQuota, IsbndbLimitError } from "@/lib/releases/isbndbBulk";
import { cleanTitle } from "@/lib/releases/syncReleases";
import { verifyCover, MIN_DESCRIPTION } from "@/lib/releases/quality";
import { describeWork, sameWork, authorsOverlap, authorKey, isBundle, normalise as plain } from "@/lib/books/sameBook";
import { assessCover, fetchCover, COVER_GOOD, COVER_WEAK } from "@/lib/books/coverQuality";
import { isEnglishIsbn } from "@/lib/books/isbnUtils";
import { tidyTitle, tidyAuthors } from "@/lib/books/tidyText";
import { needsTitleCase, publisherCasing } from "@/lib/books/titleCase";
import { getBookshopLink } from "@/lib/bookshop";

export { IsbndbLimitError };

/**
 * Open Library's side of the candidates, most read first. Modern fantasy is
 * the bulk of what readers here shelve; science fiction reaches further back
 * (Foundation, Dune); older fantasy is capped so children's classics don't
 * crowd it.
 *
 * `subject:` rather than `subject_key:`: the key misses books whose tags are
 * spelt differently (Project Hail Mary, Red Rising, Babel). It lets in more
 * noise too, which the publisher's own categories filter out later.
 */
export const IMPORT_SLICES = [
  { label: "fantasy since 1990", q: "subject:fantasy AND first_publish_year:[1990 TO 2100]", take: 3400 },
  { label: "science fiction since 1950", q: 'subject:"science fiction" AND first_publish_year:[1950 TO 2100]', take: 2800 },
  { label: "fantasy 1930–1989", q: "subject:fantasy AND first_publish_year:[1930 TO 1989]", take: 400 }
];

// Fewer people than this have logged it on Open Library: too obscure for Discover.
export const MIN_READERS = 20;
// ISBNs tried per work. More finds a good edition more often; fewer is cheaper.
const ISBNS_PER_WORK = 6;
// How many ISBNs each look asks for; a work goes round again only when the
// look before didn't settle it. A work whose first ISBN is the print edition
// readers actually buy usually needs just that one.
const STEPS = [2, 4];
const SURE_STEPS = [1, 2, 3];
const BATCH_ISBNS = 100; // ISBNdb's bulk limit
const OL_PAGE = 200;
// `editions` is Open Library's featured edition of the work: in English
// (the query asks for it), usually the one with a cover.
const OL_FIELDS =
  "key,title,author_name,first_publish_year,publish_year,readinglog_count,want_to_read_count,ratings_average,ratings_count,isbn,subject_key,editions,editions.isbn,editions.language";
// Skips that more editions might fix.
export const RETRYABLE = /no usable english edition|no cover|no blurb|doesn't class it/i;
const UA = "YourNextTale-catalogue/1.0";

// Picture books and early readers: not what Discover is for.
export const YOUNG_CHILDREN = /picture_book|board_book|early_reader|easy_reader|beginning_reader|toddler|baby|ages_[0-8](?:\b|-)/;
// Formats whose "cover" isn't a book cover, or that aren't the book.
const NOT_A_BOOK = /audio|\bcd\b|mp3|cassette|calendar|poster|toy|game|map|spiral|library binding/i;
const WRONG_EDITION = /large print|graphic novel|coloring|colouring|study guide|summary of|sparknotes|cliffsnotes|box(?:ed)? set|collection set/i;
// Works that aren't one novel: omnibuses, box sets, companions, comics.
export const NOT_A_NOVEL =
  /\b(?:box(?:ed)? ?set|omnibus|trilogy|quartet|books? \d+\s*[-–&]\s*\d+|complete (?:series|collection|works)|graphic novel|manga|film comics?|colou?ring book|official companion|the art of|guide to|encyclopedia|world of|playscript|script book)\b|^the chronicles of narnia$/i;
// Japanese, Chinese or Korean script in the title: a manga volume or a translation's record.
export const CJK_TITLE = /[぀-ヿ一-鿿가-힯]/;
// Editions filed under these are comics or plays, not the novel. ("Comic
// fiction" is humour, so not plain "comic".)
const NOT_PROSE = /comics|comic books|comic strips|strip cartoons|graphic novel|\bmanga\b|^drama\b|\bplays\b|playscript/i;
// A large-print edition's cover isn't the one readers know.
const LARGE_PRINT = /large (?:print|type)/i;

/**
 * The edition really is filed under these subjects: they're a real share of
 * its list. Some ISBNdb records merge every tag any copy ever had (fifty
 * subjects with "Comic books, strips" and "Large type books" among "Fantasy
 * fiction"), and one stray tag there says nothing about this edition.
 */
function filedUnder(subjects, re) {
  const n = subjects.filter((s) => re.test(s)).length;
  return n > 0 && (subjects.length <= 8 || n / subjects.length >= 0.25);
}

/**
 * A comic or manga series, judged from Open Library's tags before spending an
 * ISBNdb call on it. Novels with a graphic-novel adaptation (Coraline, The
 * Giver, Uglies) pick up a few comic tags too, so it takes a large share of
 * them and no publisher fiction category.
 */
export function isComicWork(work) {
  const keys = work.subject_key || [];
  if (!keys.length) return false;
  const comic = keys.filter((k) => /comic|graphic_novel|manga/.test(k)).length;
  const prose = keys.some((k) => /^(?:fiction|young_adult_fiction|juvenile_fiction)_/.test(k));
  return !prose && comic / keys.length >= 0.4;
}

/** Open Library works for one slice, most read first. */
export async function openLibraryWorks(slice, { log = () => {}, fetchJson = defaultFetchJson } = {}) {
  const out = [];
  for (let page = 1; out.length < slice.take; page++) {
    const url =
      `https://openlibrary.org/search.json?q=${encodeURIComponent(slice.q)}` +
      `&sort=readinglog&language=eng&limit=${OL_PAGE}&page=${page}&fields=${OL_FIELDS}`;
    const json = await fetchJson(url);
    const docs = json?.docs || [];
    out.push(...docs);
    log(`open library: ${slice.label} page ${page} → ${docs.length}`);
    if (docs.length < OL_PAGE || (docs.at(-1)?.readinglog_count || 0) < MIN_READERS) break;
  }
  return out.slice(0, slice.take).filter((w) => (w.readinglog_count || 0) >= MIN_READERS);
}

async function defaultFetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(180000) });
      if (res.ok) return await res.json();
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  return null;
}

/** ISBN-10 → ISBN-13 (978 prefix), or null. */
export function isbn10to13(isbn10) {
  const d = String(isbn10 || "").replace(/[^0-9Xx]/g, "");
  if (d.length !== 10) return null;
  const core = `978${d.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 ? 3 : 1);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/**
 * Up to `max` English-language ISBN-13s, best bet first: the editions another
 * source says readers use (`work.prefer`, from Hardcover or a bookshop's
 * list), Open Library's featured edition, then picks spread across the
 * work's other editions.
 */
export function candidateIsbns(work, max = ISBNS_PER_WORK) {
  const to13 = (i) => (i.length === 13 ? i : isbn10to13(i));
  const preferred = (work.prefer || []).map((p) => p.isbn).filter((i) => isEnglishIsbn(i)).slice(0, 4);
  const featured = [...new Set((work.editions?.docs?.[0]?.isbn || []).map(to13))]
    .filter((i) => i && isEnglishIsbn(i))
    .slice(0, 1);
  const first = [...new Set([...preferred, ...featured])].slice(0, max);
  const raw = work.isbn || [];
  const native = raw.filter((i) => i.length === 13 && isEnglishIsbn(i));
  const converted = raw.filter((i) => i.length === 10).map(isbn10to13).filter((i) => i && isEnglishIsbn(i));
  const list = [...new Set([...native, ...converted])].filter((i) => !first.includes(i));
  const room = max - first.length;
  if (list.length <= room) return [...first, ...list];
  // Evenly spaced picks reach more publishers than the first few would.
  const step = list.length / room;
  return [...first, ...Array.from({ length: room }, (_, i) => list[Math.floor(i * step)])];
}

// "Science Fiction & Fantasy" is a bookshop shelf, not a genre: it says
// nothing about which of the two a book is. So is "Science Fiction, Fantasy,
// Mystery & Horror" (where every children's novel with magic in it goes).
const SHELF =
  /(?:science fiction|sci-?fi)\s*(?:,|&|and|\/)\s*fantasy(?:\s*,\s*mystery\s*(?:&|and)\s*horror|\s*,?\s*(?:&|and)\s*magic)?|fantasy\s*(?:&|and|\/)\s*(?:science fiction|sci-?fi)/g;
const FANTASY = /\bfantasy\b|sword & sorcery|dragons|fairies|magic\b/;
const SCIFI = /science fiction|sci-fi|space opera|cyberpunk|dystopi|time travel|aliens\b/;

/**
 * Genre terms the rest of the app understands, from each edition's publisher
 * subjects (one list per edition) and the work's Open Library tags.
 */
export function genresFor(subjectLists, olSubjectKeys) {
  const lists = (subjectLists || []).every(Array.isArray) ? subjectLists || [] : [subjectLists];
  // Open Library's own subject tags are crowd-sourced and noisy; only the ones
  // copied from publisher categories (fiction_fantasy_epic…) are trusted here.
  const ol = (olSubjectKeys || [])
    .filter((k) => /^(?:fiction|young_adult_fiction|juvenile_fiction)_/.test(k))
    .map((k) => k.replace(/_+/g, " "));
  const sources = [...lists.map((l) => l.join(" | ")), ...ol].map((s) => s.toLowerCase().replace(SHELF, " "));
  // One stray source filed under the other genre (A Feast for Crows under
  // "science fiction / action & adventure") doesn't make a book both: the
  // weaker of the two needs two sources and a third of the stronger's.
  const fantasyN = sources.filter((s) => FANTASY.test(s)).length;
  const scifiN = sources.filter((s) => SCIFI.test(s)).length;
  const top = Math.max(fantasyN, scifiN);
  const holds = (n) => n > 0 && (n === top || (n >= 2 && n * 3 >= top));
  const fantasy = holds(fantasyN);
  const scifi = holds(scifiN);
  // The finer tags need two sources too, unless the book only has one or two:
  // one edition's "Romance" doesn't make The Magician's Nephew romantasy.
  const need = Math.max(1, Math.min(2, sources.length));
  const has = (re) => sources.filter((s) => re.test(s)).length >= need;
  const g = new Set();
  if (fantasy) g.add("fantasy");
  if (scifi) g.add("science fiction");
  if (fantasy && has(/\bepic\b/)) g.add("epic fantasy");
  if (has(/dark fantasy/)) g.add("dark fantasy");
  if (fantasy && has(/urban fantasy|urban\b/)) g.add("urban fantasy");
  if (has(/space opera/)) g.add("space opera");
  if (has(/dystopi/)) g.add("dystopian");
  if (has(/cyberpunk/)) g.add("cyberpunk");
  if (has(/time travel/)) g.add("time travel");
  if (scifi && has(/military/)) g.add("military science fiction");
  if (has(/romance|romantic/)) g.add("romance");
  if (fantasy && has(/romance|romantic|romantasy/)) g.add("romantasy");
  if (has(/young adult|\bteen/)) g.add("young adult");
  if (has(/horror/)) g.add("horror");
  if (has(/mystery|detective/)) g.add("mystery");
  if (has(/thriller|suspense/)) g.add("thriller");
  if (has(/humou?r|comic fiction/)) g.add("humour");
  return [...g];
}

/** How good an edition is to take the book's facts from. Negative: unusable. */
function editionScore(e) {
  if (!e?.title || isBundle(e.title)) return -1;
  if (e.language && !/^en/i.test(e.language)) return -1;
  if (NOT_A_BOOK.test(e.format || "") || WRONG_EDITION.test(e.title) || WRONG_EDITION.test(e.format || "")) return -1;
  if (filedUnder(e.subjects || [], NOT_PROSE) || filedUnder(e.subjects || [], LARGE_PRINT)) return -1;
  let s = 0;
  if ((e.description || "").length >= MIN_DESCRIPTION) s += 10;
  if (e.covers?.length) s += 6;
  if (/paperback/i.test(e.format || "")) s += 4;
  else if (/hardcover|hardback/i.test(e.format || "")) s += 3;
  else if (/kindle|ebook|e-book|digital/i.test(e.format || "")) s += 1;
  // Collector's and limited editions often only have a mock-up or a text card.
  if (cleanTitle(e.title).special) s -= 6;
  // Recent editions carry the covers readers know today.
  const year = Number(String(e.published || "").slice(0, 4)) || 0;
  if (year >= 2010) s += 2;
  if (year >= 2018) s += 1;
  return s;
}

/** Every edition ISBNdb returned that is this work, in any format. */
function workEditions(work, facts) {
  // A work can go by two titles (Northern Lights is The Golden Compass in
  // the US); an edition under either is the work.
  const wants = [work.title, ...(work.altTitles || [])].map((title) =>
    describeWork({ title, authors: work.author_name || [] })
  );
  return candidateIsbns(work)
    .map((isbn) => facts.get(isbn))
    .filter(Boolean)
    .filter((e) => {
      const got = describeWork({ title: e.title, authors: e.authors });
      return wants.some((want) => sameWork(want, got));
    });
}

/** The work's editions ISBNdb returned that really are this book, best first. */
export function matchingEditions(work, facts) {
  return workEditions(work, facts)
    .map((e) => ({ ...e, score: editionScore(e) }))
    .filter((e) => e.score >= 0)
    .sort((a, b) => b.score - a.score);
}

const openLibraryCover = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

// Where a batch's time goes (summed over the covers in hand at once), for
// the import's log.
const coverTime = { fetched: 0, fetchMs: 0, checked: 0, checkMs: 0 };

/**
 * The first cover that passes every check: good before merely acceptable.
 * Exported for the import's tests.
 */
export async function bestCover(editions, book, log = () => {}, work = null) {
  // An image that could be the cover: { buf, a, url }, or null.
  const candidate = async (url) => {
    const from = Date.now();
    const buf = await fetchCover(url);
    coverTime.fetched++;
    coverTime.fetchMs += Date.now() - from;
    if (!buf) return null;
    const a = await assessCover(buf);
    // An exact 3:4 or 9:16 frame is a phone photo of a copy, not the artwork.
    if (a.width && [3 / 4, 9 / 16].some((frame) => Math.abs(a.width / a.height - frame) < 0.004)) return null;
    return a.tier === COVER_GOOD || a.tier === COVER_WEAK ? { buf, a, url } : null;
  };
  const verified = async (c, options) => {
    const from = Date.now();
    const v = await verifyCover(c.buf, book, options);
    coverTime.checked++;
    coverTime.checkMs += Date.now() - from;
    if (!v.ok) log(`  cover refused (${v.reason})`);
    return v.ok;
  };

  const urls = [
    ...new Set([...editions.flatMap((e) => e.covers || []), ...editions.slice(0, 2).map((e) => openLibraryCover(e.isbn))])
  ].slice(0, 6);
  const weak = [];
  for (const url of urls) {
    const c = await candidate(url);
    if (!c) continue;
    if (c.a.tier !== COVER_GOOD) weak.push(c);
    else if (await verified(c)) return c;
  }
  for (const c of weak) if (await verified(c)) return c;

  // Last resort: Open Library's cover of another edition (a popular book's
  // ISBNdb images are often all photos of the special edition). Nothing has
  // checked these ISBNs against the book, so its title or author has to be
  // readable on the cover.
  const others = [...new Set([...editions.map((e) => e.isbn), ...(work ? candidateIsbns(work, 12) : [])])]
    .map(openLibraryCover)
    .filter((url) => !urls.includes(url))
    .slice(0, 5);
  for (const url of others) {
    const c = await candidate(url);
    if (c && (await verified(c, { mustMention: true }))) return c;
  }
  return null;
}

/**
 * The work's title as a reader writes it: no "(Shatter Me)" or "(The
 * Selection #3)" tag, and a publisher's capitals ("Unravel Me") over a
 * crowd-sourced record's ("Unravel me").
 */
export function displayTitle(work, editions = []) {
  // Open Library cuts some tags short: "Rowan of Rin (Rowan of Rin".
  const stripTag = (t) => t.replace(/\s*\([^()]*\)\s*$/, "").replace(/\s*\([^()]*$/, "").trim();
  // A work first described in its own language ("O Alquimista") or under a
  // series name goes by the title its best English edition carries.
  const names = [work.title, ...(work.altTitles || [])].filter(Boolean);
  let name = work.title;
  if (names.length > 1 && editions.length) {
    const got = describeWork({ title: editions[0].title, authors: [] });
    name = names.find((t) => sameWork(describeWork({ title: t, authors: [] }), got)) || work.title;
  }
  const base = stripTag(tidyTitle(name)) || tidyTitle(name);
  // ISBNdb's records for older editions come from libraries and are in
  // sentence case too ("The cat who walks through walls"), so the first
  // edition whose title matches isn't always the publisher's. One written in
  // title case wins; failing that, the best there is gets title-cased.
  const matches = editions
    .map((e) => stripTag(cleanTitle(e.title).title).replace(/:\s*a novel$/i, ""))
    .filter((t) => plain(t) === plain(base) && /[a-z]/.test(t));
  const cased = matches.find((t) => !needsTitleCase(t));
  return cased || publisherCasing(matches[0] || base, [base, ...editions.map((e) => e.title)]);
}

/**
 * The year the work first came out. Open Library's own figure takes the
 * earliest edition on record, and one mis-dated record makes A Dance with
 * Dragons 2008 (then 2011 onwards) or Heartless 2000 (then 2016 onwards). A
 * lone early year more than two years before the next is ignored, unless an
 * ISBNdb edition confirms it.
 *
 * Only for books from 1990 on. Older books have sparse records with long
 * gaps between editions (I, Robot 1950 then 1956; Nightflyers 1985 then
 * 2010), and their stated first year is right far more often than a gap
 * rule would be.
 */
export function firstYear(work, editions = []) {
  const years = [...new Set((work.publish_year || []).map(Number).filter((y) => y >= 1800))].sort((a, b) => a - b);
  const stated = Number(work.first_publish_year) || years[0] || 0;
  if (years.length < 3 || stated < 1990) return stated;
  let year = stated;
  for (let i = 0; i < years.length - 1; i++) {
    if (years[i + 1] - years[i] <= 2) {
      year = years[i];
      break;
    }
  }
  const confirmed = editions
    .map((e) => Number(String(e.published || "").slice(0, 4)))
    .filter((y) => y >= stated && y < year)
    .sort((a, b) => a - b)[0];
  return confirmed || year;
}

/**
 * When the work first came out: { year, date }.
 *
 * Open Library and Hardcover each state a first year, and each is wrong about
 * one book in twelve, nearly always too early: a record made before the book
 * was out (Klara and the Sun, 2019), or another book's date (The Rook, 2001).
 * So where they differ the later year stands, unless ISBNdb has an edition
 * from before it, which shows the later year is a reissue's.
 *
 * A work only Hardcover knows goes by its year unless an ISBNdb edition is
 * older; one neither dates, by the oldest edition ISBNdb returned.
 */
export function firstPublished(work, editions = []) {
  const editionYears = editions
    .map((e) => Number(String(e.published || "").slice(0, 4)))
    .filter((y) => y >= 1800)
    .sort((a, b) => a - b);
  const ol = firstYear(work, editions);
  const hc = Number(work.hc?.year) || 0;
  let year = ol;
  if (ol >= 1800 && hc >= 1800 && ol !== hc) {
    const [early, late] = ol < hc ? [ol, hc] : [hc, ol];
    year = editionYears.find((y) => y >= early && y < late) || late;
  } else if (ol < 1800) {
    const oldest = editionYears.find((y) => y >= 1970);
    year = hc ? Math.min(hc, oldest || hc) : oldest || 0;
  }
  if (year < 1800) return { year: 0, date: null };
  // Its first edition's exact date when a source has it, else the year.
  // The first of January is what records say when they only know the year.
  const date = [...editions.map((e) => e.releaseDate), work.hc?.releaseDate]
    .map((d) => String(d || "").slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) === year && !d.endsWith("-01-01"))
    .sort()[0];
  return { year, date: date || `${year}-01-01` };
}

/**
 * Index of the catalogue for "do we have this already, and which row is it?".
 * Rows are { id, title, authors, isbn_13, hardcover_id }.
 */
export function catalogueIndex(rows) {
  const byKey = new Map();
  const byIsbn = new Map();
  const byHardcover = new Map();
  const add = (r) => {
    const w = describeWork({ title: r.title, authors: r.authors || [] });
    const entry = { id: r.id ?? null, w };
    if (r.isbn_13) byIsbn.set(r.isbn_13, entry);
    if (r.hardcover_id) byHardcover.set(String(r.hardcover_id), entry);
    for (const k of [w.core, w.alt].filter(Boolean)) {
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(entry);
    }
    return entry;
  };
  for (const r of rows) add(r);

  /** The catalogue's entry ({ id }) for a work, or null. */
  const find = (work) => {
    if (work.hc?.id && byHardcover.has(String(work.hc.id))) return byHardcover.get(String(work.hc.id));
    const probes = [work.title, ...(work.altTitles || [])].map((title) =>
      describeWork({ title, authors: work.author_name || [] })
    );
    // Crowd-sourced records file the odd ISBN under the wrong work, so a
    // shared ISBN counts only when the authors agree too.
    for (const i of work.isbn || []) {
      const hit = byIsbn.get(i.length === 10 ? isbn10to13(i) : i);
      if (hit && authorsOverlap(hit.w.authors, probes[0].authors)) return hit;
    }
    for (const w of probes) {
      for (const k of [w.core, w.alt].filter(Boolean)) {
        const hit = (byKey.get(k) || []).find((x) => sameWork(w, x.w));
        if (hit) return hit;
      }
    }
    return null;
  };
  return { find, has: (work) => !!find(work), add };
}

/**
 * Turn one work plus ISBNdb's facts into a books row, or a reason it was left
 * out (`transient` when a later run should simply try again). Downloads and
 * checks the cover; doesn't store anything.
 */
export async function buildRow(work, facts, { log = () => {}, today = new Date().toISOString().slice(0, 10) } = {}) {
  if (NOT_A_NOVEL.test(work.title || "") || CJK_TITLE.test(work.title || "")) return { skip: "not a single novel" };
  const editions = matchingEditions(work, facts);
  if (!editions.length) return { skip: "ISBNdb has no usable English edition" };
  const best = editions[0];

  // Genres from every edition's subjects, not just those good enough to take
  // a cover from: a library binding or an audiobook is often the one filed
  // under "Fantasy & Magic". Comic adaptations don't count.
  const prose = workEditions(work, facts).filter((e) => !filedUnder(e.subjects || [], NOT_PROSE));
  const genres = genresFor(
    prose.map((e) => e.subjects || []),
    work.subject_key
  );
  if (!genres.includes("fantasy") && !genres.includes("science fiction")) {
    return { skip: "publisher doesn't class it as fantasy or science fiction" };
  }

  // The blurb is the same whatever the binding: an audiobook's or a library
  // edition's will do when the paperback's record has none.
  const description =
    [...editions, ...prose.filter((e) => !e.language || /^en/i.test(e.language))]
      .map((e) => e.description)
      .find((d) => (d || "").length >= MIN_DESCRIPTION) || null;
  if (!description) return { skip: "no blurb" };

  // The work's title is the plain one ("Six of Crows", not "Six of Crows
  // (Six of Crows, 1)"); its authors are the work's, not a narrator's.
  const title = displayTitle(work, editions);
  const isbndbAuthors = describeWork({ title, authors: editions.flatMap((e) => e.authors || []) }).authors;
  const olAuthors = tidyAuthors(work.author_name || []).slice(0, 3);
  const authors = olAuthors.filter((a) => isbndbAuthors.has(authorKey(a)));
  if (!authors.length && olAuthors.length) authors.push(olAuthors[0]);
  if (!authors.length) return { skip: "no author" };

  const { year, date } = firstPublished(work, editions);
  if (year < 1800) return { skip: "no first-published year" };
  // Upcoming books belong to the releases sync, which knows about pre-orders.
  if (date > today) return { skip: "not out yet", transient: true };

  const cover = await bestCover(editions, { title, authors, year }, log, work);
  if (!cover) return { skip: "no cover passed the checks" };

  const md5 = crypto.createHash("md5").update(cover.buf).digest("hex").slice(0, 8);
  return {
    cover,
    coverName: `${best.isbn}-${md5}${cover.a.ext}`,
    row: {
      title,
      authors,
      description,
      genres,
      page_count: best.pages || editions.find((e) => e.pages)?.pages || null,
      published_date: date,
      publisher: best.publisher || null,
      isbn_13: best.isbn,
      isbn_10: best.isbn10 || null,
      language: "en",
      source: "isbndb",
      is_incomplete: false,
      bookshop_affiliate_link: getBookshopLink(best.isbn)
    },
    readers: work.readinglog_count || 0
  };
}

/** Run `fn` over the items, `n` at a time, keeping their order. */
async function inParallel(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(lanes);
  return out;
}

/**
 * Look the candidates up on ISBNdb in batches of 100 ISBNs and build rows.
 * Each work first gets one or two ISBNs (see STEPS); one that those don't
 * settle goes round again with more. `onBuilt(result, work)` gets every
 * final outcome (rows and skips), one at a time and in the candidates'
 * order, so the caller decides whether to store, preview or just count.
 * `parallel` is how many covers are fetched and checked at once.
 *
 * Stops before a request would leave less than `reserve` of ISBNdb's daily
 * allowance (the site's own lookups need it) or spend more than `budget`.
 * Works it didn't get to aren't reported, so a later run picks them up.
 */
export async function lookUpCandidates(
  candidates,
  { onBuilt, log = () => {}, limit = Infinity, reserve = 0, budget = Infinity, parallel = 1 } = {}
) {
  const facts = new Map();
  let calls = 0;
  let units = 0;
  let stopped = null;
  let failures = 0;
  const fresh = candidates.slice(0, limit).map((work) => {
    const isbns = candidateIsbns(work);
    const sure = work.prefer?.[0]?.tier === 0 && work.prefer[0].isbn === isbns[0];
    return { work, isbns, asked: 0, look: 0, steps: sure ? SURE_STEPS : STEPS };
  });
  const again = [];
  const nextIsbns = (job) => job.isbns.slice(job.asked, job.asked + (job.steps[job.look] ?? job.isbns.length));
  const pending = (q) => q.reduce((n, job) => n + nextIsbns(job).length, 0);

  while (!stopped && (fresh.length || again.length)) {
    // Works on a later look go once they fill a request, or when nothing else is left.
    const fromAgain = again.length && (!fresh.length || pending(again) >= BATCH_ISBNS);
    const queue = fromAgain ? again : fresh;
    const batch = [];
    const isbns = [];
    while (queue.length) {
      const next = nextIsbns(queue[0]);
      if (batch.length && isbns.length + next.length > BATCH_ISBNS) break;
      batch.push({ job: queue.shift(), next });
      isbns.push(...next);
    }
    const left = isbndbQuota()?.remaining;
    if (units + isbns.length > budget) stopped = `this run's budget of ${budget} is spent`;
    else if (left != null && left - isbns.length < reserve) stopped = `keeping ${reserve} of ISBNdb's daily allowance for the site (${left} left)`;
    if (stopped) break;

    const found = await isbndbBooks(isbns, { log });
    if (!found.size && isbns.length >= 10) {
      // No answer at all is ISBNdb failing, not a hundred unknown books:
      // put the works back rather than write them off.
      if (++failures >= 3) {
        stopped = "ISBNdb stopped answering";
        break;
      }
      queue.unshift(...batch.map((b) => b.job));
      await new Promise((r) => setTimeout(r, 5000 * failures));
      continue;
    }
    failures = 0;
    for (const [isbn, e] of found) facts.set(isbn, e);
    calls++;
    units += isbns.length;
    log(`isbndb call ${calls} (${fromAgain ? "another look" : "first look"}): ${isbns.length} ISBNs, ${batch.length} books, ${isbndbQuota()?.remaining ?? "?"} left today`);

    const began = Date.now();
    Object.assign(coverTime, { fetched: 0, fetchMs: 0, checked: 0, checkMs: 0 });
    const results = await inParallel(batch, parallel, ({ job, next }) => {
      job.asked += next.length;
      job.look++;
      return buildRow(job.work, facts, { log }).catch((e) => ({ skip: `lookup failed (${e.message})`, transient: true }));
    });
    const secs = (ms) => Math.round(ms / 1000);
    log(
      `  ${batch.length} books built in ${secs(Date.now() - began)}s: ${coverTime.fetched} covers fetched (${secs(coverTime.fetchMs)}s), ${coverTime.checked} checked (${secs(coverTime.checkMs)}s), ${parallel} at once`
    );
    for (let i = 0; i < batch.length; i++) {
      const { job } = batch[i];
      const result = results[i];
      if (result.skip && RETRYABLE.test(result.skip) && job.asked < job.isbns.length) again.push(job);
      else await onBuilt(result, job.work);
    }
  }
  return { calls, units, stopped, left: isbndbQuota() };
}
