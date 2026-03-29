/**
 * Search Google Books by title. Returns an array of volumeInfo objects.
 * Used by the search API route and the normaliser.
 */
export async function searchGoogleBooks(query, maxResults = 5) {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=${maxResults}&langRestrict=en`;
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
