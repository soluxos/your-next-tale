import { sanitiseDescription } from "@/lib/books/sanitiseDescription";
import { normaliseLanguage } from "@/lib/books/normaliseLanguage";

/**
 * Maps a Google Books volumeInfo object to the internal normalised shape.
 * Expects item.volumeInfo from the Google Books API response.
 * Returns null for any field it cannot find — never throws.
 */
export function normaliseGoogleBooks(volumeInfo) {
  if (!volumeInfo) return {};

  const identifiers = volumeInfo.industryIdentifiers || [];
  const isbn13 =
    identifiers.find((id) => id.type === "ISBN_13")?.identifier || null;
  const isbn10 =
    identifiers.find((id) => id.type === "ISBN_10")?.identifier || null;

  const authors =
    Array.isArray(volumeInfo.authors) && volumeInfo.authors.length > 0
      ? volumeInfo.authors
      : null;

  const thumbnail = volumeInfo.imageLinks?.thumbnail || null;
  const cover_remote = thumbnail
    ? thumbnail.replace("zoom=1", "zoom=3").replace("http://", "https://")
    : null;

  return {
    title: volumeInfo.title || null,
    authors,
    description: sanitiseDescription(volumeInfo.description),
    isbn_13: isbn13,
    isbn_10: isbn10,
    genres: Array.isArray(volumeInfo.categories)
      ? volumeInfo.categories.slice(0, 10)
      : null,
    page_count:
      typeof volumeInfo.pageCount === "number" ? volumeInfo.pageCount : null,
    published_date: volumeInfo.publishedDate || null,
    publisher: volumeInfo.publisher || null,
    language: normaliseLanguage(volumeInfo.language),
    cover_remote,
    _source: "googlebooks"
  };
}
