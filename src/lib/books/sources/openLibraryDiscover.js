/**
 * Discover popular books by subject using the Open Library Search API.
 * Uses edition_count as a quality proxy — widely-published books are popular.
 */
export async function discoverBySubject(
  subject,
  { limit = 100, minEditions = 5, language = "eng" } = {}
) {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("subject", subject);
  url.searchParams.set("language", language);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "editions");
  url.searchParams.set(
    "fields",
    [
      "key",
      "title",
      "author_name",
      "edition_count",
      "isbn",
      "cover_i",
      "first_publish_year",
      "subject",
      "publisher",
      "number_of_pages_median",
      "language"
    ].join(",")
  );

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "YourNextTale/1.0 (book discovery app)" }
  });

  if (!res.ok) {
    throw new Error(`Open Library search failed: ${res.status}`);
  }

  const data = await res.json();
  const works = data.docs || [];

  const results = [];

  for (const work of works) {
    if ((work.edition_count || 0) < minEditions) continue;

    if (language && work.language && !work.language.includes("eng")) continue;

    const isbns = work.isbn || [];
    const isbn13 = isbns.find((i) => i.length === 13 && i.startsWith("978"));
    const isbn10 = isbns.find((i) => i.length === 10);

    if (!isbn13 && !isbn10) continue;

    results.push({
      isbn_13: isbn13 || null,
      isbn_10: isbn10 || null,
      edition_count: work.edition_count || 0,
      ol_preview: {
        title: work.title,
        authors: work.author_name || [],
        cover_id: work.cover_i || null,
        first_publish_year: work.first_publish_year || null,
        subjects: work.subject?.slice(0, 10) || [],
        page_count: work.number_of_pages_median || null
      }
    });
  }

  return results.sort((a, b) => b.edition_count - a.edition_count);
}
