// Genres the New & upcoming page covers. `terms` are the values we make sure
// end up in books.genres so the rest of the app (Discover filters, Up next)
// recognises them.
export const RELEASE_GENRES = [
  { slug: "fantasy", label: "Fantasy", terms: ["fantasy"] },
  { slug: "science-fiction", label: "Science fiction", terms: ["science fiction"] }
];

export const RELEASES_SNAPSHOT_PATH = "releases/snapshot.json";
// Which cover images have already passed or failed the checks, by MD5, so a
// weekly run only reads the text on new ones. Not read by the page.
export const COVER_CHECKS_PATH = "releases/cover-checks.json";
// The shops' lists and book pages as last read, so a run the shops turn away
// still has something to go on. Not read by the page.
export const RETAIL_CACHE_PATH = "releases/retail-cache.json";

export const SHOP_NAMES = { waterstones: "Waterstones", bookshop: "Bookshop.org" };

// Snapshot items before November 2026 came from Hardcover and used other names.
export const releaseKey = (item) => item?.key ?? item?.hardcoverId;
export const releaseRank = (item) => item?.score ?? item?.readers ?? 0;

// The page never shows a book without a cover or an exact date, whatever an
// older or half-written snapshot holds.
export const listable = (item) =>
  !!(item?.cover_url && item?.title && /^\d{4}-\d{2}-\d{2}$/.test(item?.releaseDate || ""));

/** "Waterstones pick" / "Waterstones & Bookshop.org pick", or null. */
export function pickedBy(picks) {
  const shops = [...new Set((picks || []).map((p) => SHOP_NAMES[p.shop]).filter(Boolean))];
  return shops.length ? `${shops.join(" & ")} pick` : null;
}

/** "Waterstones: On the Horizon · Bookshop.org: Pre-order picks" */
export function pickedFrom(picks) {
  const byShop = new Map();
  for (const p of picks || []) {
    if (!SHOP_NAMES[p.shop]) continue;
    if (!byShop.has(p.shop)) byShop.set(p.shop, []);
    byShop.get(p.shop).push(p.list);
  }
  return [...byShop].map(([shop, lists]) => `${SHOP_NAMES[shop]}: ${lists.join(", ")}`).join(" · ") || null;
}

export function releasesSnapshotUrl() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/books/${RELEASES_SNAPSHOT_PATH}`;
}
