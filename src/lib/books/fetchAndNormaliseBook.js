import { normaliseISBNdb } from "./adapters/isbndb";
import { normaliseOpenLibrary } from "./adapters/openlibrary";
import { normaliseGoogleBooks } from "./adapters/googlebooks";
import { sanitiseDescription } from "./sanitiseDescription";
import { normaliseLanguage } from "./normaliseLanguage";
import { getBookshopLink } from "@/lib/bookshop";
import { TABLES } from "@/lib/supabase/types";

const STALE_DAYS = 30;

/**
 * Fetch, normalise, download cover, and upsert a book into the books table.
 *
 * Accepts either:
 *  - An ISBN string (will fetch fresh from all three APIs)
 *  - A search result object with { _raw, source, preview } from the search API
 *
 * Always fetches full data from all sources by ISBN rather than relying on
 * partial _raw data from search results — ensures description, genres, etc.
 * are complete.
 */
export async function fetchAndNormaliseBook(input, supabase) {
  // 1. Extract the best available ISBN from the input
  let isbn = null;
  if (typeof input === "string") {
    isbn = input;
  } else {
    isbn =
      input?.preview?.isbn_13 ||
      input?.preview?.isbn_10 ||
      input?._raw?.isbn13 ||
      input?._raw?.isbn ||
      null;
  }

  // 2. If we have an ISBN, check the local DB first
  if (isbn) {
    const { data: existing } = await supabase
      .from(TABLES.BOOKS)
      .select("*")
      .or(`isbn_13.eq.${isbn},isbn_10.eq.${isbn}`)
      .single();

    if (existing && existing.last_synced_at && !existing.is_incomplete) {
      const syncedAt = new Date(existing.last_synced_at);
      const thirtyDaysAgo = new Date(
        Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
      );
      if (syncedAt > thirtyDaysAgo) {
        return existing; // fresh enough, return as-is
      }
    }
  }

  // 3. Fetch FULL data from all sources in parallel using the ISBN
  //    Do NOT rely on _raw from the search result — always fetch fresh
  //    so we get the complete data including description, genres, page_count etc.
  const preview = typeof input === "string" ? null : input?.preview || null;

  const [isbndbResult, openLibraryResult, googleBooksResult] =
    await Promise.allSettled([
      isbn ? fetchFromIsbndb(isbn) : Promise.resolve(null),
      isbn ? fetchFromOpenLibrary(isbn) : Promise.resolve(null),
      isbn
        ? fetchFromGoogleBooks(isbn)
        : fetchFromGoogleBooksByTitle(preview?.title, preview?.author)
    ]);

  const isbndbData =
    isbndbResult.status === "fulfilled" ? isbndbResult.value : null;
  const openLibraryData =
    openLibraryResult.status === "fulfilled" ? openLibraryResult.value : null;
  const googleBooksData =
    googleBooksResult.status === "fulfilled" ? googleBooksResult.value : null;

  // If we have no ISBN but have _raw from search, use that as a fallback
  // to avoid returning nothing at all
  let fallbackData = null;
  if (!isbn && typeof input === "object" && input?._raw) {
    if (input.source === "isbndb") fallbackData = normaliseISBNdb(input._raw);
    else if (input.source === "openlibrary")
      fallbackData = normaliseOpenLibrary(input._raw);
    else if (input.source === "googlebooks")
      fallbackData = normaliseGoogleBooks(input._raw);

    if (fallbackData) fallbackData._source = input.source;
  }

  // Handle local source — just return from DB
  if (
    typeof input === "object" &&
    input?.source === "local" &&
    input?._raw?.id
  ) {
    const { data } = await supabase
      .from(TABLES.BOOKS)
      .select("*")
      .eq("id", input._raw.id)
      .single();
    if (data) return data;
  }

  // 4. Merge all sources using best-available-data rules
  const merged = mergeBookData([
    isbndbData,
    openLibraryData,
    googleBooksData,
    fallbackData
  ]);

  if (!merged.title) {
    console.error("fetchAndNormaliseBook: could not determine title for", isbn);
    return null;
  }

  // 5. Handle cover image
  //    Prefer cover from the user's selected cover (preview.cover_preview_url)
  //    then merged remote cover, then Open Library cover API
  const coverRemoteUrl =
    preview?.cover_preview_url ||
    merged.cover_remote ||
    (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null);

  let cover_url = null;
  if (coverRemoteUrl) {
    cover_url = await downloadAndUploadCover(
      coverRemoteUrl,
      merged.isbn_13 || merged.isbn_10,
      supabase
    );
  }

  // 6. Sanitise description
  const description = sanitiseDescription(merged.description);

  // 6b. Normalise published_date to YYYY-MM-DD
  const published_date = normaliseDate(merged.published_date);

  // 7. Determine is_incomplete
  const is_incomplete =
    !merged.title ||
    !merged.authors?.length ||
    !description ||
    (!merged.isbn_13 && !merged.isbn_10) ||
    !cover_url;

  // 8. Normalise genres
  const genres = [
    ...new Set(
      (merged.genres || []).map((g) => g.toLowerCase().trim()).filter(Boolean)
    )
  ].slice(0, 15);

  // 9. Build the final book object
  const bookData = {
    isbn_13: merged.isbn_13 || null,
    isbn_10: merged.isbn_10 || null,
    title: merged.title,
    authors: merged.authors || [],
    description: description || null,
    cover_url,
    genres: genres.length > 0 ? genres : null,
    page_count: merged.page_count || null,
    published_date: published_date || null,
    publisher: merged.publisher || null,
    language: normaliseLanguage(merged.language) || "en",
    bookshop_affiliate_link: getBookshopLink(merged.isbn_13) || null,
    source: merged.source || "unknown",
    last_synced_at: new Date().toISOString(),
    is_incomplete
  };

  // 10. Upsert — conflict on isbn_13 if available, else isbn_10
  const conflictCol = bookData.isbn_13 ? "isbn_13" : "isbn_10";

  if (!bookData.isbn_13 && !bookData.isbn_10) {
    // No ISBN at all — just insert
    const { data: inserted, error } = await supabase
      .from(TABLES.BOOKS)
      .insert(bookData)
      .select()
      .single();

    if (error) {
      console.error("fetchAndNormaliseBook insert error:", error);
      return null;
    }
    return inserted;
  }

  const { data: upserted, error } = await supabase
    .from(TABLES.BOOKS)
    .upsert(bookData, { onConflict: conflictCol })
    .select()
    .single();

  if (error) {
    console.error("fetchAndNormaliseBook upsert error:", error);
    // Fallback: try to find and update existing
    if (bookData.isbn_13) {
      const { data: existing } = await supabase
        .from(TABLES.BOOKS)
        .select("*")
        .eq("isbn_13", bookData.isbn_13)
        .single();
      if (existing) {
        const { data: updated } = await supabase
          .from(TABLES.BOOKS)
          .update(bookData)
          .eq("id", existing.id)
          .select()
          .single();
        return updated || existing;
      }
    }
    return null;
  }

  return upserted;
}

