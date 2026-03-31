import { normaliseISBNdb } from "./adapters/isbndb";
import { normaliseOpenLibrary } from "./adapters/openlibrary";
import { normaliseGoogleBooks } from "./adapters/googlebooks";
import { sanitiseDescription } from "./sanitiseDescription";
import { normaliseLanguage, isEnglish } from "./normaliseLanguage";
import { getBookshopLink } from "@/lib/bookshop";
import { TABLES } from "@/lib/supabase/types";

const STALE_DAYS = 30;

export async function fetchAndNormaliseBook(input, supabase) {
  // ── 1. Extract ISBN + title/author from the input ──────────────────────────
  let isbn = null;
  if (typeof input === "string") {
    isbn = input;
  } else {
    isbn =
      input?.preview?.isbn_13 ||
      input?.preview?.isbn_10 ||
      input?._raw?.isbn13 ||
      input?._raw?.isbn ||
      input?._raw?.isbn_13 ||
      input?._raw?.isbn_10 ||
      null;
  }

  const preview = typeof input === "string" ? null : input?.preview || null;
  const inputTitle =
    preview?.title || input?._raw?.title || input?._raw?.book_title || null;
  const inputAuthor =
    preview?.author ||
    input?._raw?.authors?.[0] ||
    input?._raw?.author_names?.[0] ||
    null;

  console.log(`[fetchAndNormalise] "${inputTitle}" isbn=${isbn}`);

  // ── 2. DB cache — only use if fully complete ───────────────────────────────
  if (isbn) {
    const { data: existing } = await supabase
      .from(TABLES.BOOKS)
      .select("*")
      .or(`isbn_13.eq.${isbn},isbn_10.eq.${isbn}`)
      .single();

    if (
      existing?.description &&
      existing?.cover_url &&
      !existing?.is_incomplete
    ) {
      const syncedAt = new Date(existing.last_synced_at || 0);
      const staleAt = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
      if (syncedAt > staleAt) {
        console.log(`[fetchAndNormalise] returning fresh DB record`);
        return existing;
      }
    }
  }

  // For local source: if already complete return immediately, else extract ISBN
  if (typeof input === "object" && input?.source === "local" && input?._raw) {
    const raw = input._raw;
    if (!raw.is_incomplete && raw.description && raw.cover_url) return raw;
    if (!isbn) isbn = raw.isbn_13 || raw.isbn_10 || null;
  }

  // ── 3. Round 1: fetch all sources in parallel ──────────────────────────────
  // Always run a title-based Google Books search with langRestrict=en — this is
  // our most reliable route to the English edition.
  const [isbndbR, olR, gbIsbnR, gbTitleR] = await Promise.allSettled([
    isbn ? fetchFromIsbndb(isbn) : Promise.resolve(null),
    isbn ? fetchFromOpenLibrary(isbn) : Promise.resolve(null),
    isbn ? fetchFromGoogleBooks(isbn) : Promise.resolve(null),
    inputTitle
      ? fetchFromGoogleBooksByTitle(inputTitle, inputAuthor)
      : Promise.resolve(null)
  ]);

  let isbndbData = isbndbR.status === "fulfilled" ? isbndbR.value : null;
  let olData = olR.status === "fulfilled" ? olR.value : null;
  let gbIsbnData = gbIsbnR.status === "fulfilled" ? gbIsbnR.value : null;
  let gbTitleData = gbTitleR.status === "fulfilled" ? gbTitleR.value : null;

  console.log(
    `[fetchAndNormalise] round1 — isbndb:${!!isbndbData}(${isbndbData?.language}) ol:${!!olData}(${olData?.language}) gbIsbn:${!!gbIsbnData}(${gbIsbnData?.language}) gbTitle:${!!gbTitleData}(${gbTitleData?.language})`
  );

  // ── 4. Non-English ISBN detection ─────────────────────────────────────────
  // If all ISBN-based results declare a non-English language, the ISBN we were
  // given is for a translated edition. Use the English ISBN from the title search
  // and re-fetch ISBNdb + OpenLibrary with it.
  // Only evaluate sources that actually declare a language.
  // If every such source says non-English → the ISBN is for a translated edition.
  const isbnSourcesWithLang = [isbndbData, olData, gbIsbnData].filter(
    (s) => s?.language
  );
  const allNonEnglish =
    isbnSourcesWithLang.length > 0 &&
    isbnSourcesWithLang.every((s) => !isEnglish(s.language));

  if (allNonEnglish) {
    const englishIsbn = gbTitleData?.isbn_13 || gbTitleData?.isbn_10;
    console.warn(
      `[fetchAndNormalise] ISBN ${isbn} is non-English (${isbndbData?.language || olData?.language}). ` +
        `Switching to English ISBN: ${englishIsbn || "none found"}`
    );

    if (englishIsbn && englishIsbn !== isbn) {
      isbn = englishIsbn;
      const [isbndb2R, ol2R, gbIsbn2R] = await Promise.allSettled([
        fetchFromIsbndb(isbn),
        fetchFromOpenLibrary(isbn),
        fetchFromGoogleBooks(isbn)
      ]);
      isbndbData = isbndb2R.status === "fulfilled" ? isbndb2R.value : null;
      olData = ol2R.status === "fulfilled" ? ol2R.value : null;
      gbIsbnData = gbIsbn2R.status === "fulfilled" ? gbIsbn2R.value : null;
      console.log(
        `[fetchAndNormalise] round2 — isbndb:${!!isbndbData} ol:${!!olData} gbIsbn:${!!gbIsbnData}`
      );
    }
  }

  // ── 5. _raw fallback ───────────────────────────────────────────────────────
  let fallbackData = null;
  if (typeof input === "object" && input?._raw) {
    const src = input.source;
    if (src === "isbndb") fallbackData = normaliseISBNdb(input._raw);
    else if (src === "openlibrary")
      fallbackData = normaliseOpenLibrary(input._raw);
    else if (src === "googlebooks")
      fallbackData = normaliseGoogleBooks(input._raw);
    if (fallbackData) fallbackData._source = src;
  }

  // ── 6. Merge — sanitiseDescription rejects non-Latin text ─────────────────
  const merged = mergeBookData([
    isbndbData,
    olData,
    gbIsbnData,
    gbTitleData,
    fallbackData
  ]);

  console.log(
    `[fetchAndNormalise] merged — title:"${merged.title}" desc:${!!merged.description} cover:${!!merged.cover_remote} lang:${merged.language}`
  );

  if (!merged.title) {
    console.error(
      `[fetchAndNormalise] FAILED: no title for isbn=${isbn} title="${inputTitle}"`
    );
    return null;
  }

  if (!merged.description) {
    console.warn(
      `[fetchAndNormalise] WARNING: no description for "${merged.title}". Sources: isbndb=${isbndbData?.description?.slice(0, 30)} ol=${olData?.description?.slice(0, 30)} gb=${gbIsbnData?.description?.slice(0, 30)} gbTitle=${gbTitleData?.description?.slice(0, 30)}`
    );
  }

  // ── 7. Cover — try candidates in order until one uploads ──────────────────
  const isbnForCover = merged.isbn_13 || merged.isbn_10 || isbn;
  const coverCandidates = [
    preview?.cover_preview_url,
    merged.cover_remote,
    isbndbData?.cover_remote,
    gbIsbnData?.cover_remote,
    gbTitleData?.cover_remote,
    olData?.cover_remote,
    isbnForCover
      ? `https://covers.openlibrary.org/b/isbn/${isbnForCover}-L.jpg`
      : null
  ].filter(Boolean);

  let cover_url = null;
  for (const url of coverCandidates) {
    cover_url = await downloadAndUploadCover(url, isbnForCover, supabase);
    if (cover_url) break;
  }

  if (!cover_url) {
    console.warn(
      `[fetchAndNormalise] WARNING: no cover for "${merged.title}" — tried ${coverCandidates.length} URLs`
    );
  }

  // ── 8. Finalise ────────────────────────────────────────────────────────────
  const description = sanitiseDescription(merged.description);
  const published_date = normaliseDate(merged.published_date);
  const is_incomplete =
    !merged.title ||
    !merged.authors?.length ||
    !description ||
    (!merged.isbn_13 && !merged.isbn_10);

  const genres = [
    ...new Set(
      (merged.genres || []).map((g) => g.toLowerCase().trim()).filter(Boolean)
    )
  ].slice(0, 15);

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
    language: "en",
    bookshop_affiliate_link: getBookshopLink(merged.isbn_13) || null,
    source: merged.source || "unknown",
    last_synced_at: new Date().toISOString(),
    is_incomplete,
    ...(typeof input === "object" && input?.hardcover_id
      ? { hardcover_id: String(input.hardcover_id) }
      : {})
  };

  // ── 9. Upsert ──────────────────────────────────────────────────────────────
  const conflictCol = bookData.isbn_13 ? "isbn_13" : "isbn_10";

  if (!bookData.isbn_13 && !bookData.isbn_10) {
    const { data: inserted, error } = await supabase
      .from(TABLES.BOOKS)
      .insert(bookData)
      .select()
      .single();
    if (error) {
      console.error("[fetchAndNormalise] insert error:", error.message);
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
    console.error("[fetchAndNormalise] upsert error:", error.message);
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

  console.log(
    `[fetchAndNormalise] saved "${bookData.title}" id=${upserted?.id} incomplete=${is_incomplete}`
  );
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

    // The edition endpoint rarely has a description — it lives in the work record.
    // Fetch the work to get it if it's missing.
    if (!normalised.description && bookData.works?.[0]?.key) {
      try {
        const workRes = await fetch(
          `https://openlibrary.org${bookData.works[0].key}.json`
        );
        if (workRes.ok) {
          const workData = await workRes.json();
          const rawDesc = workData.description;
          const descStr =
            typeof rawDesc === "string" ? rawDesc : rawDesc?.value || null;
          normalised.description = sanitiseDescription(descStr);
        }
      } catch {
        // Work fetch failed — proceed without description
      }
    }

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
