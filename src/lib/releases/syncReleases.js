// Builds New & upcoming from what booksellers are featuring: Waterstones'
// fantasy, science fiction, coming-soon and new-books pages, and Bookshop.org's
// editors' lists. The facts come from each book's Waterstones page, ISBNdb,
// Open Library and (with a key) Google Books. A book has to clear the quality
// bar in ./quality (a real title, an ISBN, an exact date, a proper
// description, a finished cover) before it's added to the catalogue or shown.
// The result is a snapshot the page reads; order, picks and series don't fit
// the books table, so they live there.
//
// The shops protect their sites with bot checks, so we ask for little: the
// eight list pages, and at most a few new books' pages, each run. Whatever we
// read is cached in storage; when a shop turns us away, last time's copy is
// used and the run says so.
//
// Server only. `supabase` must be allowed to write to books and the books
// storage bucket (the service role).
import crypto from "crypto";
import { WATERSTONES_LISTS, readWaterstonesList, waterstonesBook, isShopCode, SHOP as WATERSTONES } from "./retailers/waterstones";
import { BOOKSHOP_LISTS, readBookshopList } from "./retailers/bookshop";
import { BlockedError } from "./retailers/politeFetch";
import { isbndbBooks, isbndbFindIsbn, isbndbEditions, IsbndbLimitError } from "./isbndbBulk";
import { openLibraryFacts, googleBooksFacts, firstPublishedYear } from "./bookFacts";
import { bookProblems, verifyCover, MIN_DESCRIPTION } from "./quality";
import { fetchCover, assessCover } from "@/lib/books/coverQuality";
import { closeCoverReader } from "@/lib/books/coverText";
import { uploadCover, isPlaceholderTitle } from "@/lib/books/fetchAndNormaliseBook";
import { sanitiseDescription } from "@/lib/books/sanitiseDescription";
import { describeWork, sameWork, titlesCompatible, titleCore, authorsOverlap } from "@/lib/books/sameBook";
import { tidyTitle, tidyAuthors } from "@/lib/books/tidyText";
import { getBookshopLink } from "@/lib/bookshop";
import { isNonEnglishIsbn } from "@/lib/books/isbnUtils";
import { RELEASE_GENRES, RELEASES_SNAPSHOT_PATH, COVER_CHECKS_PATH, RETAIL_CACHE_PATH } from "./genres";

const DAY = 86400000;
const RECENT_DAYS = 120;
const UPCOMING_DAYS = 365;
// A list's last good copy stands in for up to four weeks.
const LIST_CACHE_DAYS = 28;
// A book's shop page is re-read after three weeks (dates move).
const PAGE_FRESH_DAYS = 21;
const PAGES_PER_RUN = 20;
// Open Library / Google answers are kept for a week.
const FACTS_FRESH_DAYS = 7;
const BOOK_COLUMNS =
  "id, title, authors, description, cover_url, published_date, genres, page_count, isbn_13, is_incomplete, source";
const SFF = new Set(RELEASE_GENRES.map((g) => g.slug));

const isIsbn = (s) => /^97[89]\d{10}$/.test(String(s || "")) && !isNonEnglishIsbn(String(s));
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const earliest = (dates) => dates.filter(Boolean).sort()[0] || null;
const md5 = (buf) => crypto.createHash("md5").update(buf).digest("hex");
// Bump when the cover checks get stricter (2: covers are also read inverted,
// which catches light-on-dark "cover to be revealed" notes; 3: 3D product
// shots of special editions are turned down; 4: the top and bottom bands are
// read close up, and "T0 BE REVEALED" counts).
const COVER_CHECKS_VERSION = 4;
const ageDays = (iso, now) => (iso ? (now - Date.parse(iso)) / DAY : Infinity);

