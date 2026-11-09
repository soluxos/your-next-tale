// Bookshop.org's editors keep lists of new and anticipated books. We read
// the list pages only: their book pages sit behind a Cloudflare bot check, and
// we don't try to get past that. Each list card gives the ISBN, title, author
// and format; the facts come from ISBNdb and Waterstones by ISBN, and the
// covers and descriptions from ISBNdb and Open Library, never Bookshop's own
// images.
import { politeFetch, htmlText, jsonLd, hasType } from "./politeFetch";

const BASE = "https://bookshop.org";
export const SHOP = "bookshop";

const LISTS = [
  { path: "/lists/new-books-in-fantasy", label: "New in fantasy", genre: "fantasy", weight: 2 },
  { path: "/lists/new-on-bookshop-bestselling-speculative-fiction", label: "Bestselling new speculative fiction", genre: null, weight: 2 },
  { path: "/lists/most-anticipated-books", label: "Most anticipated", genre: null, weight: 4 },
  { path: "/lists/50-preorder-picks-books-we-can-t-wait-to-read", label: "Pre-order picks", genre: null, weight: 3 }
];

const CARD =
  /href="(\/p\/books\/[^"?]+)\?ean=(\d{13})[^"]*"><h3[^>]*>([\s\S]*?)<\/h3><\/a><div><p[^>]*>([\s\S]*?)<\/p>(?:<p[^>]*>([\s\S]*?)<\/p>)?/g;

export const BOOKSHOP_LISTS = LISTS.map((l) => ({ ...l, shop: SHOP, key: `${SHOP}:${l.path}` }));

/** The picks on one list page, in the editors' order. Throws BlockedError on a bot check. */
export async function readBookshopList(list, { log = () => {} } = {}) {
  const html = await politeFetch(BASE + list.path);
  if (!html) {
    log(`bookshop: ${list.path} is gone`);
    return [];
  }
  const picks = parseBookshopList(html, list);
  if (!picks.length) log(`bookshop: no books found on ${list.path}`);
  return picks;
}

/** A list page's books, in the editors' order. */
export function parseBookshopList(html, list) {
  const cards = new Map();
  for (const m of html.matchAll(CARD)) {
    if (cards.has(m[1])) continue;
    cards.set(m[1], {
      isbn: m[2],
      title: htmlText(m[3]),
      authors: htmlText(m[4]).split(/,\s*|\s+and\s+/).filter(Boolean),
      format: htmlText(m[5] || "")
    });
  }
  const itemList = jsonLd(html).find((n) => hasType(n, "ItemList"));
  const paths = (itemList?.itemListElement || [])
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((e) => e.url && new URL(e.url).pathname)
    .filter((p) => p && cards.has(p));
  return paths.map((path, i) => ({
    shop: SHOP,
    list: list.label,
    weight: list.weight,
    rank: i,
    size: paths.length,
    genre: list.genre,
    url: `${BASE}${path}?ean=${cards.get(path).isbn}`,
    preorder: false,
    ...cards.get(path)
  }));
}
