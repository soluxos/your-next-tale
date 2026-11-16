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
 * all four corners, with a solid block (the book) standing inside it or
 * cropped so close it touches the sides. A flat cover runs to the edges; a pale minimal cover
 * has its type and art scattered over the background, not one solid block.
 * Also true for a copy lying on a plain surface of any colour (onPlainGround).
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
  if (onPlainGround(at, W, H)) return true;
  const corners = [at(1, 1), at(W - 2, 1), at(1, H - 2), at(W - 2, H - 2)];
  // Product shots sit on white (or a transparent background we flattened to
  // white). A full-bleed black or orange cover is not one. The book itself
  // may reach into one corner of a tight crop.
  const white = corners.filter((c) => Math.min(...c) >= 225);
  const bg = white.find((c) => white.filter((other) => diff(c, other) <= 24).length >= 3);
  if (!bg) return false;
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
  const framed = ringBg / ring >= 0.75;

  // The content's bounding box, and how much of it is filled.
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
  const fill = filled / (boxW * boxH);
  if (boxW * boxH <= W * H * 0.25) return false;

  // Which way a side of the outline slants: 1 or -1, or 0 when it doesn't.
  const slant = (bgAt) => {
    // How far the background reaches in, at each point along the middle of the side.
    const depth = [];
    for (let x = 6; x < W - 6; x++) {
      let d = 0;
      while (d < 30 && bgAt(x, d)) d++;
      depth.push(d);
    }
    // The longest stretch over which the edge keeps heading one way (a step
    // back of one pixel is noise) and gets somewhere: a slope, so still
    // changing between its quarter points, not one step at an end. The front
    // of a book in perspective slants across most of the picture; its page
    // block may slant back the other way.
    const run = (sign) => {
      let best = 0;
      for (let i = 0; i < depth.length; i++) {
        let low = sign * depth[i];
        let j = i;
        while (j + 1 < depth.length && sign * depth[j + 1] <= low + 1) {
          j++;
          low = Math.min(low, sign * depth[j]);
        }
        const quarter = Math.floor((j - i) / 4);
        const sloped = sign * (depth[i + quarter] - depth[j - quarter]) >= 2;
        if (sign * depth[i] - low >= 4 && sloped) best = Math.max(best, j - i + 1);
      }
      return best;
    };
    const down = run(1);
    const up = run(-1);
    if (Math.max(down, up) < depth.length * 0.6) return 0;
    return down >= up ? 1 : -1;
  };
  const top = slant((x, d) => isBg(x, d));
  const bottom = slant((x, d) => isBg(x, H - 1 - d));

  // Which way a side of the content's box runs when it is one straight slope
  // from end to end (a line fits it): 1 or -1, else 0.
  const straight = (bgAt) => {
    // Columns where the side is found; a shadow widens the box past the book.
    const depth = [];
    for (let x = x0 + 3; x <= x1 - 3; x++) {
      let d = 0;
      while (d < 40 && bgAt(x, d)) d++;
      if (d < 40) depth.push(d);
    }
    if (depth.length < Math.max(20, boxW * 0.6)) return 0;
    const { rise, fit } = fitLine(depth);
    if (Math.abs(rise) >= 4 && fit >= 0.8) return Math.sign(rise);
    // A white jacket lets the background in here and there, and the page
    // block turns the outline back at one end: most of the side still lies
    // along one line.
    const main = mainLine(depth);
    return Math.abs(main.rise) >= 4 && main.share >= 0.7 ? Math.sign(main.rise) : 0;
  };
  // Whether a side of the box is one steep, clean slope nearly all the way along.
  const steep = (bgAt) => {
    const depth = [];
    for (let x = x0 + 3; x <= x1 - 3; x++) {
      let d = 0;
      while (d < 40 && bgAt(x, d)) d++;
      if (d < 40) depth.push(d);
    }
    if (depth.length < Math.max(20, boxW * 0.8)) return false;
    // The page block turns the last of it back, so the fit is never perfect.
    const { rise, fit } = fitLine(depth);
    return Math.abs(rise) >= 6 && fit >= 0.85;
  };
  // Whether an upright side of the box is a straight edge standing clear of
  // the picture's: the background is the same depth (give or take a pixel)
  // most of the way down.
  const upright = (bgAt) => {
    const depth = [];
    for (let y = y0 + 3; y <= y1 - 3; y++) {
      let d = 0;
      while (d < 40 && bgAt(y, d)) d++;
      depth.push(d);
    }
    if (depth.length < 20) return false;
    const middle = [...depth].sort((a, b) => a - b)[Math.floor(depth.length / 2)];
    return middle >= 3 && middle < 40 && depth.filter((d) => Math.abs(d - middle) <= 1).length >= depth.length * 0.7;
  };
  // A white jacket photographed on white fills little of its box, but the
  // outline still tells: the top and bottom edges both run away to the same
  // side, as they do in perspective. (A scan that went in crooked has them
  // running opposite ways; an ornamental border curves at both ends.)
  if (framed) {
    const above = straight((x, d) => isBg(x, d));
    const below = straight((x, d) => isBg(x, H - 1 - d));
    if (above !== 0 && above === below) return true;
    // A render seen square on from a little above or below: only one of the
    // two runs away, steeply and dead straight, and the book's upright sides
    // stay upright. (A crooked scan tilts all four; then they run opposite
    // ways.)
    if (above !== -below) {
      const lone = steep((x, d) => isBg(x, d)) !== steep((x, d) => isBg(x, H - 1 - d));
      if (lone && (upright((y, d) => isBg(d, y)) || upright((y, d) => isBg(W - 1 - d, y)))) return true;
    }
  }
  if (fill <= 0.75) return false;

  // Drawn in perspective: the book's box has background in its corners, where
  // the edges slant away. A flat cover fills its box to the corners.
  const corner = (cx, cy, dx, dy) => {
    let n = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (isBg(cx + dx * i, cy + dy * j)) n++;
    return n / 16;
  };
  const open = [corner(x0, y0, 1, 1), corner(x1, y0, -1, 1), corner(x0, y1, 1, -1), corner(x1, y1, -1, -1)];
  const bare = open.filter((v) => v >= 0.5).length;
  // Standing in its background, two bare corners say so.
  if (framed) return bare >= 2;

  // Cropped until the book touches every side (the usual shot of a hardback
  // with sprayed edges), only wedges of background are left: bare corners (all
  // but perhaps the one the page block reaches), a solid block between them,
  // and a top or bottom edge that slants. A flat cover scanned with a white
  // margin has bare corners too, but its margin is the same depth all the way
  // along.
  if (fill <= 0.8) return false;
  if (bare >= 3 && (top !== 0 || bottom !== 0)) return true;
  // The same shot with the cover's far corners still in the picture: the two
  // near ones are bare, and the outline between them is a V, the cover's
  // edge running down to the corner nearest the camera and the page block's
  // running back up from it.
  const chevron = (bgAt) => {
    const depth = [];
    for (let x = 6; x < W - 6; x++) {
      let d = 0;
      while (d < 30 && bgAt(x, d)) d++;
      depth.push(d);
    }
    const low = Math.min(...depth);
    if (low > 1) return false;
    const point = Math.round((depth.indexOf(low) + depth.lastIndexOf(low)) / 2);
    const arms = [depth.slice(0, point + 1).reverse(), depth.slice(point)];
    const [long, short] = arms[0].length >= arms[1].length ? arms : [arms[1], arms[0]];
    if (long.length < depth.length * 0.55 || short.length < 6) return false;
    const a = fitLine(long);
    const b = fitLine(short);
    return a.rise >= 4 && a.fit >= 0.85 && b.rise >= 3 && b.fit >= 0.8;
  };
  if (open[2] >= 0.5 && open[3] >= 0.5 && chevron((x, d) => isBg(x, H - 1 - d))) return true;
  return open[0] >= 0.5 && open[1] >= 0.5 && chevron((x, d) => isBg(x, d));
}

