// Reads the words on a cover to catch publisher placeholders: "COVER TO BE
// REVEALED", "Cover coming soon", "Artwork to follow", "Untitled · Author to
// be confirmed · Cover to be unveiled". These are real-looking
// images (a mock-up jacket, the author's name in big type), so size and colour
// checks pass them; the text gives them away. The same reading tells us when
// the big type on a cover names a different book.
//
// Server only. Tesseract workers are kept warm for a sync run: one unless
// setCoverReaders() asks for more (a bulk import reads several covers at
// once). Call closeCoverReader() when done.
import os from "node:os";
import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";

const PLACEHOLDER_TEXT =
  // "be revealed" with the B misread ("3E REVEALED", "8E REVEALED"), and
  // "(c)over to be reveal(ed)" with its first letter lost on a page curl.
  // ISBNdb's generated text cards say "Note: This is not the actual book
  // cover"; a title page lists the publisher's cities ("New York · London ·
  // Toronto · Sydney"). A metadata card prints the record's edition tag in
// brackets ("ELDEST (LIMITED EDITION)"), which no real cover does; a
// large-print edition's cover isn't the one readers know. A scan of a library's
// copy has its barcode sticker on it ("RICHMOND PUBLIC LIBRARY"), or just the
// number under the barcode (LIBRARY_BARCODE).
  // A proof jacket carries a flash ("COVER NOT FINAL") and its date ("ON SALE
  // MARCH 2026"); a retailer's promotion has its sticker ("FOR A LIMITED TIME",
  // "SPECIAL PRICE: $4.99"); a page from a retailer's preview is stamped
  // "Copyrighted Material".
  /\(\s*(?:limited|special|collector'?s|deluxe|signed|exclusive)\s+edition\s*\)|large\s*print\s*edition|cover\s*(?:to be|will be|being)?\s*(?:reveal|unveil)|to\s*be\s*(?:unveiled|confirmed|announced)|\buntitled\b|(?:^|\s)\S?e\s*revealed\b|\bover\s*to\s*\S{1,2}\s*reveal|reveal(?:ed)?\s*soon|cover\s*(?:coming|to come|to follow|tb[ac]|tbd)|coming\s*soon|artwork\s*(?:to come|to follow|coming)|jacket\s*(?:to come|to follow|coming)|image\s*(?:coming|not available|unavailable)|no\s*image\s*available|placeholder|not\s*(?:the\s*)?final\s*cover|cover\s*not\s*final|on\s*sale\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|not\s*the\s*actual\s*(?:book\s*)?cover|for\s*a\s*limited\s*time|special\s*price|copyrighted\s*material|new\s*york\W{1,4}london\W{1,4}toronto|public\s*library/i;

// The pool lives on globalThis. A script run through tsx can end up with two
// copies of this module (one imported, one required, depending on which file
// loads it first), and the copy that was told how many readers to use has to
// be the one that hands them out: otherwise every cover queues for one worker.
const pool = (globalThis[Symbol.for("yournexttale.coverReaders")] ||= {
  readers: 1,
  started: [], // promises of every worker created
  idle: [],
  waiting: [], // { resolve, reject } of each caller queueing for a worker
  owners: new Map(), // worker → its promise in `started`
  reads: new Map() // worker → how many images it has read
});
// A pool left by an older copy of this module (a hot reload in dev) has neither.
pool.owners ||= new Map();
pool.reads ||= new Map();

// tesseract.js never forgets a finished job: everything a worker has read
// stays in memory until the worker is gone, about 5 MB a cover when every
// reading returns word boxes, hOCR and TSV. A bulk import ran out of memory
// after 800 books. So each reading asks only for what it uses, and a worker
// is retired after this many readings (some forty covers) for a fresh one.
const READS_PER_WORKER = 1500;
const TEXT_ONLY = { text: true, blocks: false, hocr: false, tsv: false };
const WITH_WORDS = { text: true, blocks: true, hocr: false, tsv: false };

/** How many covers may be read at once (each takes a worker thread). */
export function setCoverReaders(n) {
  pool.readers = Math.max(1, Math.min(8, Math.floor(n) || 1));
}

async function createReader() {
  const { createWorker } = await import("tesseract.js");
  // The language data is downloaded once and cached in the temp folder
  // (the only writable place on a serverless host).
  return createWorker("eng", 1, {
    cachePath: path.join(os.tmpdir(), "tesseract-cache"),
    logger: () => {},
    errorHandler: () => {}
  });
}

// A worker for one cover: an idle one, a new one while there's room, else
// the next to be handed back.
async function borrowReader() {
  if (pool.idle.length) return pool.idle.pop();
  if (pool.started.length < pool.readers) {
    const p = createReader();
    pool.started.push(p);
    try {
      const worker = await p;
      pool.owners.set(worker, p);
      return worker;
    } catch (e) {
      pool.started.splice(pool.started.indexOf(p), 1);
      throw e;
    }
  }
  return new Promise((resolve, reject) => pool.waiting.push({ resolve, reject }));
}

// Hands the worker back after `reads` readings: to the next caller in the
// queue, or to the idle pile. One that has read its fill is shut down, and
// the next caller gets a new one.
function returnReader(worker, reads = 0) {
  const total = (pool.reads.get(worker) || 0) + reads;
  const next = pool.waiting.shift();
  if (total >= READS_PER_WORKER) {
    const at = pool.started.indexOf(pool.owners.get(worker));
    if (at >= 0) pool.started.splice(at, 1);
    pool.owners.delete(worker);
    pool.reads.delete(worker);
    Promise.resolve()
      .then(() => worker.terminate())
      .catch(() => {});
    if (next) borrowReader().then(next.resolve, next.reject);
    return;
  }
  pool.reads.set(worker, total);
  if (next) next.resolve(worker);
  else pool.idle.push(worker);
}

export async function closeCoverReader() {
  const all = pool.started.splice(0);
  pool.idle.length = 0;
  pool.owners.clear();
  pool.reads.clear();
  for (const p of all) {
    try {
      await (await p).terminate();
    } catch {
      // Already gone.
    }
  }
}

// How sure Tesseract has to be of a word (out of 100) for it to count as read.
const SURE = 85;

/**
 * Reads the cover → { text, display }.
 *
 * `text`: every word Tesseract can make out, whitespace collapsed. The cover
 * is read as is and inverted (Tesseract reads dark-on-light far better, and
 * placeholder notes are often light type on a dark jacket), whole and then
 * the top and bottom bands close up, where the small print goes ("FINAL COVER
 * TO BE REVEALED" on a page curl in the corner), and the band above the
 * bottom one. Then each corner turned level, and the whole cover tilted, for
 * a flash or a ribbon across a corner.
 *
 * `display`: the words of the big type (the title and the author's name),
 * lower case, only those read with confidence. Tesseract reads letters best
 * at 20 to 40 pixels tall, so these come from thumbnails, where nothing
 * smaller is legible.
 *
 * The reading stops at the first placeholder phrase (`display` is then
 * empty): nothing else about that image matters. A cover is read once per
 * run: editions share an image, and one publisher's "cover to be revealed"
 * card stands in for many books.
 */
export function readCover(buffer) {
  const key = crypto.createHash("md5").update(buffer).digest("hex");
  let reading = seen.get(key);
  if (!reading) {
    reading = readViews(buffer);
    // A failed read isn't kept, so the next ask tries again.
    reading.catch(() => seen.delete(key));
    if (seen.size >= SEEN_MAX) seen.delete(seen.keys().next().value);
    seen.set(key, reading);
  }
  return reading;
}

const seen = new Map(); // md5 of the image → promise of its reading
const SEEN_MAX = 5000;

async function readViews(buffer) {
  const base = sharp(buffer).greyscale().normalise();
  const { width = 600, height = 900, channels = 3 } = await sharp(buffer).metadata();
  // Whole pixels, never past the edge (sharp refuses a crop that is).
  const band = (from, to) => {
    const top = Math.floor(height * from);
    return { left: 0, top, width, height: Math.max(1, Math.min(height, Math.ceil(height * to)) - top) };
  };
  const straight = [
    base.clone().resize({ width: 600 }),
    base.clone().resize({ width: 1000 }).negate({ alpha: false }),
    base.clone().extract(band(0, 0.2)).resize({ width: 1400 }),
    base.clone().extract(band(0, 0.2)).resize({ width: 1400 }).negate({ alpha: false }),
    base.clone().extract(band(0.78, 1)).resize({ width: 1400 }),
    base.clone().extract(band(0.78, 1)).resize({ width: 1400 }).negate({ alpha: false }),
    // A text-only card puts its note under the title and author, across the
    // line where the bottom band starts.
    base.clone().extract(band(0.6, 0.86)).resize({ width: 1400 }),
    base.clone().extract(band(0.6, 0.86)).resize({ width: 1400 }).negate({ alpha: false }),
    // A banner across the cover ("FINAL COVER TO COME") can sit anywhere
    // between the two; read whole, its line gets lost among the artwork.
    base.clone().extract(band(0.14, 0.42)).resize({ width: 1400 }),
    base.clone().extract(band(0.14, 0.42)).resize({ width: 1400 }).negate({ alpha: false }),
    base.clone().extract(band(0.36, 0.64)).resize({ width: 1400 }),
    base.clone().extract(band(0.36, 0.64)).resize({ width: 1400 }).negate({ alpha: false })
  ];
  const thumbnails = [160, 300].flatMap((w) => [
    base.clone().resize({ width: w }),
    base.clone().resize({ width: w }).negate({ alpha: false })
  ]);
  // A "COVER TO BE REVEALED" ribbon runs across a corner at anything from 15
  // to 45 degrees, and Tesseract copes with about six degrees of tilt. Gold
  // or red type on a white ribbon is nearly as light as the ribbon in grey;
  // the blue channel tells them apart.
  const sources = [base];
  if (channels >= 3) sources.push(sharp(buffer).flatten({ background: "#ffffff" }).extractChannel("blue").normalise());
  const tilted = [16, 28, 45, -16, -28, -45].flatMap((angle) =>
    sources.map((source) => source.clone().resize({ width: 600 }).rotate(angle, { background: "#808080" }))
  );
  // A flash across one corner ("Cover to be revealed" on a white triangle) is
  // too small to read at that size: each corner on its own, turned level and
  // enlarged.
  const side = Math.max(1, Math.min(height, Math.round(width * 0.5)));
  const corner = async (source, left, top, angle) =>
    sharp(await source.clone().extract({ left, top, width: side, height: side }).png().toBuffer())
      .resize({ width: 700 })
      .rotate(angle, { background: "#808080" });
  const corners = await Promise.all([
    ...sources.flatMap((source) => [corner(source, width - side, 0, -45), corner(source, 0, 0, 45)]),
    corner(base, width - side, height - side, 45),
    corner(base, 0, height - side, -45)
  ]);

  const worker = await borrowReader();
  const texts = [];
  const display = new Set();
  let reads = 0;
  try {
    for (const view of [...straight, ...corners, ...tilted]) {
      reads++;
      const { data } = await worker.recognize(await view.png().toBuffer(), {}, TEXT_ONLY);
      texts.push(String(data?.text || ""));
      if (placeholderPhrase(texts.join(" "))) return { text: texts.join(" ").replace(/\s+/g, " ").trim(), display: [] };
    }
    for (const view of thumbnails) {
      reads++;
      const { data } = await worker.recognize(await view.png().toBuffer(), {}, WITH_WORDS);
      texts.push(String(data?.text || ""));
      for (const word of data?.words || []) {
        const letters = String(word.text || "").toLowerCase().replace(/[^a-z]/g, "");
        if (word.confidence >= SURE && letters.length >= 4) display.add(letters);
      }
    }
  } finally {
    returnReader(worker, reads);
  }
  return { text: texts.join(" ").replace(/\s+/g, " ").trim(), display: [...display] };
}

/** The words Tesseract can read on the cover (see readCover). */
export async function coverText(buffer) {
  return (await readCover(buffer)).text;
}

// The number under a library's barcode sticker: fourteen digits starting
// with 3, in up to four groups ("3 1111 04029 8760"), give or take a digit
// the reader drops or doubles. Nothing printed on a front cover looks like it
// (an ISBN starts with 97; a ruler or a calendar is many short numbers).
const LIBRARY_BARCODE = /(?<![\d.,])(?<!\d\s)3(?:\s?\d){12,14}(?![\d.,])(?!\s\d)/g;
const libraryBarcode = (text) => text.match(LIBRARY_BARCODE)?.find((n) => n.split(/\s/).length <= 4) || null;

/** The placeholder phrase on the cover ("cover to be revealed"), or null. */
export function placeholderPhrase(text) {
  // OCR mistakes capitals for digits next to letters: "COVER T0 BE
  // REVEALED", "TO 8E REVEALED".
  const look = { 0: "o", 8: "b", 5: "s", 1: "l" };
  const raw = String(text || "");
  const words = raw.replace(/(?<=[a-z])[0851]|[0851](?=[a-z])/gi, (d) => look[d]);
  return words.match(PLACEHOLDER_TEXT)?.[0] || libraryBarcode(raw) || null;
}