// ": Exclusive Edition", "(Deluxe Limited Edition)", ": A Novel" describe the
// edition, not the book.
const EDITION_NOTE = /(?:\s*:\s*|\s+[-–—]\s+|\s*\(\s*|\s*\[\s*)(?:[\w'’&-]+\s+){0,4}edition\s*[)\]]?\s*$/i;
const NOVEL_NOTE = /\s*(?::\s*|\(\s*)a novel\)?\s*$/i;
// Shop shorthand for the format: "To Flame Wild Flower Hb".
const FORMAT_NOTE = /\s+[(\[]?(?:hb|pb|hbk|pbk|hardback|paperback|hardcover)[)\]]?$/i;
// "The Ballad of Falling Dragons Deluxe Edition" (no separator).
const EDITION_TAIL = /\s+(?:(?:deluxe|special|collector'?s|limited|exclusive|signed|illustrated|anniversary|gift)\s+){1,3}edition$/i;
const SPECIAL = /deluxe|special|exclusive|signed|limited|collector|sprayed|illustrated|anniversary/i;
// A bracketed note anywhere in the title about the format or edition:
// "Little Mushroom (Deluxe Hardcover Novel) Vol. 1".
const FORMAT_PAREN =
  /\s*\((?=[^)]*\b(?:deluxe|special|collector'?s|limited|exclusive|signed|illustrated|anniversary|hardcover|hardback|paperback|novel|edition)\b)[^)]*\)/i;
// "Once There Were Heroes: Book 1 in A Time of Dragons"
const SERIES_NOTE = /^(.+?)\s*[:(]\s*(?:book|volume|vol\.?)\s+(\d+(?:\.\d+)?)\s+(?:in|of)\s+(.+?)\)?$/i;

export function cleanTitle(raw) {
  // Curly apostrophes too: "The Burning God Collector’s Edition".
  let title = tidyTitle(String(raw || "")).replace(/[‘’]/g, "'").trim();
  let special = false;
  let series = null;
  for (;;) {
    // A note cut off mid-way: "Alchemised (Deluxe Three".
    const open = title.match(/\s*\([^)]*$/);
    if (open) {
      special ||= SPECIAL.test(open[0]);
      title = title.slice(0, open.index).trim();
    }
    const next = title
      .replace(FORMAT_PAREN, "")
      .replace(EDITION_TAIL, "")
      .replace(EDITION_NOTE, "")
      .replace(NOVEL_NOTE, "")
      .replace(FORMAT_NOTE, "")
      // "…: A Bartholomew Tale: A Bartholomew Tale" — a subtitle said twice.
      .replace(/(:\s*[^:]+?)\1$/i, "$1")
      // Punctuation left hanging: "Vine of Hearts:".
      .replace(/\s*[:;,\-–—]+$/, "")
      .trim();
    if (next === title) break;
    special ||= EDITION_NOTE.test(title) || EDITION_TAIL.test(title) || SPECIAL.test(title.match(FORMAT_PAREN)?.[0] || "");
    title = next;
  }
  const m = title.match(SERIES_NOTE);
  if (m) {
    title = m[1].trim();
    series = { name: m[3].trim(), position: Number(m[2]) };
  }
  return { title, special, series };
}

/**
 * A shop's series name, with the book's place in it pulled out:
 * "The Moonfall Series Book 2" → { name: "The Moonfall Series", position: 2 },
 * "Villains 3" → { name: "Villains", position: 3 }.
 */
export function seriesFromName(raw) {
  const name = String(raw || "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  const m =
    name.match(/^(.+?)[\s,:(-]+(?:book|volume|vol\.?|part|no\.?|#)\s*(\d{1,2}(?:\.\d)?)\)?$/i) ||
    name.match(/^(.+?[a-z])\s*\(?\s*([1-9]|1\d|20)\)?$/i);
  return m ? { name: m[1].trim(), position: Number(m[2]) } : { name };
}

// Waterstones shelving under fantasy / science fiction → genre words the rest
// of the app filters on ("epic-high-fantasy" → "epic high fantasy").
function subgenres(categories = []) {
  const out = new Set();
  for (const c of categories) {
    const m = c.match(/science-fiction-fantasy-horror\/(?:fantasy|science-fiction)\/([a-z-]+)$/);
    if (m) out.add(m[1].replace(/-/g, " ").replace(/^fantasy romance$/, "romantasy"));
  }
  return [...out];
}

function scoreOf(picks) {
  const best = new Map();
  for (const p of picks) {
    const key = `${p.shop}:${p.list}`;
    const value = p.weight * (1 - (p.rank / Math.max(p.size, 1)) * 0.5);
    best.set(key, Math.max(best.get(key) || 0, value));
  }
  const shops = new Set(picks.map((p) => p.shop)).size;
  return [...best.values()].reduce((a, b) => a + b, 0) + (shops - 1) * 2;
}

/** One entry per book, however many lists and editions it turns up as. */
function groupPicks(picks) {
  const groups = [];
  for (const p of picks) {
    const { title, special } = cleanTitle(p.title);
    if (!title) continue;
    const authors = tidyAuthors(p.authors || []);
    const work = describeWork({ title, authors });
    const isbn = isIsbn(p.isbn) ? p.isbn : null;
    let g = groups.find((x) => (isbn && x.isbns.has(isbn)) || sameWork(x.work, work));
    if (!g) {
      g = { work, title, authors, isbns: new Set(), tradeIsbns: new Set(), picks: [], hints: new Set(), pages: [] };
      groups.push(g);
    }
    if (isbn) {
      g.isbns.add(isbn);
      if (!special) g.tradeIsbns.add(isbn);
    }
    if (!special && title.length < g.title.length) g.title = title;
    if (!g.authors.length) g.authors = authors;
    if (p.genre) g.hints.add(p.genre);
    g.picks.push(p);
  }
  for (const g of groups) g.score = scoreOf(g.picks);
  return groups.sort((a, b) => b.score - a.score);
}

// Open Library's covers are free to show; `default=false` makes a missing one a
// 404 rather than a blank.
const openLibraryCover = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

/** Everything we know about a book, merged from its shop pages and the APIs. */
function mergeFacts(g, factsFor) {
  const primary = g.pages.map((p) => p.isbn).find(isIsbn) || [...g.tradeIsbns][0] || [...g.isbns][0] || null;
  const isbns = [primary, ...g.tradeIsbns, ...g.isbns].filter((v, i, a) => v && a.indexOf(v) === i);
  const api = isbns.flatMap((i) => factsFor(i));
  const sources = [...g.pages, ...api];
  const trade = sources.filter((s) => !isShopCode(s.isbn) && !cleanTitle(s.title).special);

  // A genre page or genre list says what the book is. Otherwise the shop's
  // own shelving, then the APIs' subjects.
  const pageGenres = g.pages.flatMap((p) => p.genres || []);
  const genres = new Set(g.hints.size ? g.hints : pageGenres.length ? pageGenres : api.flatMap((s) => s.genres || []));
  // The shop's page, then the shop's own listing, then the APIs.
  const titleSource = [...g.pages, { title: g.title }, ...trade].find((s) => s.title && !isPlaceholderTitle(cleanTitle(s.title).title));
  const longest = (list) => list.map((s) => sanitiseDescription(s.description)).filter(Boolean).sort((a, b) => b.length - a.length)[0];
  // Covers and blurbs only from sources that license them for display
  // (ISBNdb, Open Library, Google Books), never the shops' own copies.
  const tradeApi = api.filter((s) => !isShopCode(s.isbn) && !cleanTitle(s.title).special);

  return {
    title: cleanTitle(titleSource?.title || g.title).title,
    authors: tidyAuthors(g.pages.find((p) => p.authors?.length)?.authors || g.authors || []),
    series:
      [...g.pages, ...g.picks].map((s) => cleanTitle(s.title).series).find(Boolean) ||
      seriesFromName(g.pages.find((p) => p.series)?.series),
    // The shop's own page wins; then the APIs for the main edition, in the
    // order factsFor returns them (Google, ISBNdb, Open Library); then any
    // other edition. A year on its own never counts.
    releaseDate: earliest(g.pages.map((p) => p.releaseDate)) || api.map((s) => s.releaseDate).find(Boolean) || null,
    // The earliest date any edition is known by (a bare year counts as its
    // last day): a deluxe edition of a book out last spring is a reissue.
    firstKnown: earliest([...g.pages.map((p) => p.releaseDate), ...api.map((s) => s.releaseDate || s.dateHint)]),
    description: longest(tradeApi) || longest(api) || null,
    pages: sources.map((s) => s.pages).find(Boolean) || null,
    isbn13: primary,
    isbns,
    genres: [...genres].filter((x) => SFF.has(x)),
    subgenres: subgenres(g.pages.flatMap((p) => p.categories || [])),
    children: sources.some((s) => s.children) && !g.hints.size,
    // Every listing is a deluxe / signed / exclusive edition.
    special: g.picks.every((p) => cleanTitle(p.title).special || isShopCode(p.isbn)) && !g.tradeIsbns.size,
    listedAs: g.picks.map((p) => p.title || ""),
    // ISBNdb's full-size artwork for the trade editions first, then any
    // edition's, then Open Library's by ISBN.
    covers: [
      ...tradeApi.flatMap((s) => s.covers || []),
      ...api.flatMap((s) => s.covers || []),
      ...isbns.filter(isIsbn).slice(0, 3).map(openLibraryCover)
    ].filter((u, i, a) => u && a.indexOf(u) === i),
    picks: g.picks
      .map((p) => ({ shop: p.shop, list: p.list, url: p.url }))
      .filter((p, i, a) => a.findIndex((q) => q.shop === p.shop && q.list === p.list) === i),
    score: Math.round(g.score * 10) / 10
  };
}

async function readJson(supabase, path) {
  try {
    const { data } = await supabase.storage.from("books").download(path);
    return data ? JSON.parse(await data.text()) : null;
  } catch {
    return null;
  }
}

async function writeJson(supabase, path, value, cacheControl = "300") {
  const { error } = await supabase.storage
    .from("books")
    .upload(path, JSON.stringify(value), { contentType: "application/json", cacheControl, upsert: true });
  if (error) throw new Error(`Couldn't save ${path}: ${error.message}`);
}

async function inBatches(list, size, fn) {
  for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn));
}

/** Reads one shop's lists until it turns us away; falls back to cached copies. */
async function readShop(lists, read, cache, now, log, report) {
  let blocked = null;
  const picks = [];
  for (const list of lists) {
    let live = null;
    if (!blocked) {
      try {
        live = await read(list, { log });
      } catch (e) {
        if (e instanceof BlockedError) blocked = e.message;
        else log(`${list.key}: ${e.message}`);
      }
    }
    if (live?.length) {
      cache.lists[list.key] = { fetchedAt: new Date(now).toISOString(), picks: live };
      picks.push(...live);
      report[list.key] = "read";
    } else if (cache.lists[list.key] && ageDays(cache.lists[list.key].fetchedAt, now) <= LIST_CACHE_DAYS) {
      picks.push(...cache.lists[list.key].picks);
      report[list.key] = `last copy from ${cache.lists[list.key].fetchedAt.slice(0, 10)}`;
    } else {
      report[list.key] = "unavailable";
    }
  }
  if (blocked) log(`${lists[0].shop}: ${blocked}; using cached lists where we have them`);
  return { picks, blocked: !!blocked };
}

export async function syncReleases(
  supabase,
  { log = () => {}, now = Date.now(), dryRun = false, budgetMs = 270000, maxPages = PAGES_PER_RUN } = {}
) {
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  // Still more than this share of the time budget left (always, with no budget).
  const hasTime = (share) => !Number.isFinite(budgetMs) || left() > budgetMs * share;
  const today = isoDay(now);
  const from = isoDay(now - RECENT_DAYS * DAY);
  const to = isoDay(now + UPCOMING_DAYS * DAY);
  const stats = { picks: 0, books: 0, added: 0, updated: 0, coversFixed: 0, coversCleared: 0, skipped: {}, failed: 0, lists: {} };
  const skip = (reason, what) => {
    stats.skipped[reason] = (stats.skipped[reason] || 0) + 1;
    log(`skipped ${what}: ${reason}`);
  };
  const cache = { lists: {}, pages: {}, facts: {}, ...((await readJson(supabase, RETAIL_CACHE_PATH)) || {}) };
  // We keep the facts from shop pages, not their blurbs or images (and drop
  // edition lookups from older versions of this sync).
  for (const entry of Object.values(cache.pages)) {
    if (entry?.page) {
      delete entry.page.description;
      delete entry.page.covers;
    }
  }
  for (const k of Object.keys(cache.facts)) if (/^(editions|first-edition|debut):/.test(k)) delete cache.facts[k];

  // 1. What the booksellers are featuring (both shops at once, each at its own pace).
  const [ws, bs] = await Promise.all([
    readShop(WATERSTONES_LISTS, readWaterstonesList, cache, now, log, stats.lists),
    readShop(BOOKSHOP_LISTS, readBookshopList, cache, now, log, stats.lists)
  ]);
  const picks = [...ws.picks, ...bs.picks];
  if (!picks.length) throw new Error("Couldn't read Waterstones or Bookshop.org, and there's no recent copy of their lists");
  stats.picks = picks.length;
  const groups = groupPicks(picks);
  stats.books = groups.length;
  log(`${picks.length} picks → ${groups.length} books`);

  // 2. ISBNdb for every ISBN the lists gave us (a request or two).
  const isbndb = await isbndbBooks(groups.flatMap((g) => [...g.isbns]), { log });

  // 3. Each book's Waterstones page: the shop's date and shelving.
  //    Cached for three weeks; only a few new ones are read per run.
  let wsBlocked = ws.blocked;
  let pagesRead = 0;
  for (const g of groups) {
    const pick = g.picks.find((p) => p.shop === WATERSTONES);
    const known = new Set([...g.hints, ...[...g.isbns].flatMap((i) => isbndb.get(i)?.genres || [])]);
    // Books only on Bookshop.org's lists: worth a look by ISBN if they're fantasy or sci-fi.
    const targets = pick ? [pick.url] : [...known].some((x) => SFF.has(x)) ? [...g.isbns].slice(0, 1) : [];
    for (const target of targets) {
      const key = `ws:${String(target).split("/").pop()}`;
      const cached = cache.pages[key];
      let page = cached?.page || null;
      const stale = !cached || ageDays(cached.fetchedAt, now) > PAGE_FRESH_DAYS;
      if (stale && !wsBlocked && pagesRead < maxPages && hasTime(0.5)) {
        try {
          pagesRead++;
          page = await waterstonesBook(target);
          cache.pages[key] = { fetchedAt: new Date(now).toISOString(), page };
        } catch (e) {
          if (e instanceof BlockedError) {
            wsBlocked = true;
            log(`waterstones: ${e.message}; book pages from cache only this run`);
          } else log(`waterstones page ${target}: ${e.message}`);
        }
      }
      if (page) {
        g.pages.push(page);
        if (isIsbn(page.isbn)) {
          g.isbns.add(page.isbn);
          if (!cleanTitle(page.title).special) g.tradeIsbns.add(page.isbn);
        }
        break;
      }
    }
  }
  stats.pagesRead = pagesRead;

  // ISBNs the pages added, and a trade ISBN for books only known as a
  // shop-exclusive edition.
  const more = await isbndbBooks(groups.flatMap((g) => [...g.isbns]).filter((i) => !isbndb.has(i)), { log });
  for (const [k, v] of more) isbndb.set(k, v);
  for (const g of groups) {
    if (g.isbns.size || !hasTime(0.4)) continue;
    const title = cleanTitle(g.pages[0]?.title || g.title).title;
    const want = describeWork({ title, authors: g.authors });
    const found = (await isbndbFindIsbn(title, g.authors[0]))
      .filter((b) => isIsbn(b.isbn) && sameWork(want, describeWork({ title: cleanTitle(b.title).title, authors: b.authors })))
      .sort((a, b) => (b.releaseDate ? 1 : 0) - (a.releaseDate ? 1 : 0));
    if (found[0]) {
      g.isbns.add(found[0].isbn);
      g.tradeIsbns.add(found[0].isbn);
      isbndb.set(found[0].isbn, found[0]);
    }
  }

  // Open Library (and Google Books, with a key) for books still missing an
  // exact date or a blurb.
  const factsFor = (isbn) =>
    [cache.facts[`gb:${isbn}`]?.facts, isbndb.get(isbn), cache.facts[`ol:${isbn}`]?.facts].filter(Boolean);
  const needy = groups.filter((g) => {
    const m = mergeFacts(g, factsFor);
    return !m.releaseDate || (m.description?.length || 0) < MIN_DESCRIPTION;
  });
  for (const g of needy) {
    if (!hasTime(0.35)) break;
    const isbn = mergeFacts(g, factsFor).isbn13;
    if (!isbn) continue;
    for (const [prefix, lookup] of [["gb", googleBooksFacts], ["ol", openLibraryFacts]]) {
      const key = `${prefix}:${isbn}`;
      if (cache.facts[key] && ageDays(cache.facts[key].fetchedAt, now) <= FACTS_FRESH_DAYS) continue;
      if (prefix === "gb" && !process.env.GOOGLE_BOOKS_API_KEY) continue;
      try {
        cache.facts[key] = { fetchedAt: new Date(now).toISOString(), facts: await lookup(isbn) };
      } catch (e) {
        log(`${prefix} ${isbn}: ${e.message}`);
      }
    }
  }

  // 4. Keep fantasy and sci-fi in the window; check, add or update each.
  const coverChecks = (await readJson(supabase, COVER_CHECKS_PATH)) || {};
  const checkCover = async (url, book) => {
    const buffer = await fetchCover(url);
    if (!buffer) return null;
    const hash = md5(buffer);
    let verdict = coverChecks[hash];
    // A pass from an older, looser check is checked again.
    if (verdict?.ok && (verdict.v || 1) < COVER_CHECKS_VERSION) verdict = null;
    if (!verdict) {
      verdict = await verifyCover(buffer, book);
      coverChecks[hash] = { ok: verdict.ok, reason: verdict.reason || null, fatal: !!verdict.fatal, v: COVER_CHECKS_VERSION };
    }
    // uploadCover needs the format; a cached pass doesn't carry it.
    const assessment = verdict.assessment || (verdict.ok ? await assessCover(buffer) : null);
    return { ...verdict, assessment, buffer, hash, url };
  };
  const pickCover = async (urls, book) => {
    for (const url of urls) {
      const c = await checkCover(url, book);
      if (c?.ok) return c;
      if (c) log(`cover passed over for ${book.title} (${c.reason}): ${url}`);
    }
    return null;
  };

  const candidates = [];
  for (const g of groups) {
    const c = mergeFacts(g, factsFor);
    const what = `${c.title} — ${c.authors[0] || "?"}`;
    if (!c.genres.length) skip("not fantasy or sci-fi", what);
    else if (c.children) skip("children's book", what);
    else if (c.releaseDate && (c.releaseDate < from || c.releaseDate > to)) skip("outside the release window", what);
    else candidates.push(c);
  }

  // Catalogue rows for every ISBN in one go.
  const allIsbns = [...new Set(candidates.flatMap((c) => c.isbns))];
  const byIsbn = new Map();
  for (let i = 0; i < allIsbns.length; i += 150) {
    const { data } = await supabase.from("books").select(BOOK_COLUMNS).in("isbn_13", allIsbns.slice(i, i + 150));
    for (const r of data || []) byIsbn.set(r.isbn_13, r);
  }

  const findExisting = async (c) => {
    const want = describeWork(c);
    const rows = c.isbns.map((i) => byIsbn.get(i)).filter(Boolean);
    const hit =
      rows.find((r) => sameWork(want, describeWork(r))) ||
      rows.find((r) => authorsOverlap(want.authors, describeWork(r).authors) && titlesCompatible(titleCore(r.title), want.core));
    if (hit) return hit;
    const words = c.title.replace(/[%_\\,()]/g, " ").split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
    if (!words) return null;
    const { data } = await supabase.from("books").select(BOOK_COLUMNS).ilike("title", `${words}%`).limit(25);
    const same = (data || []).filter((r) => sameWork(want, describeWork(r)));
    // Duplicates happen; use the most complete row.
    const completeness = (r) => (r.cover_url ? 2 : 0) + (r.description ? 1 : 0);
    return same.sort((a, b) => completeness(b) - completeness(a))[0] || null;
  };

  const items = [];
  const done = new Set();
  await inBatches(candidates, 3, async (c) => {
    if (Number.isFinite(budgetMs) && left() < 15000) return;
    const what = `${c.title} — ${c.authors[0] || "?"}`;
    try {
      const existing = await findExisting(c);
      // An older book in a new edition (a film tie-in, an anniversary
      // hardback): our own record says so, or Open Library's first edition does.
      const year = Number((c.releaseDate || today).slice(0, 4));
      // Every edition ISBNdb has of it: the earliest exact date is the book's
      // real debut (Alchemised was out in 2025; the shops list its 2026
      // paperback as new).
      let firstEdition = null;
      let editions = [];
      if (c.authors[0]) {
        const key = `work:${c.title.toLowerCase()}|${c.authors[0]}`;
        if (!cache.facts[key] || ageDays(cache.facts[key].fetchedAt, now) > 30) {
          const found = await isbndbEditions(c.title, c.authors[0], c.releaseDate);
          cache.facts[key] = { fetchedAt: new Date(now).toISOString(), ...found };
        }
        firstEdition = cache.facts[key].first || null;
        // Plain editions first: a deluxe edition's only picture is often a 3D
        // mock-up of its sprayed edges.
        editions = [...(cache.facts[key].editions || [])].sort(
          (a, b) => Number(cleanTitle(a.title).special) - Number(cleanTitle(b.title).special)
        );
      }
      let firstYear = existing?.published_date ? Number(existing.published_date.slice(0, 4)) : null;
      if (!firstYear && !firstEdition && c.authors[0]) {
        const key = `first:${describeWork(c).core}|${c.authors[0]}`;
        if (!cache.facts[key] || ageDays(cache.facts[key].fetchedAt, now) > 30) {
          try {
            cache.facts[key] = { fetchedAt: new Date(now).toISOString(), year: await firstPublishedYear(c.title, c.authors[0]) };
          } catch (e) {
            log(`open library search ${c.title}: ${e.message}`);
          }
        }
        firstYear = cache.facts[key]?.year || null;
      }
      // A special edition of a book from any earlier year is a reissue; for a
      // trade edition allow a year's slack (UK and US editions differ).
      const debut = earliest([c.firstKnown, firstEdition].filter(Boolean));
      const earlierEdition = debut && c.releaseDate && Date.parse(debut) < Date.parse(c.releaseDate) - 180 * DAY;
      if (earlierEdition || (firstYear && firstYear < (c.special ? year : year - 1))) {
        done.add(c);
        return skip("reissue of an older book", what);
      }
      // Only ever listed as a collector's or anniversary edition: a dressed-up
      // reissue (The Burning God, Once Upon a Broken Heart). Exclusive, signed
      // and deluxe first printings of new books are fine.
      if (c.special && c.listedAs.every((t) => /collector|anniversary/i.test(t))) {
        done.add(c);
        return skip("collector's edition of an older book", what);
      }

      // Another edition's blurb when the listed one has none (same book, same
      // publisher copy). Then what we have on file can fill gaps.
      const fromEditions = editions
        .map((e) => sanitiseDescription(e.description))
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0];
      const licensed = (c.description?.length || 0) >= MIN_DESCRIPTION ? c.description : fromEditions || c.description;
      const book = {
        ...c,
        description: (existing?.description?.length || 0) > (licensed?.length || 0) ? existing.description : licensed,
        isbn13: c.isbn13 || existing?.isbn_13 || null
      };
      const problems = bookProblems(book);

      // The cover: ours if it passes, otherwise the best licensed artwork for
      // this edition, then for another edition of the book.
      let cover = null;
      let clearOurs = false;
      if (existing?.cover_url) {
        const ours = await checkCover(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${existing.cover_url}`,
          book
        );
        if (ours?.ok) cover = { keep: true };
        else if (ours?.fatal) clearOurs = true;
      }
      if (!cover) {
        const urls = [...c.covers, ...editions.flatMap((e) => e.covers || [])];
        cover = await pickCover([...new Set(urls)], book);
      }
      if (!cover) problems.push("no finished cover");

      done.add(c);
      if (dryRun) {
        if (problems.length) return skip(problems.join(", "), what);
        items.push(toItem(existing || { id: null, title: book.title, authors: book.authors, cover_url: null }, c));
        return;
      }

      let row = existing;
      if (existing) {
        const patch = {};
        if (isPlaceholderTitle(existing.title) && !isPlaceholderTitle(book.title)) patch.title = book.title;
        // Rows this sync added itself follow its title cleaning as it improves.
        else if (existing.source === "retail" && book.title && existing.title !== book.title && !isPlaceholderTitle(book.title)) {
          patch.title = book.title;
        }
        if (!existing.authors?.length && book.authors.length) patch.authors = book.authors;
        if ((existing.description?.length || 0) < MIN_DESCRIPTION && book.description?.length >= MIN_DESCRIPTION) {
          patch.description = book.description;
        }
        if (!existing.isbn_13 && book.isbn13) patch.isbn_13 = book.isbn13;
        if (!existing.page_count && c.pages) patch.page_count = c.pages;
        // Shops are the authority on upcoming dates; older books are left be.
        if (c.releaseDate && existing.published_date !== c.releaseDate && (!existing.published_date || existing.published_date >= from)) {
          patch.published_date = c.releaseDate;
        }
        const have = (existing.genres || []).map((x) => x.toLowerCase());
        const terms = genreTerms(c).filter((t) => !have.includes(t));
        if (terms.length) patch.genres = [...(existing.genres || []), ...terms];
        if (cover && !cover.keep) {
          const file = await uploadCover(cover, `${book.isbn13 || existing.id}-${cover.hash.slice(0, 8)}`, supabase);
          if (file) {
            patch.cover_url = file;
            stats.coversFixed++;
          }
        } else if (!cover && clearOurs) {
          // A "cover to be revealed" image is worse than none.
          patch.cover_url = null;
          stats.coversCleared++;
        }
        const next = { ...existing, ...patch };
        const incomplete = !next.cover_url || (next.description?.length || 0) < MIN_DESCRIPTION || !next.isbn_13;
        if (incomplete !== existing.is_incomplete) patch.is_incomplete = incomplete;
        if (Object.keys(patch).length) {
          const { data, error } = await supabase.from("books").update(patch).eq("id", existing.id).select(BOOK_COLUMNS).single();
          if (error) throw error;
          row = data;
          stats.updated++;
        }
      }

      if (problems.length) return skip(problems.join(", "), what);

      if (!row) {
        const file = await uploadCover(cover, `${book.isbn13}-${cover.hash.slice(0, 8)}`, supabase);
        if (!file) return skip("cover upload failed", what);
        const { data, error } = await supabase
          .from("books")
          .insert({
            title: book.title,
            authors: book.authors,
            description: book.description,
            cover_url: file,
            genres: genreTerms(c),
            page_count: c.pages,
            published_date: c.releaseDate,
            isbn_13: book.isbn13,
            language: "en",
            source: "retail",
            bookshop_affiliate_link: getBookshopLink(book.isbn13) || null,
            is_incomplete: false,
            last_synced_at: new Date().toISOString()
          })
          .select(BOOK_COLUMNS)
          .single();
        if (error?.code === "23505") return skip("ISBN already belongs to another catalogue book", what);
        if (error) throw error;
        row = data;
        stats.added++;
        log(`added ${what} (${c.releaseDate})`);
      }
      items.push(toItem(row, c));
    } catch (e) {
      // Out of ISBNdb lookups: stop the run (the last list stays up).
      if (e instanceof IsbndbLimitError) throw e;
      stats.failed++;
      log(`failed ${what}: ${e.message}`);
    }
  });
  await closeCoverReader();

  // Out of time before reaching some books: keep last run's entries for them.
  const previous = await readJson(supabase, RELEASES_SNAPSHOT_PATH);
  const unreached = candidates.filter((c) => !done.has(c));
  if (unreached.length && previous?.version === 2) {
    const wanted = new Set(unreached.flatMap((c) => c.isbns));
    const carried = Object.values(previous.genres || {})
      .flat()
      .filter((x, i, a) => wanted.has(x.isbn13) && a.findIndex((y) => y.key === x.key) === i);
    items.push(...carried);
    log(`ran short of time: ${unreached.length} books not checked, ${carried.length} kept from the last run`);
  }

  // How many of our readers already have each one shelved.
  const ids = [...new Set(items.map((x) => x.bookId).filter(Boolean))];
  const readers = new Map();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from("user_books").select("book_id").in("book_id", ids.slice(i, i + 150));
    for (const r of data || []) readers.set(r.book_id, (readers.get(r.book_id) || 0) + 1);
  }

  const genres = {};
  for (const g of RELEASE_GENRES) {
    const seen = new Set();
    genres[g.slug] = items
      .filter((x) => x.genres.includes(g.slug) && !seen.has(x.key) && seen.add(x.key))
      .map((x) => ({ ...x, readers: readers.get(x.bookId) || 0 }))
      .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || b.score - a.score);
    log(`${g.label}: ${genres[g.slug].length} releases`);
  }

  const snapshot = {
    version: 2,
    generatedAt: new Date(now).toISOString(),
    recentDays: RECENT_DAYS,
    upcomingDays: UPCOMING_DAYS,
    sources: ["waterstones", "bookshop"],
    genres
  };
  const counts = Object.fromEntries(Object.entries(genres).map(([k, v]) => [k, v.length]));
  // The caches are worth keeping even from a dry run: they're what we read.
  await writeJson(supabase, RETAIL_CACHE_PATH, cache, "0");
  await writeJson(supabase, COVER_CHECKS_PATH, coverChecks, "0");
  if (dryRun) return { ...stats, dryRun: true, counts, snapshot };
  await writeJson(supabase, RELEASES_SNAPSHOT_PATH, snapshot);
  return { ...stats, counts };
}

function genreTerms(c) {
  const terms = RELEASE_GENRES.filter((g) => c.genres.includes(g.slug)).flatMap((g) => g.terms);
  return [...new Set([...terms, ...c.subgenres])].slice(0, 8);
}

function toItem(row, c) {
  return {
    key: row.id || c.isbn13,
    bookId: row.id,
    isbn13: c.isbn13,
    title: row.title,
    authors: row.authors,
    cover_url: row.cover_url,
    page_count: row.page_count || c.pages || null,
    releaseDate: c.releaseDate,
    series: c.series || null,
    picks: c.picks,
    score: c.score,
    genres: c.genres
  };
}
