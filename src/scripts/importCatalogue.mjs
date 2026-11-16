// Fills `books` with the fantasy and science fiction people are reading, and
// works out how popular every book in the catalogue is. Dry run unless --apply.
//
//   npm run import:catalogue                  dry run; covers, lists and candidates go to .catalogue-import/preview
//   npm run import:catalogue -- --apply       insert books (keeping an undo log) and publish the popularity files
//
// What to import comes from Open Library, Hardcover, Bookshop.org's lists and
// Seattle Public Library (src/lib/books/catalogueSources.js); the books
// themselves from ISBNdb (src/lib/books/catalogueImport.js); the ranking
// from src/lib/books/catalogueScores.js.
//
// Options:
//   --sample N     look up at most N works
//   --reserve N    ISBNdb allowance to leave for the site today (default 1500)
//   --budget N     spend at most N of ISBNdb's allowance this run
//   --readers N    covers checked at once (default 5)
//   --no-import    don't look anything up: just refresh the popularity files
//   --no-ranks     import only; leave the popularity files alone
//   --undo-dir D   where the undo log goes (default .catalogue-import)
//   --fresh        ask every source again rather than use its cached answers
//
// Safe to run again, e.g. once a day after ISBNdb's allowance resets at
// midnight UTC: books the catalogue has and works already tried are skipped,
// and the most sought-after of what's left go first. Needs
// NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and ISBNDB_API_KEY in
// .env.local; HARDCOVER_API_TOKEN too, or Hardcover is left out.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { RETRYABLE, catalogueIndex, lookUpCandidates, firstPublished } from "@/lib/books/catalogueImport";
import { gatherWorks, screenCandidate, interest, workSignals, combineSignals } from "@/lib/books/catalogueSources";
import { rankCatalogue, homeLists } from "@/lib/books/catalogueScores";
import { RANKS_PATH, HOME_LISTS_PATH, SIGNALS_PATH } from "@/lib/books/catalogueRanks";
import { hardcoverQuery } from "@/lib/books/sources/hardcover";
import { politeFetch } from "@/lib/releases/retailers/politeFetch";
import { setCoverReaders, closeCoverReader } from "@/lib/books/coverText";

dotenv.config({ path: ".env.local", quiet: true });

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const apply = flag("apply");
const noImport = flag("no-import");
const noRanks = flag("no-ranks");
const fresh = flag("fresh");
const limit = Number(arg("sample", Infinity));
const reserve = Number(arg("reserve", 1500));
const budget = Number(arg("budget", Infinity));
const readers = Math.max(1, Math.min(8, Number(arg("readers", 5)) || 5));
const DIR = path.resolve(".catalogue-import");
const undoDir = path.resolve(arg("undo-dir", DIR));
fs.mkdirSync(DIR, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !process.env.ISBNDB_API_KEY) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and ISBNDB_API_KEY in .env.local.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const stamp = Date.now();
const logFile = path.join(DIR, `${apply ? "apply" : "dry"}-${stamp}.log`);
const log = (s) => {
  fs.appendFileSync(logFile, s + "\n");
  if (!s.startsWith("  ")) console.log(s);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────── cached fetchers ───────────────────────────
// Every source's answers are kept for a while: they change slowly, a run
// that stops halfway shouldn't ask again, and the sites are spared.
const HOUR = 3600_000;
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
function cache(folder, maxAge) {
  const dir = path.join(DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  const file = (k) => path.join(dir, `${md5(k)}.json`);
  return {
    get(k) {
      const f = file(k);
      if (fresh || !fs.existsSync(f) || Date.now() - fs.statSync(f).mtimeMs > maxAge) return undefined;
      try {
        return JSON.parse(fs.readFileSync(f, "utf8"));
      } catch {
        return undefined;
      }
    },
    set(k, value) {
      fs.writeFileSync(file(k), JSON.stringify(value));
    }
  };
}

async function getJson(what, u, timeout) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(u, { headers: { "User-Agent": "YourNextTale-catalogue/1.0" }, signal: AbortSignal.timeout(timeout) });
      if (res.ok) return await res.json();
      log(`${what} answered ${res.status}`);
    } catch (e) {
      log(`${what} failed (${e.message})`);
    }
    await sleep(5000 * (attempt + 1));
  }
  return null;
}