// The straight line through a run of values: how far it climbs from the first
// to the last, and how well it fits (r²).
function fitLine(values) {
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanV = values.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxv = 0;
  let svv = 0;
  values.forEach((v, i) => {
    sxx += (i - meanX) ** 2;
    sxv += (i - meanX) * (v - meanV);
    svv += (v - meanV) ** 2;
  });
  if (!sxx || !svv) return { rise: 0, fit: 0 };
  return { rise: (sxv / sxx) * (n - 1), fit: (sxv * sxv) / (sxx * svv) };
}

// The line most of a run of depths lies along (to within one): how far it
// climbs from the first to the last, and the share of the depths on it.
// Depths well past the line don't count against it, as long as half are on
// it: those are gaps, where the background's colour carries on into the book.
function mainLine(values) {
  const n = values.length;
  const step = Math.max(1, Math.floor(n / 24));
  let best = { count: 0, rise: 0, share: 0 };
  for (let i = 0; i < n; i += step)
    for (let j = i + Math.floor(n / 3); j < n; j += step) {
      const slope = (values[j] - values[i]) / (j - i);
      let count = 0;
      let gaps = 0;
      for (let k = 0; k < n; k++) {
        const off = values[k] - (values[i] + slope * (k - i));
        if (Math.abs(off) <= 1) count++;
        else if (off > 3) gaps++;
      }
      if (count > best.count) best = { count, rise: slope * (n - 1), share: count >= n / 2 ? count / (n - gaps) : count / n };
    }
  return best;
}

