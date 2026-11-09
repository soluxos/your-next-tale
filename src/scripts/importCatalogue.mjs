// Imports the fantasy and science fiction people read most into `books`
// (see src/lib/books/catalogueImport.js). Dry run unless --apply.
//
//   npm run import:catalogue                  dry run; chosen covers go to .catalogue-import/preview
//   npm run import:catalogue -- --apply       insert, keeping an undo log
//
// Options:
//   --sample N     try at most N works
//   --reserve N    ISBNdb allowance to leave for the site today (default 1500)
//   --budget N     spend at most N of ISBNdb's allowance this run
//   --undo-dir D   where the undo log goes (default .catalogue-import)
//   --fresh        ask Open Library again rather than use its cached answers
//
// Safe to run again, e.g. once a day after ISBNdb's allowance resets at
// midnight UTC: books the catalogue has and works already tried are skipped,
// and each run's books sit after the earlier runs' in Discover (most read
// first). Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and
// ISBNDB_API_KEY in .env.local.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  IMPORT_SLICES,
  catalogueIndex,
  importCandidates,
  lookUpCandidates
} from "@/lib/books/catalogueImport";
import { closeCoverReader } from "@/lib/books/coverText";

dotenv.config({ path: ".env.local", quiet: true });

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const apply = process.argv.includes("--apply");
const limit = Number(arg("sample", Infinity));
const reserve = Number(arg("reserve", 1500));
const budget = Number(arg("budget", Infinity));
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

// Open Library is slow at times and its answers barely change day to day;
// keeping them also keeps the candidates in the same order between runs.
const olDir = path.join(DIR, "ol-cache");
fs.mkdirSync(olDir, { recursive: true });
const fresh = process.argv.includes("--fresh");
async function fetchJson(u) {
  const f = path.join(olDir, `${crypto.createHash("md5").update(u).digest("hex")}.json`);
  if (!fresh && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(u, { headers: { "User-Agent": "YourNextTale-catalogue/1.0" }, signal: AbortSignal.timeout(240000) });
      if (res.ok) {
        const json = await res.json();
        fs.writeFileSync(f, JSON.stringify(json));
        return json;
      }
      log(`open library answered ${res.status}`);
    } catch (e) {
      log(`open library failed (${e.message})`);
    }
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  return null;
}

// Which works earlier runs tried, and the moment the first run ordered its
// books from. Only --apply runs change it.
const stateFile = path.join(DIR, "state.json");
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : { t0: null, tried: {} };
const t0 = state.t0 ? Date.parse(state.t0) : Date.now();
const saveState = () => apply && fs.writeFileSync(stateFile, JSON.stringify({ ...state, t0: new Date(t0).toISOString() }, null, 1));

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await admin.from("books").select("id,title,authors,isbn_13").range(from, from + 999);
  if (error) throw error;
  rows.push(...data);
  if (data.length < 1000) break;
}
const catalogue = catalogueIndex(rows);
log(`catalogue: ${rows.length} books; ${Object.keys(state.tried).length} works tried before`);

const candidates = (await importCandidates(IMPORT_SLICES, catalogue, { log, fetchJson })).filter((w) => !state.tried[w.key]);
log(`${candidates.length} works left to try`);

const previewDir = path.join(DIR, "preview");
if (!apply) {
  fs.rmSync(previewDir, { recursive: true, force: true });
  fs.mkdirSync(previewDir, { recursive: true });
}
const undoFile = path.join(undoDir, `catalogue-import-undo-${stamp}.jsonl`);
const skips = {};
const built = [];
let inserted = 0;
const count = (why) => (skips[why] = (skips[why] || 0) + 1);

let res = {};
try {
  res = await lookUpCandidates(candidates, {
    limit,
    log,
    reserve,
    budget,
    onBuilt: async (result, work) => {
      const who = `${work.title} — ${(work.author_name || [])[0] || "?"} (${work.readinglog_count})`;
      if (apply) {
        state.tried[work.key] = result.skip || "added";
        saveState();
      }
      if (result.skip) {
        count(result.skip);
        log(`  skip ${who}: ${result.skip}`);
        return;
      }
      if (catalogue.has({ title: result.row.title, author_name: result.row.authors, isbn: [result.row.isbn_13] })) {
        count("already added this run");
        return;
      }
      catalogue.add(result.row);
      built.push({ title: result.row.title, authors: result.row.authors, readers: result.readers, genres: result.row.genres, year: result.row.published_date, isbn: result.row.isbn_13 });
      if (!apply) {
        fs.writeFileSync(path.join(previewDir, `${String(work.rank).padStart(5, "0")}-${result.coverName}`), result.cover.buf);
        log(`  ok ${who} → ${result.row.isbn_13} [${result.row.genres.join(", ")}]`);
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
      // Discover lists newest first: a more read book gets a later time,
      // a second apart, all before the first run began.
      const created_at = new Date(t0 - work.rank * 1000).toISOString();
      const { data, error } = await admin
        .from("books")
        .insert({ ...result.row, cover_url: result.coverName, created_at, last_synced_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error) {
        count("insert refused");
        log(`  INSERT REFUSED ${who}: ${error.message}`);
        if (!up.error) await admin.storage.from("books").remove([result.coverName]);
        return;
      }
      inserted++;
      fs.mkdirSync(undoDir, { recursive: true });
      fs.appendFileSync(undoFile, JSON.stringify({ id: data.id, title: result.row.title, cover_url: result.coverName }) + "\n");
      log(`  added ${who} → ${data.id}`);
    }
  });
} catch (e) {
  log(`STOPPED: ${e.message}`);
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
  minutes: Math.round((Date.now() - stamp) / 6000) / 10
};
log(`SUMMARY ${JSON.stringify(summary)}`);
if (apply) log(`undo log: ${undoFile}`);
await closeCoverReader();
process.exit(0);
