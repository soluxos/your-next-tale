/**
 * Catalogue genres come from several sources and overlap heavily
 * ("fiction", "Science Fiction & Fantasy", "sci-fi", "General"). These helpers
 * turn them into a short, readable list and power Discover's genre filter.
 */

// Too broad to tell a reader anything.
const NOISE = new Set([
  "fiction",
  "general",
  "literature & fiction",
  "fiction & literature",
  "juvenile fiction",
  "young adult fiction",
  "adult",
  "novel",
  "novels",
  "books",
  "english",
  "audiobook",
  "fiction in english",
  "new york times bestseller",
  "nyt bestseller",
  "bestseller",
  "large type books",
  "open syllabus project",
  "long now manual for civilization",
  "english & college success"
]);

const ALIASES = {
  "sci-fi": "science fiction",
  "scifi": "science fiction",
  "sf": "science fiction",
  "science fiction & fantasy": "science fiction",
  "fantasy & magic": "fantasy",
  "teen & young adult": "young adult",
  "thriller & suspense": "thriller",
  "thrillers": "thriller",
  "mystery & detective": "mystery",
  "action & adventure": "adventure"
};

function titleCase(s) {
  return s
    .split(" ")
    .map((w) => (w === "&" || w === "of" || w === "and" ? w : w[0]?.toUpperCase() + w.slice(1)))
    .join(" ");
}

export function tidyGenres(genres) {
  const seen = new Set();
  const out = [];
  // Some sources send one compound string ("Fiction, Fantasy, General").
  const parts = (genres || []).flatMap((raw) => String(raw || "").split(/\s*[,/]\s*/));
  for (const raw of parts) {
    let g = String(raw || "").trim().toLowerCase();
    if (!g || g.length > 32) continue;
    g = ALIASES[g] || g;
    if (NOISE.has(g) || seen.has(g)) continue;
    seen.add(g);
    out.push(titleCase(g));
  }
  return out;
}

/**
 * Discover's genre shelves. `match` lists the raw catalogue values (any case)
 * that count as that genre.
 */
export const DISCOVER_GENRES = [
  { slug: "fantasy", label: "Fantasy", match: ["fantasy", "epic fantasy", "epic", "dark fantasy", "urban fantasy", "fantasy & magic", "romantasy"] },
  { slug: "science-fiction", label: "Science fiction", match: ["science fiction", "sci-fi", "space opera", "hard science fiction", "dystopian", "science fiction & fantasy"] },
  { slug: "romance", label: "Romance", match: ["romance", "romantasy"] },
  { slug: "young-adult", label: "Young adult", match: ["young adult", "young adult fiction", "teen & young adult"] },
  { slug: "mystery-thriller", label: "Mystery & thriller", match: ["mystery", "thriller", "thrillers", "suspense", "thriller & suspense", "crime"] },
  { slug: "horror", label: "Horror", match: ["horror"] },
  { slug: "classics", label: "Classics", match: ["classics", "classic"] },
  { slug: "literary", label: "Literary", match: ["literary", "literary fiction", "contemporary"] }
];

// Discover carries these two for now; "sff" means both together.
export const SFF = "sff";
export const SFF_GENRES = DISCOVER_GENRES.filter((g) => g.slug === "fantasy" || g.slug === "science-fiction");

/** All case variants a Postgres `text[] && …` overlap needs to match. */
export function genreMatchValues(slug) {
  const match =
    slug === SFF ? SFF_GENRES.flatMap((g) => g.match) : DISCOVER_GENRES.find((x) => x.slug === slug)?.match;
  if (!match) return null;
  const out = new Set();
  for (const m of match) {
    out.add(m);
    out.add(titleCase(m));
    out.add(m.replace(/\b\w/g, (c) => c.toUpperCase()));
    out.add(m[0].toUpperCase() + m.slice(1));
  }
  return [...out];
}
