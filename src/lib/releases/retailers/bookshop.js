// Bookshop.org's editors keep lists of new, anticipated and best-selling books. We read
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

/**
 * What's selling and what's new in fantasy and science fiction, for the
 * catalogue import: which books to have, and a signal of what's popular now.
 * `weight` is how much a place on the list says (0 to 1); `kind` is what it
 * says. The US and UK shops keep their own lists.
 */
const UK = "https://uk.bookshop.org";
export const BOOKSHOP_CHARTS = [
  { path: "/lists/bestselling-books-in-fantasy-sci-fi", label: "Bookshop.org bestsellers in fantasy and sci-fi", kind: "bestseller", weight: 1, pages: 2 },
  { path: "/lists/the-indie-scifi-fantasy-bestseller-list-soulbound-books", label: "Indie bookshop sci-fi and fantasy bestsellers", kind: "bestseller", weight: 0.9, pages: 2 },
  { path: "/lists/new-books-in-fantasy", label: "New in fantasy", kind: "new", weight: 0.6, genre: "fantasy", pages: 2 },
  { path: "/lists/new-on-bookshop-bestselling-speculative-fiction", label: "Bestselling new speculative fiction", kind: "new", weight: 0.3, pages: 1 },
  { base: UK, path: "/lists/hot-new-sff-titles", label: "Bookshop.org UK hot new sci-fi and fantasy", kind: "new", weight: 0.7, pages: 2 }
].map((l) => ({ genre: null, ...l, shop: SHOP, key: `${SHOP}:${l.base ? "uk" : "us"}:${l.path}` }));

/**
 * The picks on a list, in the editors' order, across its pages. Throws
 * BlockedError on a bot check. `fetchPage` lets a caller keep its own copy
 * of the pages; it must go through politeFetch.
 */
export async function readBookshopList(list, { log = () => {}, fetchPage = politeFetch } = {}) {
  const picks = [];
  const seen = new Set();
  for (let page = 1; page <= (list.pages || 1); page++) {
    const html = await fetchPage((list.base || BASE) + list.path + (page > 1 ? `?page=${page}` : ""));
    if (!html) {
      if (page === 1) log(`bookshop: ${list.path} is gone`);
      break;
    }
    // Past the last page the shop shows the first again.
    const fresh = parseBookshopList(html, list).filter((p) => !seen.has(p.isbn));
    if (!fresh.length) break;
    for (const p of fresh) seen.add(p.isbn);
    picks.push(...fresh);
  }
  if (!picks.length) log(`bookshop: no books found on ${list.path}`);
  return picks.map((p, i) => ({ ...p, rank: i, size: picks.length }));
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
    url: `${list.base || BASE}${path}?ean=${cards.get(path).isbn}`,
    preorder: false,
    ...cards.get(path)
  }));
}
