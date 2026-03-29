/**
 * Maps a Google Books volumeInfo object to the internal book shape.
 * Expects item.volumeInfo from the Google Books API response.
 */
export function normaliseGoogleBooks(volumeInfo) {
  const identifiers = volumeInfo.industryIdentifiers || [];
  const isbn13 =
    identifiers.find((id) => id.type === "ISBN_13")?.identifier || null;
  const isbn10 =
    identifiers.find((id) => id.type === "ISBN_10")?.identifier || null;

  return {
    isbn_13: isbn13,
    isbn_10: isbn10,
    title: volumeInfo.title || "",
    authors: Array.isArray(volumeInfo.authors) ? volumeInfo.authors : [],
    genres: Array.isArray(volumeInfo.categories) ? volumeInfo.categories : [],
    description: volumeInfo.description || "",
    cover_url: volumeInfo.imageLinks?.thumbnail?.replace("http://", "https://") || null,
    page_count: volumeInfo.pageCount || null,
    published_date: volumeInfo.publishedDate || null,
    publisher: volumeInfo.publisher || null,
    language: volumeInfo.language || "en",
    source: "googlebooks",
    last_synced_at: new Date().toISOString(),
  };
}