// Open Library is slow at times and its counts barely move in a month;
// keeping them also keeps the works the same between runs.
const olCache = cache("ol-cache", 30 * 24 * HOUR);
async function fetchJson(u) {
  const had = olCache.get(u);
  if (had !== undefined) return had;
  const json = await getJson("open library", u, 240000);
  if (json) olCache.set(u, json);
  return json;
}

const seattleCache = cache("seattle-cache", 24 * HOUR);
async function fetchSeattle(u) {
  const had = seattleCache.get(u);
  if (had !== undefined) return had;
  const json = await getJson("seattle", u, 180000);
  if (Array.isArray(json)) seattleCache.set(u, json);
  return json;
}

// Hardcover allows 60 requests a minute; one at a time, with a gap.
const hcCache = cache("hc-cache", 24 * HOUR);
let hcLast = 0;
async function hardcover(query, variables) {
  const k = query + JSON.stringify(variables);
  const had = hcCache.get(k);
  if (had !== undefined) return had;
  for (let attempt = 0; ; attempt++) {
    const wait = hcLast + 1200 - Date.now();
    if (wait > 0) await sleep(wait);
    hcLast = Date.now();
    try {
      const data = await hardcoverQuery(query, variables);
      hcCache.set(k, data);
      return data;
    } catch (e) {
      if (attempt >= 2 || /not set/.test(e.message)) throw e;
      await sleep(/429/.test(e.message) ? 30000 : 4000 * (attempt + 1));
    }
  }
}

// Bookshop's list pages, through the polite fetcher (its allow-list and gaps).
const shopCache = cache("shop-cache", 12 * HOUR);
async function fetchPage(u) {
  const had = shopCache.get(u);
  if (had !== undefined) return had;
  const html = await politeFetch(u);
  if (html) shopCache.set(u, html);
  return html;
}

// ───────────────────────────── the catalogue ─────────────────────────────

// Which works earlier runs tried and how that went, under every name a
// source has for the work; `retried` marks the ones that have had their
// second go, or were first tried with a preferred edition and need none.
// Only --apply runs change it.
const stateFile = path.join(DIR, "state.json");
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : { tried: {} };
state.tried ||= {};
state.retried ||= {};
const saveState = () => apply && fs.writeFileSync(stateFile, JSON.stringify(state, null, 1));

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await admin
    .from("books")
    .select("id,title,authors,isbn_13,hardcover_id,genres,published_date,created_at,cover_url")
    .order("id")
    .range(from, from + 999);
  if (error) throw error;
  rows.push(...data);
  if (data.length < 1000) break;
}
const catalogue = catalogueIndex(rows);
log(`catalogue: ${rows.length} books; ${Object.keys(state.tried).length} works tried before`);

// ────────────────────────── sources → candidates ──────────────────────────

const now = new Date();
const year = now.getUTCFullYear();
const { works, checkouts } = await gatherWorks({ fetchJson, hardcover, fetchPage, fetchSeattle, log, now });

// What the sources say about each book, by book id.
const signals = {};
const note = (id, s) => {
  if (id != null) signals[id] = combineSignals(signals[id], s);
};

// A work an earlier run gave up on gets one more go if a source now says
// which edition readers use: that's usually what was missing.
const worthTrying = (work) => {
  const tried = work.keys.filter((k) => state.tried[k]);
  if (!tried.length) return true;
  if (!work.prefer?.length || tried.some((k) => state.retried[k])) return false;
  return tried.every((k) => RETRYABLE.test(state.tried[k]));
};

const candidates = [];
const passed = {};
let have = 0;
for (const work of works) {
  const hit = catalogue.find(work);
  if (hit) {
    have++;
    note(hit.id, workSignals(work));
    continue;
  }
  const why = screenCandidate(work, { year }) || (worthTrying(work) ? null : "tried before");
  if (why) {
    passed[why] = (passed[why] || 0) + 1;
    continue;
  }
  work.interest = interest(work, { year });
  candidates.push(work);
}
candidates.sort((a, b) => b.interest - a.interest || (a.key < b.key ? -1 : 1));
candidates.forEach((w, i) => (w.rank = i));

