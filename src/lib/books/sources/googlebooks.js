/**
 * Search Google Books. Returns an array of volumeInfo objects.
 * By default matches title *or* author (people search for both);
 * pass { field: "title" } to restrict to titles.
 */
export async function searchGoogleBooks(
  query,
  maxResults = 5,
  { field = "any" } = {}
) {
  try {
    const q =
      field === "title"
        ? `intitle:${encodeURIComponent(query)}`
        : encodeURIComponent(query);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=${maxResults}&langRestrict=en&printType=books`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    return (data.items || []).map((item) => item.volumeInfo).filter(Boolean);
  } catch (e) {
    console.error("Google Books search error:", e);
    return [];
  }
}

/**
 * Fetch a single book from Google Books by ISBN.
 * Returns the volumeInfo object or null.
 */
export async function fetchGoogleBookByISBN(isbn) {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return data.items?.[0]?.volumeInfo || null;
  } catch (e) {
    console.error("Google Books ISBN fetch error:", e);
    return null;
  }
}
