/**
 * Maps an ISBNdb book response to the internal book shape.
 * Expects the single-book object from the ISBNdb API (e.g. data.book).
 */
export function normaliseISBNdb(raw) {
  const isbn13 = raw.isbn13 || null;
  const isbn10 = raw.isbn || null;

  const identifiers = [isbn13, isbn10].filter(Boolean);
  const resolvedIsbn13 = identifiers.find((id) => id.length === 13) || null;
  const resolvedIsbn10 = identifiers.find((id) => id.length === 10) || null;

  return {
    isbn_13: resolvedIsbn13,
    isbn_10: resolvedIsbn10,
    title: raw.title || "",
    authors: Array.isArray(raw.authors) ? raw.authors : [],
    genres: Array.isArray(raw.subjects) ? raw.subjects : [],
    description: raw.synopsis || raw.overview || raw.excerpt || "",
    cover_url: raw.image_original || raw.image || null,
    page_count: raw.pages || null,
    published_date: raw.date_published || null,
    publisher: raw.publisher || null,
    language: raw.language || "en",
    source: "isbndb",
    last_synced_at: new Date().toISOString(),
  };
}
