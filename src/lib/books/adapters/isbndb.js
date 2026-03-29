import { sanitiseDescription } from "@/lib/books/sanitiseDescription";
import { normaliseLanguage } from "@/lib/books/normaliseLanguage";

/**
 * Maps an ISBNdb book response to the internal normalised shape.
 * Expects the single-book object (e.g. data.book or an item from data.books[]).
 * Returns null for any field it cannot find — never throws.
 */
export function normaliseISBNdb(raw) {
  if (!raw) return {};

  const isbn13 = raw.isbn13 && raw.isbn13.length === 13 ? raw.isbn13 : null;
  const isbn10 = raw.isbn && raw.isbn.length === 10 ? raw.isbn : null;

  return {
    title: raw.title || null,
    authors:
      Array.isArray(raw.authors) && raw.authors.length > 0 ? raw.authors : null,
    description: sanitiseDescription(raw.synopsis),
    isbn_13: isbn13,
    isbn_10: isbn10,
    genres: Array.isArray(raw.subjects) ? raw.subjects.slice(0, 10) : null,
    page_count: typeof raw.pages === "number" ? raw.pages : null,
    published_date: raw.date_published || null,
    publisher: raw.publisher || null,
    language: normaliseLanguage(raw.language),
    cover_remote: raw.image || null,
    _source: "isbndb"
  };
}
