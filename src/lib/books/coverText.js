// Reads the words on a cover to catch publisher placeholders: "COVER TO BE
// REVEALED", "Cover coming soon", "Artwork to follow". These are real-looking
// images (a mock-up jacket, the author's name in big type), so size and colour
// checks pass them; the text gives them away.
//
// Server only. One Tesseract worker is shared and kept warm for a sync run;
// call closeCoverReader() when done.
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const PLACEHOLDER_TEXT =
  // "be revealed" with the B misread ("3E REVEALED", "8E REVEALED"), and
  // "(c)over to be reveal(ed)" with its first letter lost on a page curl.
  // ISBNdb's generated text cards say "Note: This is not the actual book
  // cover"; a title page lists the publisher's cities ("New York · London ·
  // Toronto · Sydney"). A metadata card prints the record's edition tag in
// brackets ("ELDEST (LIMITED EDITION)"), which no real cover does; a
// large-print edition's cover isn't the one readers know.
  /\(\s*(?:limited|special|collector'?s|deluxe|signed|exclusive)\s+edition\s*\)|large\s*print\s*edition|cover\s*(?:to be|will be|being)?\s*reveal|(?:^|\s)\S?e\s*revealed\b|\bover\s*to\s*\S{1,2}\s*reveal|reveal(?:ed)?\s*soon|cover\s*(?:coming|to come|to follow|tb[ac]|tbd)|coming\s*soon|artwork\s*(?:to come|to follow|coming)|jacket\s*(?:to come|to follow|coming)|image\s*(?:coming|not available|unavailable)|no\s*image\s*available|placeholder|not\s*(?:the\s*)?final\s*cover|not\s*the\s*actual\s*(?:book\s*)?cover|new\s*york\W{1,4}london\W{1,4}toronto/i;

let workerPromise = null;

async function reader() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      // The language data is downloaded once and cached in the temp folder
      // (the only writable place on a serverless host).
      return createWorker("eng", 1, {
        cachePath: path.join(os.tmpdir(), "tesseract-cache"),
        logger: () => {},
        errorHandler: () => {}
      });
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

export async function closeCoverReader() {
  if (!workerPromise) return;
  const p = workerPromise;
  workerPromise = null;
  try {
    await (await p).terminate();
  } catch {
    // Already gone.
  }
}

/**
 * The words Tesseract can read on the cover, whitespace collapsed. Read as is
 * and inverted (Tesseract reads dark-on-light far better, and placeholder
 * notes are often light type on a dark jacket), whole and then the top and
 * bottom bands close up, where the small print goes ("FINAL COVER TO BE
 * REVEALED" on a page curl in the corner).
 */
export async function coverText(buffer) {
  const base = sharp(buffer).greyscale().normalise();
  const { width = 600, height = 900 } = await sharp(buffer).metadata();
  // Whole pixels, never past the edge (sharp refuses a crop that is).
  const band = (from, to) => {
    const top = Math.floor(height * from);
    return { left: 0, top, width, height: Math.max(1, Math.min(height, Math.ceil(height * to)) - top) };
  };
  const views = [
    base.clone().resize({ width: 600 }),
    base.clone().resize({ width: 1000 }).negate({ alpha: false }),
    base.clone().extract(band(0, 0.2)).resize({ width: 1400 }),
    base.clone().extract(band(0, 0.2)).resize({ width: 1400 }).negate({ alpha: false }),
    base.clone().extract(band(0.78, 1)).resize({ width: 1400 }),
    base.clone().extract(band(0.78, 1)).resize({ width: 1400 }).negate({ alpha: false })
  ];
  const worker = await reader();
  const texts = [];
  for (const view of views) {
    const { data } = await worker.recognize(await view.png().toBuffer());
    texts.push(String(data?.text || ""));
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

/** The placeholder phrase on the cover ("cover to be revealed"), or null. */
export function placeholderPhrase(text) {
  // OCR mistakes capitals for digits next to letters: "COVER T0 BE
  // REVEALED", "TO 8E REVEALED".
  const look = { 0: "o", 8: "b", 5: "s", 1: "l" };
  const words = String(text || "").replace(/(?<=[a-z])[0851]|[0851](?=[a-z])/gi, (d) => look[d]);
  return words.match(PLACEHOLDER_TEXT)?.[0] || null;
}