// Library checkouts of books no other source listed still count for the
// books the catalogue has.
let borrowed = 0;
for (const row of checkouts) {
  const hit = catalogue.find({ title: row.title, author_name: [row.creator], isbn: row.isbn });
  if (!hit) continue;
  borrowed++;
  note(hit.id, { spl: { checkouts: row.checkouts } });
}
log(
  `${works.length} works: the catalogue has ${have}; left out ${JSON.stringify(passed)}; ${candidates.length} to look up` +
    (borrowed ? `; ${borrowed} more catalogue books have library checkouts` : "")
);

const previewDir = path.join(DIR, "preview");
if (!apply) {
  fs.rmSync(previewDir, { recursive: true, force: true });
  fs.mkdirSync(previewDir, { recursive: true });
  const cell = (v) => String(v ?? "").replace(/\s+/g, " ");
  const line = (w) =>
    [
      w.rank,
      w.interest.toFixed(3),
      cell(w.title),
      cell((w.author_name || []).slice(0, 2).join(", ")),
      firstPublished(w).year || "",
      w.first_publish_year || "",
      w.hc?.releaseDate || w.hc?.year || "",
      w.hc?.users ?? "",
      w.ol?.readers ?? "",
      w.signals?.spl?.checkouts ?? "",
      cell((w.signals?.lists || []).map((l) => `${l.list} #${l.rank + 1}`).join("; ")),
      w.signals?.hcTrending?.month ? `#${w.signals.hcTrending.month.rank + 1}` : "",
      (w.prefer || []).map((p) => `${p.isbn}/${p.tier}`).join(" "),
      cell((w.altTitles || []).join(" | ")),
      w.keys.join(" ")
    ].join("\t");
  fs.writeFileSync(
    path.join(previewDir, "candidates.tsv"),
    ["rank\tinterest\ttitle\tauthors\tyear\tol year\thc date\thardcover\topen library\tcheckouts\tlists\ttrending\tprefer\talso titled\tkeys", ...candidates.map(line)].join("\n")
  );
}

// ─────────────────────────── ISBNdb → books ───────────────────────────

const undoFile = path.join(undoDir, `catalogue-import-undo-${stamp}.jsonl`);
const skips = {};
const built = [];
let inserted = 0;
let reached = 0;
let recorded = 0;
const count = (why) => (skips[why] = (skips[why] || 0) + 1);
const record = (work, outcome) => {
  if (!apply) return;
  for (const k of work.keys) {
    if (state.tried[k] || work.prefer?.length) state.retried[k] = true;
    state.tried[k] = outcome;
  }
  if (++recorded % 10 === 0) saveState();
};

let res = {};
if (!noImport && candidates.length) {
  await setCoverReaders(readers);
  try {
    res = await lookUpCandidates(candidates, {
      limit,
      log,
      reserve,
      budget,
      parallel: readers,
      onBuilt: async (result, work) => {
        const known = [
          work.hc && `hardcover ${work.hc.users}`,
          work.ol && `open library ${work.ol.readers}`,
          work.signals?.lists?.length && `${work.signals.lists.length} list${work.signals.lists.length > 1 ? "s" : ""}`
        ].filter(Boolean);
        const who = `${work.title} — ${(work.author_name || [])[0] || "?"} (${known.join(", ")})`;
        reached++;
        if (result.skip) {
          count(result.skip);
          log(`  skip ${who}: ${result.skip}`);
          if (!result.transient) record(work, result.skip);
          return;
        }
        const { row } = result;
        const dupe = catalogue.find({ title: row.title, author_name: row.authors, isbn: [row.isbn_13] });
        if (dupe) {
          count("already in the catalogue");
          note(dupe.id, workSignals(work));
          record(work, "already in the catalogue");
          return;
        }
        const extra = { cover_url: result.coverName, hardcover_id: work.hc ? String(work.hc.id) : null };
        if (!apply) {
          const id = `dry-${built.length}`;
          fs.writeFileSync(path.join(previewDir, `${String(work.rank).padStart(5, "0")}-${result.coverName}`), result.cover.buf);
          catalogue.add({ ...row, ...extra, id });
          rows.push({ ...row, ...extra, id, created_at: new Date().toISOString() });
          note(id, workSignals(work));
          built.push({ title: row.title, isbn: row.isbn_13 });
          log(`  ok ${row.title} — ${row.authors.join(", ")} (${known.join(", ")}) → ${row.isbn_13} ${row.published_date} [${row.genres.join(", ")}]`);
          return;
        }
        const up = await admin.storage
          .from("books")
          .upload(result.coverName, result.cover.buf, { contentType: result.cover.a.contentType, upsert: false });
        if (up.error && !/exists/i.test(up.error.message)) {
          count("cover upload failed");
          log(`  UPLOAD FAILED ${who}: ${up.error.message}`);
          return;
        }
        const created_at = new Date().toISOString();
        const { data, error } = await admin
          .from("books")
          .insert({ ...row, ...extra, created_at, last_synced_at: created_at })
          .select("id")
          .single();
        if (error) {
          count("insert refused");
          log(`  INSERT REFUSED ${who}: ${error.message}`);
          if (!up.error) await admin.storage.from("books").remove([result.coverName]);
          record(work, "insert refused");
          return;
        }
        inserted++;
        fs.mkdirSync(undoDir, { recursive: true });
        fs.appendFileSync(undoFile, JSON.stringify({ id: data.id, title: row.title, cover_url: result.coverName }) + "\n");
        catalogue.add({ ...row, ...extra, id: data.id });
        rows.push({ ...row, ...extra, id: data.id, created_at });
        note(data.id, workSignals(work));
        built.push({ title: row.title, isbn: row.isbn_13 });
        record(work, "added");
        log(`  added ${who} → ${data.id}`);
      }
    });
  } catch (e) {
    log(`STOPPED: ${e.message}`);
  }
  saveState();
}

