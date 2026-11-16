import { tidyGenres } from "@/lib/genres";

/*
 * Genre matching for a shelf's filter, by whole words: "Fantasy" finds
 * "Epic Fantasy" and "Science Fiction & Fantasy", but "Roman" doesn't find
 * "Romance" (the substring match in lib/shelfFilter did). The filter and the
 * chip counts both use this, so picking a chip shows exactly that many books.
 */

const words = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .match(/[a-z0-9]+/g) || [];

/** A genre as the phrase it has to appear as. */
export const genreKey = (genre) => words(genre).join(" ");

const MAX_WORDS = 6;

// Every run of whole words in a book's genres — "Epic Fantasy" gives "epic",
// "fantasy" and "epic fantasy" — without running across "a, b" lists.
function phrasesOf(genres) {
  const out = new Set();
  for (const raw of genres || []) {
    for (const part of String(raw || "").split(/\s*[,/;]\s*/)) {
      const w = words(part);
      for (let i = 0; i < w.length; i++) {
        for (let j = i + 1; j <= Math.min(w.length, i + MAX_WORDS); j++) out.add(w.slice(i, j).join(" "));
      }
    }
  }
  return out;
}

/**
 * Index a shelf's books once (when the list changes): each book's genre
 * phrases, and the genres on offer — tidied names, most common first.
 */
export function buildGenreIndex(items) {
  const phrases = new Map(items.map((item) => [item.id, phrasesOf(item.book?.genres)]));
  const names = new Map();
  for (const item of items) {
    for (const g of tidyGenres(item.book?.genres)) {
      const key = genreKey(g);
      if (key && !names.has(key)) names.set(key, g);
    }
  }
  const totals = countKeys(phrases, items, names);
  const genres = [...names]
    .map(([key, genre]) => ({ key, genre, total: totals.get(key) || 0 }))
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total || a.genre.localeCompare(b.genre));
  return { phrases, genres };
}

function countKeys(phrases, items, keys) {
  const counts = new Map();
  for (const item of items) {
    for (const p of phrases.get(item.id) || []) {
      if (keys.has(p)) counts.set(p, (counts.get(p) || 0) + 1);
    }
  }
  return counts;
}

/** Keep the items carrying every one of `genres`. */
export function filterByGenres(index, items, genres) {
  const keys = (genres || []).map(genreKey).filter(Boolean);
  if (!keys.length) return items;
  return items.filter((item) => {
    const p = index.phrases.get(item.id);
    return !!p && keys.every((k) => p.has(k));
  });
}

/**
 * The genre chips: [{ genre, total, count }] — total on the shelf, count in
 * `results` (the books the other filters leave).
 */
export function genreOptionsFor(index, results) {
  const keys = new Map(index.genres.map((g) => [g.key, g]));
  const counts = countKeys(index.phrases, results, keys);
  return index.genres.map(({ key, genre, total }) => ({ genre, total, count: counts.get(key) || 0 }));
}