// A copy photographed or scanned lying on a plain surface: a dull margin all
// the way round, unevenly lit (a printed border is one flat colour), and
// inside it the four straight edges of the book.
function onPlainGround(at, W, H) {
  const diff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
  const ring = [];
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) ring.push(at(x, y));
  for (let y = 2; y < H - 2; y++) for (const x of [0, 1, W - 2, W - 1]) ring.push(at(x, y));
  if (ring.filter((c) => Math.max(...c) - Math.min(...c) <= 24).length < ring.length * 0.9) return false;
  const light = ring.map((c) => (c[0] + c[1] + c[2]) / 3).sort((a, b) => a - b);
  const dim = light[Math.floor(light.length * 0.1)];
  const uneven = light[Math.floor(light.length * 0.9)] - dim;
  if (uneven < 12) return false;
  // How far in the margin runs along the middle of a side; whether it is that
  // deep (give or take a pixel) nearly all the way along; and how often the
  // margin's colour is back just inside the edge. A rule printed round a
  // cover has the cover's ground on both sides of it; past a book's edge
  // there is the book.
  const side = (length, pixel) => {
    const from = Math.round(length * 0.12);
    const depth = [];
    for (let i = from; i < length * 0.88; i++) {
      const ground = pixel(i, 0);
      let d = 1;
      while (d < 40 && diff(pixel(i, d), ground) <= 24) d++;
      depth.push(d);
    }
    const middle = [...depth].sort((a, b) => a - b)[Math.floor(depth.length / 2)];
    if (middle < 3 || middle >= 40) return null;
    if (depth.filter((d) => Math.abs(d - middle) <= 1).length < depth.length * 0.7) return null;
    const back = depth.filter((_, n) => {
      const ground = pixel(from + n, 0);
      return [3, 4, 5].filter((past) => diff(pixel(from + n, middle + past), ground) <= 24).length >= 2;
    });
    return { deep: middle, back: back.length / depth.length };
  };
  const top = side(W, (x, d) => at(x, d));
  const bottom = side(W, (x, d) => at(x, H - 1 - d));
  const left = side(H, (y, d) => at(d, y));
  const right = side(H, (y, d) => at(W - 1 - d, y));
  if (!top || !bottom || !left || !right) return false;
  if ((top.back + bottom.back + left.back + right.back) / 4 >= 0.3) return false;
  // Lit only a little unevenly, it could still be printed: a black border with
  // some texture to it, round an ornamental frame. That is the same depth on
  // facing sides, though, and a copy laid on a dark surface rarely is. On
  // white, a shadow that faint is already the giveaway.
  if (uneven >= 25 || dim >= 200) return true;
  return Math.abs(top.deep - bottom.deep) >= 3 || Math.abs(left.deep - right.deep) >= 3;
}