// ─────────────────────────── popularity files ───────────────────────────

if (!noRanks) {
  // A source that was down this run shouldn't wipe what it said last time:
  // reader counts carry over. What's trending or selling is only ever now.
  let before = {};
  try {
    const { data } = await admin.storage.from("books").download(SIGNALS_PATH);
    if (data) before = JSON.parse(await data.text()).books || {};
  } catch {
    // first run: nothing to carry over
  }
  const ids = new Set(rows.map((r) => String(r.id)));
  for (const [id, old] of Object.entries(before)) {
    if (!ids.has(id) || (!old.ol && !old.hc)) continue;
    const s = (signals[id] ||= {});
    if (!s.ol && old.ol) s.ol = old.ol;
    if (!s.hc && old.hc) s.hc = old.hc;
  }

  const at = new Date();
  const { entries, ranks } = rankCatalogue(rows, signals, { now: at });
  const home = homeLists(entries, { now: at });
  const known = entries.filter((e) => e.score != null).length;
  log(`ranked ${entries.length} fantasy and science fiction books; ${known} have popularity data`);

  const title = new Map(rows.map((r) => [r.id, `${r.title} — ${(r.authors || [])[0] || "?"}`]));
  const show = (name, ids) => {
    log(`${name} (${ids.length})`);
    for (const id of ids.slice(0, 15)) log(`  ${title.get(id)}`);
  };
  show("popular", ranks.order);
  for (const [name, ids] of Object.entries(home.lists)) show(name, ids);

  const files = [
    [SIGNALS_PATH, { generatedAt: at.toISOString(), books: signals }],
    [RANKS_PATH, ranks],
    [HOME_LISTS_PATH, home]
  ];
  for (const [file, value] of files) {
    if (!apply) {
      fs.writeFileSync(path.join(previewDir, path.basename(file)), JSON.stringify(value, null, 1));
      continue;
    }
    const { error } = await admin.storage
      .from("books")
      .upload(file, JSON.stringify(value), { contentType: "application/json", cacheControl: "300", upsert: true });
    log(error ? `COULD NOT WRITE ${file}: ${error.message}` : `wrote ${file}`);
  }
}

const summary = {
  apply,
  inserted,
  built: built.length,
  skips,
  isbndbCalls: res.calls || 0,
  isbndbUsed: res.units || 0,
  perBook: built.length ? Math.round(((res.units || 0) / built.length) * 10) / 10 : null,
  stoppedBecause: res.stopped || null,
  leftToday: res.left?.remaining ?? null,
  resets: res.left?.resetsAt ?? null,
  notReached: Math.max(0, candidates.length - reached),
  minutes: Math.round((Date.now() - stamp) / 6000) / 10
};
log(`SUMMARY ${JSON.stringify(summary)}`);
if (apply && inserted) log(`undo log: ${undoFile}`);
await closeCoverReader();
process.exit(0);
