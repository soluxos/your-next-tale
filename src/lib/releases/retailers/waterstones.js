// Waterstones' booksellers pick new and upcoming books for each genre page
// ("On the Horizon", "New for 2026") and for the shop-wide coming-soon and
// new-books pages. We read those carousels, then each book's own page for the
// facts (JSON-LD: ISBN, date, pages, format; breadcrumbs: genre).
//
// Facts only. The blurb and the jacket image on a Waterstones page are the
// publisher's copyright, shown there under the shop's own licence; we take
// covers and descriptions from ISBNdb and Open Library instead.
import { politeFetch, htmlText, jsonLd, hasType } from "./politeFetch";

const BASE = "https://www.waterstones.com";
export const SHOP = "waterstones";

// `genre` null: a mixed list, classified from each book's own categories.
// `weight`: how strong a signal a place on this list is (shop-wide "biggest"
// lists beat a genre page's carousel).
const LISTS = [
  {
    path: "/category/fiction/science-fiction-fantasy-horror/fantasy",
    genre: "fantasy",
    sections: [
      { match: /^on the horizon$/i, label: "On the Horizon", weight: 3 },
      { match: /^new for \d{4}$/i, label: "New for the year", weight: 2 }
    ]
  },
  {
    path: "/category/fiction/science-fiction-fantasy-horror/science-fiction",
    genre: "science-fiction",
    sections: [
      { match: /^on the horizon$/i, label: "On the Horizon", weight: 3 },
      { match: /^new for \d{4}$/i, label: "New for the year", weight: 2 }
    ]
  },
  {
    path: "/campaign/coming-soon",
    genre: null,
    sections: [{ match: /science fiction, fantasy/i, label: "Biggest coming soon", weight: 4 }]
  },
  {
    path: "/campaign/new-books",
    genre: null,
    sections: [
      { match: /science fiction, fantasy/i, label: "Best of the year", weight: 4 },
      { match: /romantasy/i, label: "Best romantasy of the year", weight: 3, genre: "fantasy" }
    ]
  }
];

/** [{ heading, books: [{ isbn, title, authors, url, format, preorder }] }] */
export function parseCarousels(html) {
  const sections = [];
  for (const part of String(html).split(/<h2\b[^>]*>/i).slice(1)) {
    const heading = htmlText(part.slice(0, part.indexOf("</h2>")));
    const books = [];
    const re = /<div class="swiper-slide book-preview"([\s\S]*?)<div class="book-price">([\s\S]*?)<\/div>\s*<\/div>/g;
    for (const m of part.matchAll(re)) {
      const a = m[1];
      const attr = (n) => (a.match(new RegExp(`data-${n}="([^"]*)"`)) || [])[1];
      const href = (a.match(/href="(\/book\/[^"]+)"/) || [])[1];
      books.push({
        isbn: attr("isbn") || null,
        preorder: attr("preorder") === "1",
        title: htmlText((a.match(/class="title link-invert">([\s\S]*?)<\/a>/) || [])[1]),
        authors: [...a.matchAll(/class="text-author">\s*<b>([\s\S]*?)<\/b>/g)].map((x) => htmlText(x[1])),
        url: href ? BASE + href : null,
        format: htmlText((m[2].match(/class="format">([\s\S]*?)<\/span>/) || [])[1])
      });
    }
    if (books.length) sections.push({ heading, books });
  }
  return sections;
}

export const WATERSTONES_LISTS = LISTS.map((l) => ({ ...l, shop: SHOP, key: `${SHOP}:${l.path}` }));

/** The picks on one list page, in list order. Throws BlockedError on a bot check. */
export async function readWaterstonesList(list, { log = () => {} } = {}) {
  const html = await politeFetch(BASE + list.path);
  if (!html) {
    log(`waterstones: ${list.path} is gone`);
    return [];
  }
  const sections = parseCarousels(html);
  const picks = [];
  for (const rule of list.sections) {
    const section = sections.find((s) => rule.match.test(s.heading));
    if (!section) {
      log(`waterstones: no “${rule.label}” on ${list.path}`);
      continue;
    }
    section.books.forEach((b, i) => {
      if (!b.url || !b.title) return;
      picks.push({ shop: SHOP, list: rule.label, weight: rule.weight, rank: i, size: section.books.length, genre: rule.genre || list.genre, ...b });
    });
  }
  return picks;
}

const pageUrl = (isbn) => `${BASE}/book/x/x/${isbn}`;

/** The facts on one book's page, or null if it's gone. */
export async function waterstonesBook(urlOrIsbn) {
  const url = /^\d{13}$/.test(urlOrIsbn) ? pageUrl(urlOrIsbn) : urlOrIsbn;
  const html = await politeFetch(url);
  return html ? parseWaterstonesBook(html, url) : null;
}

export function parseWaterstonesBook(html, url) {
  const nodes = jsonLd(html);
  const book = nodes.find((n) => hasType(n, "Book"));
  const product = nodes.find((n) => hasType(n, "Product"));
  if (!book && !product) return null;

  // "A Court of Forgotten Melody - A Court of Thorns and Roses": title, series.
  const name = htmlText(book?.name || product?.name);
  const cut = name.lastIndexOf(" - ");
  const title = cut > 0 ? name.slice(0, cut) : name;
  const series = cut > 0 ? name.slice(cut + 3) : null;

  // "This item can be found in:" — the shop's own shelving for the book.
  const crumbs = html.match(/class="breadcrumbs[^"]*">([\s\S]*?)<\/div>/);
  const categories = crumbs ? [...crumbs[1].matchAll(/href="\/category\/([^"]+)"/g)].map((m) => m[1]) : [];

  const authors = [book?.author].flat().filter(Boolean).map((a) => htmlText(a.name || a)).filter(Boolean);
  return {
    shop: SHOP,
    url: book?.url || product?.url || url,
    isbn: String(book?.isbn || product?.gtin13 || "") || null,
    title,
    series,
    authors,
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(book?.datePublished || "") ? book.datePublished : null,
    pages: Number(book?.numberOfPages) || null,
    format: book?.bookFormat || null,
    language: book?.inLanguage || null,
    categories,
    genres: genresFromCategories(categories),
    // Shelved only under children's (not teenage / young adult) books.
    children:
      categories.length > 0 &&
      categories.every((c) => c.startsWith("childrens-")) &&
      !categories.some((c) => /teen|young-adult/.test(c)),
    preorder: /PreOrder/i.test(product?.offers?.availability || "")
  };
}

/** Waterstones category paths → our genre slugs. */
export function genresFromCategories(paths) {
  const out = new Set();
  for (const p of paths) {
    if (/\/fantasy(\/|$)|fantasy-paranormal-romance/.test(p)) out.add("fantasy");
    if (/\/science-fiction(\/|$)/.test(p)) out.add("science-fiction");
  }
  return [...out];
}

/** Waterstones exclusive editions use in-house numbers, not ISBNs. */
export const isShopCode = (code) => /^2\d{12}$/.test(String(code || ""));