// How much of the picture is one flat ground, and how much of the rest is a
// single ink on it (with the shades between the two, where letters blur).
export async function cardShares(buffer) {
  const W = 96;
  const H = 144;
  const { data } = await sharp(buffer)
    .flatten({ background: "#ffffff" })
    .resize(W, H, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = W * H;
  const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const far = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
  // The commonest colour among some of the pixels.
  const commonest = (keep) => {
    const bins = new Map();
    for (let i = 0; i < n; i++) {
      const c = px(i);
      if (!keep(c)) continue;
      const key = ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4);
      const bin = bins.get(key) || [0, 0, 0, 0];
      bin[0] += c[0];
      bin[1] += c[1];
      bin[2] += c[2];
      bin[3]++;
      bins.set(key, bin);
    }
    let top = null;
    for (const bin of bins.values()) if (!top || bin[3] > top[3]) top = bin;
    return top && [top[0] / top[3], top[1] / top[3], top[2] / top[3]];
  };
  const ground = commonest(() => true);
  const ink = commonest((c) => far(c, ground) > 70);
  if (!ink) return { ground: 1, ink: 0, body: 0 };
  const axis = [ink[0] - ground[0], ink[1] - ground[1], ink[2] - ground[2]];
  const length2 = axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2;
  let onGround = 0;
  let onInk = 0;
  const solid = new Uint8Array(n); // where the ink is at more than half strength
  for (let i = 0; i < n; i++) {
    const c = px(i);
    if (far(c, ground) <= 24) {
      onGround++;
      continue;
    }
    const v = [c[0] - ground[0], c[1] - ground[1], c[2] - ground[2]];
    const t = (v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2]) / length2;
    const off = Math.hypot(v[0] - t * axis[0], v[1] - t * axis[1], v[2] - t * axis[2]);
    if (t > -0.1 && t < 1.3 && off <= 32) onInk++;
    if (t > 0.5) solid[i] = 1;
  }
  // Letters are strokes; a drawing has bodies. How much of the ink is more
  // than two pixels from the ground on every side.
  let inked = 0;
  let deep = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!solid[y * W + x]) continue;
      inked++;
      let inside = x >= 2 && y >= 2 && x < W - 2 && y < H - 2;
      for (let dy = -2; inside && dy <= 2; dy++) for (let dx = -2; inside && dx <= 2; dx++) if (!solid[(y + dy) * W + x + dx]) inside = false;
      if (inside) deep++;
    }
  return { ground: onGround / n, ink: onGround < n ? onInk / (n - onGround) : 0, body: inked ? deep / inked : 0 };
}

// A barcode on the front: a library's sticker on a scan of its copy. Dozens of
// upright black bars of mixed widths, packed close, each in the same place on
// every line for a little way down and then gone, with the flat white of the
// label on both sides. Type has the packing but changes from line to line;
// stripes in the artwork are evenly spaced, or run on down the cover. Small
// scans blur the bars away, and are let through.
export async function hasBarcode(buffer) {
  return !!(await barcodeAt(buffer));
}

