/**
 * Maps an Open Library edition/work response to the internal book shape.
 * Accepts the merged result of /isbn/{isbn}.json + /works/{key}.json lookups.
 */
export function normaliseOpenLibrary(edition, work = {}) {
  const isbn13 =
    edition.isbn_13?.[0] || null;
  const isbn10 =
    edition.isbn_10?.[0] || null;

  // Authors may come as [{key: "/authors/OL123A"}] — resolve names upstream.
  // Here we accept pre-resolved author name strings or fall back to keys.
  const authors = (edition._resolvedAuthors || []).length
    ? edition._resolvedAuthors
    : (edition.authors || work.authors || []).map(
        (a) => a.name || a.key || ""
      );

  const description =
    typeof work.description === "string"
      ? work.description
      : work.description?.value || "";

  const coverId = edition.covers?.[0] || work.covers?.[0] || null;
  const coverUrl = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : null;

  return {
    isbn_13: isbn13,
    isbn_10: isbn10,
    title: edition.title || work.title || "",
    authors,
    genres: work.subjects || [],
    description,
    cover_url: coverUrl,
    page_count: edition.number_of_pages || null,
    published_date: edition.publish_date || null,
    publisher: edition.publishers?.[0] || null,
    language: edition.languages?.[0]?.key?.replace("/languages/", "") || "en",
    source: "openlibrary",
    last_synced_at: new Date().toISOString(),
  };
}