// --------------- Merge ---------------

function mergeBookData(sources) {
  const valid = sources.filter(Boolean);
  if (!valid.length) return {};

  const pick = (field) => {
    for (const s of valid) {
      const v = s[field];
      if (Array.isArray(v) && v.length > 0) return v;
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && v > 0) return v;
    }
    return null;
  };

  const pickLongest = (field) =>
    valid
      .map((s) => s[field])
      .filter((v) => typeof v === "string" && v.trim())
      .sort((a, b) => b.length - a.length)[0] || null;

  const pickLargestArray = (field) =>
    valid
      .map((s) => s[field])
      .filter(Array.isArray)
      .sort((a, b) => b.length - a.length)[0] || [];

  const allGenres = valid.flatMap((s) => s.genres || []);
  const genres = [
    ...new Set(allGenres.map((g) => (g || "").toLowerCase().trim()))
  ].filter(Boolean);

  // Determine primary source name for the source field
  const sourceNames = valid.map((s) => s._source).filter(Boolean);
  const source =
    sourceNames.length > 1 ? "merged" : sourceNames[0] || "unknown";

  return {
    isbn_13: pick("isbn_13"),
    isbn_10: pick("isbn_10"),
    title: pick("title"),
    authors: pickLargestArray("authors"),
    description: pickLongest("description"),
    cover_remote: pick("cover_remote"),
    genres,
    page_count: pick("page_count"),
    published_date: pick("published_date"),
    publisher: pick("publisher"),
    language: pick("language"),
    source
  };
}

// --------------- Date ---------------

/**
 * Normalise a raw date string to YYYY-MM-DD.
 * Handles: "2019", "2019-06", "2019-06-15", "June 2019", "2019-06-15T00:00:00Z", etc.
 * Returns null for anything that can't be resolved to a valid date.
 */
function normaliseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY only
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;

  // YYYY-MM only
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;

  // ISO datetime (e.g. "2019-06-15T00:00:00Z")
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];

  // Try native Date parsing as a last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

// --------------- Cover ---------------

async function downloadAndUploadCover(remoteUrl, identifier, supabase) {
  try {
    const response = await fetch(remoteUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? ".png" : ".jpg";
    const filename = `${identifier || crypto.randomUUID()}${ext}`;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Skip tiny images (likely 1x1 placeholder pixels)
    if (buffer.length < 1000) return null;

    const { error } = await supabase.storage
      .from("books")
      .upload(filename, buffer, { contentType, upsert: true });

    if (error) throw error;
    return filename;
  } catch (e) {
    console.error("Cover download/upload failed:", remoteUrl, e.message);
    return null;
  }
}

// --------------- API Fetchers ---------------

async function fetchFromIsbndb(isbn) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api2.isbndb.com/book/${encodeURIComponent(isbn)}`,
      {
        headers: { Authorization: apiKey, Accept: "application/json" }
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const raw = data.book || null;
    if (!raw) return null;

    const normalised = normaliseISBNdb(raw);
    normalised._source = "isbndb";
    return normalised;
  } catch (e) {
    console.error("ISBNdb fetch error:", e);
    return null;
  }
}

async function fetchFromOpenLibrary(isbn) {
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const bookData = data[`ISBN:${isbn}`];
    if (!bookData) return null;

    const normalised = normaliseOpenLibrary(bookData);
    normalised._source = "openlibrary";
    return normalised;
  } catch (e) {
    console.error("Open Library fetch error:", e);
    return null;
  }
}

async function fetchFromGoogleBooks(isbn) {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&langRestrict=en&maxResults=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const volumeInfo = data.items?.[0]?.volumeInfo || null;
    if (!volumeInfo) return null;

    const normalised = normaliseGoogleBooks(volumeInfo);
    normalised._source = "googlebooks";
    return normalised;
  } catch (e) {
    console.error("Google Books fetch error:", e);
    return null;
  }
}

async function fetchFromGoogleBooksByTitle(title, author) {
  if (!title) return null;
  try {
    const parts = [`intitle:${title}`];
    if (author) parts.push(`inauthor:${author}`);
    const q = parts.join("+");
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=en&maxResults=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const volumeInfo = data.items?.[0]?.volumeInfo || null;
    if (!volumeInfo) return null;

    const normalised = normaliseGoogleBooks(volumeInfo);
    normalised._source = "googlebooks";
    return normalised;
  } catch (e) {
    console.error("Google Books title search error:", e);
    return null;
  }
}
