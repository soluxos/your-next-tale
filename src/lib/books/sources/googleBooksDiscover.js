/**
 * Discover books by subject using Google Books API.
 * Relevance sort heavily favours well-known titles.
 */
export async function discoverBySubjectGoogle(subject, { limit = 40 } = {}) {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `subject:${subject}`);
  url.searchParams.set("langRestrict", "en");
  url.searchParams.set("maxResults", String(Math.min(limit, 40)));
  url.searchParams.set("orderBy", "relevance");
  url.searchParams.set("printType", "books");

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  const items = data.items || [];

  const results = [];

  for (const item of items) {
    const info = item.volumeInfo || {};
    const identifiers = info.industryIdentifiers || [];

    const isbn13 = identifiers.find((i) => i.type === "ISBN_13")?.identifier;
    const isbn10 = identifiers.find((i) => i.type === "ISBN_10")?.identifier;

    if (!isbn13 && !isbn10) continue;

    results.push({
      isbn_13: isbn13 || null,
      isbn_10: isbn10 || null,
      edition_count: 0,
      google_preview: {
        title: info.title,
        authors: info.authors || [],
        description: info.description,
        cover_url: info.imageLinks?.thumbnail
          ?.replace("zoom=1", "zoom=3")
          .replace("http://", "https://"),
        page_count: info.pageCount || null,
        categories: info.categories || [],
        published_date: info.publishedDate || null,
        publisher: info.publisher || null
      }
    });
  }

  return results;
}
