// Ranks a reader's Want to Read pile by what they've loved before, and says
// why each book is there. Pure functions, so they're easy to test.
//
// Taste comes from the Read shelf: each finished book counts for its authors
// and genres, weighted by the rating it got (5★ strongly for, 1–2★ against,
// unrated mildly for — finishing a book says something).
import { tidyGenres } from "@/lib/genres";

const weightFor = (rating) => (rating ? rating - 2.5 : 0.5);
const genresOf = (book) => tidyGenres(book?.genres).map((g) => g.toLowerCase());
const authorKey = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** read: [{ rating, book: { title, authors, genres } }] */
export function buildTaste(read) {
  const genres = new Map(); // genre → { score, loved }
  const authors = new Map(); // author → { score, best: { title, rating } }
  for (const { rating, book } of read) {
    if (!book) continue;
    const w = weightFor(rating);
    for (const g of genresOf(book)) {
      const cur = genres.get(g) || { score: 0, loved: 0 };
      cur.score += w;
      if (rating >= 4) cur.loved++;
      genres.set(g, cur);
    }
    for (const a of book.authors || []) {
      const k = authorKey(a);
      if (!k) continue;
      const cur = authors.get(k) || { name: a, score: 0, read: 0, best: null };
      cur.score += w;
      cur.read++;
      if (rating && (!cur.best || rating > cur.best.rating)) cur.best = { title: book.title, rating };
      authors.set(k, cur);
    }
  }
  const topGenre = Math.max(1, ...[...genres.values()].map((g) => g.score));
  return { genres, authors, topGenre };
}

const stars = (n) => "★".repeat(n);

/**
 * want: [{ addedAt, book: { title, authors, genres, page_count } }]
 * Returns the same items with { score, reason, tags } added, best first.
 */
export function rankUpNext(want, taste, now = Date.now()) {
  return want
    .map((item) => {
      const { book } = item;
      const reasons = [];

      // Authors you already know you like are the strongest signal.
      let authorScore = 0;
      for (const a of book.authors || []) {
        const t = taste.authors.get(authorKey(a));
        if (!t) continue;
        authorScore = Math.max(authorScore, Math.min(t.score, 6));
        if (t.best?.rating >= 4) {
          reasons.push({ weight: 10 + t.score, text: `You gave ${t.best.title} ${stars(t.best.rating)}` });
        } else if (t.score < 0) {
          reasons.push({ weight: -1, text: `You weren’t keen on ${t.name} before` });
        }
      }

      // Genre match: the book's three best-liked genres, scaled 0–1.
      const affinities = genresOf(book)
        .map((g) => ({ g, ...(taste.genres.get(g) || { score: 0, loved: 0 }) }))
        .sort((a, b) => b.score - a.score);
      const top = affinities.slice(0, 3);
      const genreScore = top.length
        ? top.reduce((n, x) => n + Math.max(-1, x.score / taste.topGenre), 0) / top.length
        : 0;
      const loved = affinities.find((x) => x.loved >= 3);
      if (loved) reasons.push({ weight: 5 + loved.loved / 10, text: `You’ve loved ${loved.loved} ${loved.g} books` });

      // A little credit for patience: the longer it's waited, the more it's earned a go.
      const years = item.addedAt ? (now - new Date(item.addedAt).getTime()) / 3.15e10 : 0;
      if (years >= 2) reasons.push({ weight: 2, text: `On your list since ${new Date(item.addedAt).getFullYear()}` });

      const pages = book.page_count;
      const quick = pages && pages <= 300;
      if (quick) reasons.push({ weight: 1.5, text: `A quick ${pages} pages` });

      const score = authorScore * 1.2 + genreScore * 4 + Math.min(years, 6) * 0.15;
      const reason =
        reasons.sort((a, b) => b.weight - a.weight)[0]?.text || "Waiting on your Want to Read shelf";
      return { ...item, score, reason, quick: !!quick, years };
    })
    .sort((a, b) => b.score - a.score);
}