/** Where the barcode is ({ x0, x1, y } as shares of the picture), or null. */
export async function barcodeAt(buffer, debug = null) {
  let img;
  try {
    img = await sharp(buffer).greyscale().resize({ width: 1400, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }
  const { data } = img;
  const W = img.info.width;
  const H = img.info.height;
  if (W < 700) return null;
  const down = Math.max(12, Math.round(H * 0.008)); // how far the bars must run
  const gap = Math.max(12, Math.round(W * 0.02)); // more white than this ends the block
  const SWING = 45; // a smaller change than this is grain, not a bar
  // Where a line turns from light to dark (true) and back, between two points.
  // A scan's label is often grey, so a turn is measured from the last peak or
  // trough, not against fixed levels.
  const turns = (y, from, to) => {
    const at = [];
    const toDark = [];
    let dark = false;
    let extreme = data[y * W + from];
    for (let x = from + 1; x <= to; x++) {
      const v = data[y * W + x];
      if (dark ? v < extreme : v > extreme) extreme = v;
      else if (Math.abs(v - extreme) >= SWING) {
        dark = !dark;
        extreme = v;
        at.push(x);
        toDark.push(dark);
      }
    }
    return { at, toDark };
  };
  // The share of one line's turns that another line has too, within a pixel.
  const kept = (a, b) => {
    let found = 0;
    for (let i = 0, j = 0; i < a.at.length; i++) {
      while (j < b.at.length && b.at[j] < a.at[i] - 1) j++;
      for (let k = j; k < b.at.length && b.at[k] <= a.at[i] + 1; k++)
        if (b.toDark[k] === a.toDark[i]) {
          found++;
          break;
        }
    }
    return a.at.length ? found / a.at.length : 0;
  };
  const spread = (runs) => {
    if (runs.length < 8) return 1;
    const sorted = [...runs].sort((p, q) => p - q);
    return sorted[Math.floor(sorted.length * 0.85)] / Math.max(1, sorted[Math.floor(sorted.length * 0.15)]);
  };
  // The label beside the bars: flat, and as light as the gaps between them.
  const label = (y, from, to, white) => {
    let sum = 0, n = 0, min = 255, max = 0;
    for (let x = Math.max(0, from); x <= Math.min(W - 1, to); x++) {
      const v = data[y * W + x];
      sum += v; n++;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return n >= 4 && max - min <= 40 && sum / n >= white - 30;
  };
  for (let y = 0; y + down < H; y += 3) {
    const row = turns(y, 0, W - 1);
    for (let from = 0; from < row.at.length; ) {
      let to = from;
      while (to + 1 < row.at.length && row.at[to + 1] - row.at[to] <= gap) to++;
      const first = from;
      const x0 = row.at[first];
      const x1 = row.at[to];
      const count = to - first + 1;
      from = to + 1;
      // Sixty bars and more, a few pixels each.
      if (count < 60 || x1 - x0 < W * 0.06 || x1 - x0 > W * 0.65 || (x1 - x0) / count > W * 0.0045) continue;
      const bars = [];
      const spaces = [];
      let white = 0;
      for (let i = first; i < to; i++) {
        (row.toDark[i] ? bars : spaces).push(row.at[i + 1] - row.at[i]);
        if (!row.toDark[i]) for (let x = row.at[i]; x < row.at[i + 1]; x++) if (data[y * W + x] > white) white = data[y * W + x];
      }
      if (white < 120 || !label(y, x0 - 14, x0 - 4, white) || !label(y, x1 + 4, x1 + 14, white)) continue;
      if (Math.max(spread(bars), spread(spaces)) < 1.8) continue;
      const left = Math.max(0, x0 - 14);
      const right = Math.min(W - 1, x1 + 14);
      const here = turns(y, left, right);
      let least = 1;
      for (let k = 2; least >= 0.9 && k <= down; k += 2) {
        const there = turns(y + k, left, right);
        least = Math.min(least, kept(here, there), Math.abs(there.at.length - here.at.length) <= here.at.length * 0.2 ? 1 : 0);
      }
      // A sticker's bars stop within a few lines; a striped design runs on.
      const below = y + Math.round(H * 0.1);
      const runsOn = below < H ? kept(here, turns(below, left, right)) : 0;
      if (debug) debug.push({ y: +(y / H).toFixed(3), x0: +(x0 / W).toFixed(2), x1: +(x1 / W).toFixed(2), count, each: +((x1 - x0) / count).toFixed(1), least: +least.toFixed(2), runsOn: +runsOn.toFixed(2) });
      if (least >= 0.9 && runsOn < 0.5) return { x0: x0 / W, x1: x1 / W, y: y / H };
    }
  }
  return null;
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

  // A download that stopped part-way and was saved anyway: the decoder filled
  // the rest of the picture with mid-grey.
  const greyRow = (y) => {
    for (let x = 0; x < info.width; x++)
      for (let c = 0; c < 3; c++) if (Math.abs(data[(y * info.width + x) * info.channels + c] - 128) > 3) return false;
    return true;
  };
  let cut = 0;
  while (cut < info.height && greyRow(info.height - 1 - cut)) cut++;
  if (cut >= 4) return reject("picture cut off part-way down", stats);

  // A 3D product shot (a mock-up of the hardback with its sprayed edges) on a
  // plain background. Our shelves draw the book themselves; they need the
  // flat front.
  if (await isProductShot(buffer)) return reject("photo of the book, not the flat cover", stats);
  // A scan of a library's copy, with its barcode sticker on the front.
  if (await hasBarcode(buffer)) return reject("barcode sticker on the cover", stats);
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
