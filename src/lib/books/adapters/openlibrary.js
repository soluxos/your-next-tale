import { sanitiseDescription } from "@/lib/books/sanitiseDescription";
import { normaliseLanguage } from "@/lib/books/normaliseLanguage";

/**
 * Maps an Open Library result to the internal normalised shape.
 * Handles both the search result shape (/search.json) and the
 * ISBN lookup shape (/api/books?bibkeys=ISBN:...&jscmd=data).
 * Returns null for any field it cannot find — never throws.
 */
export function normaliseOpenLibrary(doc) {
  if (!doc) return {};

  // Shape detection:
  // Search result has doc.author_name (array of strings)
  // ISBN lookup has data.authors (array of objects with .name)
  const isIsbnLookup = doc.authors && !doc.author_name;

  if (isIsbnLookup) {
    return normaliseOpenLibraryIsbnLookup(doc);
  }

  return normaliseOpenLibrarySearch(doc);
}

function normaliseOpenLibrarySearch(doc) {
  const isbns = Array.isArray(doc.isbn) ? doc.isbn : [];
  const isbn13 = isbns.find((i) => i.length === 13) || null;
  const isbn10 = isbns.find((i) => i.length === 10) || null;

  const authors =
    Array.isArray(doc.author_name) && doc.author_name.length > 0
      ? doc.author_name
      : null;

  const description = sanitiseDescription(
    Array.isArray(doc.first_sentence) && doc.first_sentence.length > 0
      ? doc.first_sentence[0]
      : null
  );

  const genres = Array.isArray(doc.subject) ? doc.subject.slice(0, 10) : null;

  const coverId = doc.cover_i || null;
  const cover_remote = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : null;

  return {
    title: doc.title || null,
    authors,
    description,
    isbn_13: isbn13,
    isbn_10: isbn10,
    genres,
    page_count:
      typeof doc.number_of_pages_median === "number"
        ? doc.number_of_pages_median
        : null,
    published_date: doc.first_publish_year
      ? `${doc.first_publish_year}-01-01`
      : null,
    publisher: Array.isArray(doc.publisher) ? doc.publisher[0] : null,
    language: normaliseLanguage(
      Array.isArray(doc.language) ? doc.language[0] : null
    ),
    cover_remote,
    _source: "openlibrary"
  };
}

function normaliseOpenLibraryIsbnLookup(data) {
  const isbn13 = data.identifiers?.isbn_13?.[0] || null;
  const isbn10 = data.identifiers?.isbn_10?.[0] || null;

  const authors =
    Array.isArray(data.authors) && data.authors.length > 0
      ? data.authors.map((a) => a.name).filter(Boolean)
      : null;

  const rawDesc =
    data.notes ||
    (Array.isArray(data.excerpts) && data.excerpts.length > 0
      ? data.excerpts[0].text
      : null);
  const description = sanitiseDescription(
    typeof rawDesc === "string" ? rawDesc : rawDesc?.value || null
  );

  const genres =
    Array.isArray(data.subjects) && data.subjects.length > 0
      ? data.subjects
          .map((s) => s.name)
          .filter(Boolean)
          .slice(0, 10)
      : null;

  const cover_remote = data.cover?.large || data.cover?.medium || null;

  // Language: data.language is like [{key: "/languages/eng"}]
  let language = null;
  if (Array.isArray(data.language) && data.language.length > 0) {
    const langKey = data.language[0].key || "";
    const langCode = langKey.split("/").pop();
    language = normaliseLanguage(langCode);
  }

  return {
    title: data.title || null,
    authors,
    description,
    isbn_13: isbn13,
    isbn_10: isbn10,
    genres,
    page_count:
      typeof data.number_of_pages === "number" ? data.number_of_pages : null,
    published_date: data.publish_date || null,
    publisher:
      Array.isArray(data.publishers) && data.publishers.length > 0
        ? data.publishers[0].name
        : null,
    language,
    cover_remote,
    _source: "openlibrary"
  };
}
