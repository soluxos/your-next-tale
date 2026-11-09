// Decides whether an image is fit to be a book's cover before we save it.
//
// Book sources often answer with something that isn't a cover: a "no image"
// placeholder, a scanned title page, a two-page spread, a 1x1 pixel. Each
// candidate gets one of three tiers:
//   GOOD   use it
//   WEAK   usable, but only when nothing better turns up (very pale with
//          almost no colour, which is either a plain white cover or a scan;
//          or a small thumbnail)
//   REJECT never use it
import crypto from "crypto";
import sharp from "sharp";

export const COVER_REJECT = 0;
export const COVER_WEAK = 1;
export const COVER_GOOD = 2;

// Images sources serve in place of a missing cover.
const PLACEHOLDER_MD5 = new Set([
  "28a65b7f6e53a0453f1989a2ab50629e",
  "89fc817c2e7ea9388799f7ecbbbc9376" // ISBNdb "Book cover not available", 200x248
]);

const MIN_BYTES = 2000;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 150;
const SMALL_HEIGHT = 260;
// Covers are portrait. Wider than this is a spread or a box shot; narrower is
// a spine or a strip.
const MIN_RATIO = 0.45;
const MAX_RATIO = 0.9;

const FORMATS = {
  jpeg: { contentType: "image/jpeg", ext: ".jpg" },
  png: { contentType: "image/png", ext: ".png" },
  webp: { contentType: "image/webp", ext: ".webp" }
};

const reject = (reason, extra = {}) => ({ tier: COVER_REJECT, reason, ...extra });

/**
 * True for a picture of the book as an object: one plain background colour in
 * all four corners and round the whole edge, with a solid block (the book)
 * standing inside it. A flat cover runs to the edges; a pale minimal cover
 * has its type and art scattered over the background, not one solid block.
 */
export async function isProductShot(buffer) {
  const W = 96;
  const H = 144;
  const { data } = await sharp(buffer)
    .flatten({ background: "#ffffff" })
    .resize(W, H, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (x, y) => {
    const i = (y * W + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const diff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
  const corners = [at(1, 1), at(W - 2, 1), at(1, H - 2), at(W - 2, H - 2)];
  const bg = corners[0];
  // Product shots sit on white (or a transparent background we flattened to
  // white). A full-bleed black or orange cover is not one.
  if (Math.min(...bg) < 225 || corners.some((c) => diff(c, bg) > 24)) return false;
  const isBg = (x, y) => diff(at(x, y), bg) <= 30;

  // Most of the outer ring is background (the book or its shadow may touch an edge).
  let ring = 0;
  let ringBg = 0;
  for (let x = 0; x < W; x++)
    for (const y of [0, 1, H - 2, H - 1]) {
      ring++;
      if (isBg(x, y)) ringBg++;
    }
  for (let y = 2; y < H - 2; y++)
    for (const x of [0, 1, W - 2, W - 1]) {
      ring++;
      if (isBg(x, y)) ringBg++;
    }
  if (ringBg / ring < 0.75) return false;

  // The content's bounding box: inset from the sides, and mostly filled.
  let x0 = W;
  let x1 = -1;
  let y0 = H;
  let y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (!isBg(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return false;
  const boxW = x1 - x0 + 1;
  const boxH = y1 - y0 + 1;
  let filled = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!isBg(x, y)) filled++;
  if (filled / (boxW * boxH) <= 0.75 || boxW * boxH <= W * H * 0.25) return false;

  // Drawn in perspective: the book's box has background in at least two of
  // its corners. A flat cover with a white margin fills its box to the corners.
  const corner = (cx, cy, dx, dy) => {
    let n = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (isBg(cx + dx * i, cy + dy * j)) n++;
    return n / 16;
  };
  const open = [corner(x0, y0, 1, 1), corner(x1, y0, -1, 1), corner(x0, y1, 1, -1), corner(x1, y1, -1, -1)];
  return open.filter((v) => v >= 0.5).length >= 2;
}

export async function assessCover(buffer) {
  if (!buffer || buffer.length < MIN_BYTES) return reject("file too small");

  const md5 = crypto.createHash("md5").update(buffer).digest("hex");
  if (PLACEHOLDER_MD5.has(md5)) return reject("known placeholder image");

  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return reject("not an image");
  }
  const format = FORMATS[meta.format];
  if (!format) return reject(`unsupported format ${meta.format}`);

  const { width, height } = meta;
  if (!width || !height) return reject("no dimensions");
  const size = { width, height, ...format };
  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return reject(`too small (${width}x${height})`, size);
  }
  const ratio = width / height;
  if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
    return reject(`not cover-shaped (${ratio.toFixed(2)})`, size);
  }

  // Look at a small copy: how much of it is near-white, and how colourful is it.
  const { data, info } = await sharp(buffer)
    .resize(48, 72, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  let light = 0;
  let saturation = 0;
  const colours = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min > 215) light++;
    saturation += max ? (max - min) / max : 0;
    const bin = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    colours.set(bin, (colours.get(bin) || 0) + 1);
  }
  const stats = {
    ...size,
    md5,
    lightShare: +(light / pixels).toFixed(3),
    saturation: +(saturation / pixels).toFixed(3),
    // Share of the picture taken by its single most common colour.
    flatShare: +(Math.max(...colours.values()) / pixels).toFixed(3)
  };

  // A 3D product shot (a mock-up of the hardback with its sprayed edges) on a
  // plain background. Our shelves draw the book themselves; they need the
  // flat front.
  if (await isProductShot(buffer)) return reject("photo of the book, not the flat cover", stats);
  // A page that's nearly all white with no colour is a scan or a blank.
  if (stats.lightShare > 0.88 && stats.saturation < 0.06) {
    return reject("blank or scanned page", stats);
  }
  // Nearly one flat colour: a photo of a plain library binding, a blank.
  if (stats.flatShare > 0.93) {
    return reject("almost a single flat colour", stats);
  }
  if (stats.lightShare > 0.7 && stats.saturation < 0.12) {
    return { tier: COVER_WEAK, reason: "very pale, may be a scan", ...stats };
  }
  // Mostly one colour: a real minimal cover, or a "cover coming soon" card.
  if (stats.flatShare > 0.86) {
    return { tier: COVER_WEAK, reason: "mostly one flat colour", ...stats };
  }
  if (height < SMALL_HEIGHT) {
    return { tier: COVER_WEAK, reason: "small thumbnail", ...stats };
  }
  return { tier: COVER_GOOD, reason: null, ...stats };
}

export async function fetchCover(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Tries candidate URLs in order and returns the first GOOD cover, or failing
// that the first WEAK one. Never returns a rejected image.
// `trustFirst`: the first URL was picked by a person, so take it unless it's
// rejected outright.
export async function pickCover(urls, { trustFirst = false, log = () => {} } = {}) {
  let fallback = null;
  const seen = new Set();
  for (const [index, url] of urls.entries()) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const buffer = await fetchCover(url);
    if (!buffer) continue;
    const assessment = await assessCover(buffer);
    if (assessment.tier === COVER_REJECT) {
      log(`cover rejected (${assessment.reason}): ${url}`);
      continue;
    }
    const pick = { url, buffer, assessment };
    if (assessment.tier === COVER_GOOD || (trustFirst && index === 0)) return pick;
    log(`cover kept as fallback (${assessment.reason}): ${url}`);
    fallback ??= pick;
  }
  return fallback;
}
