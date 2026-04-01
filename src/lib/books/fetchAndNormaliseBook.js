import { normaliseISBNdb } from "./adapters/isbndb";
import { normaliseOpenLibrary } from "./adapters/openlibrary";
import { normaliseGoogleBooks } from "./adapters/googlebooks";
import { sanitiseDescription } from "./sanitiseDescription";
import { normaliseLanguage, isEnglish } from "./normaliseLanguage";
import { isEnglishIsbn, isNonEnglishIsbn } from "./isbnUtils";
import { getBookshopLink } from "@/lib/bookshop";
import { TABLES } from "@/lib/supabase/types";

const STALE_DAYS = 30;

/**
 * Fetch book data from all external sources and merge, WITHOUT saving to DB.
 * Returns { merged, sources, coverCandidates, isbn, inputTitle } or null.
 * Used by both the preview endpoint (read-only) and fetchAndNormaliseBook (save).
 */
export async function fetchBookSources(input) {
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

  console.log(`[fetchBookSources] "${inputTitle}" isbn=${isbn}`);

  if (isbn && isNonEnglishIsbn(isbn)) {
    console.warn(
      `[fetchBookSources] Discarding non-English ISBN ${isbn} (prefix: ${isbn.substring(0, 4)})`
    );
    isbn = null;
  }

  // ── 2. Round 1: fetch sources in parallel ─────────────────────────────────
  const isHardcoverSource =
    typeof input === "object" && input?.source === "hardcover";

  const [isbndbR, olR, gbIsbnR, gbTitleR, isbndbTitleR] =
    await Promise.allSettled([
      isbn && !isHardcoverSource
        ? fetchFromIsbndb(isbn)
        : Promise.resolve(null),
      isbn && !isHardcoverSource
        ? fetchFromOpenLibrary(isbn)
        : Promise.resolve(null),
      isbn && !isHardcoverSource
        ? fetchFromGoogleBooks(isbn)
        : Promise.resolve(null),
      inputTitle
        ? fetchFromGoogleBooksByTitle(inputTitle, inputAuthor)
        : Promise.resolve(null),
      inputTitle
        ? fetchFromIsbndbByTitle(inputTitle, inputAuthor)
        : Promise.resolve(null)
    ]);

  let isbndbData = isbndbR.status === "fulfilled" ? isbndbR.value : null;
  let olData = olR.status === "fulfilled" ? olR.value : null;
  let gbIsbnData = gbIsbnR.status === "fulfilled" ? gbIsbnR.value : null;
  let gbTitleData = gbTitleR.status === "fulfilled" ? gbTitleR.value : null;
  let isbndbTitleData =
    isbndbTitleR.status === "fulfilled" ? isbndbTitleR.value : null;

  console.log(
    `[fetchBookSources] round1 — isbndb:${!!isbndbData}(${isbndbData?.language}) ol:${!!olData}(${olData?.language}) gbIsbn:${!!gbIsbnData}(${gbIsbnData?.language}) gbTitle:${!!gbTitleData}(${gbTitleData?.language}) isbndbTitle:${!!isbndbTitleData}(${isbndbTitleData?.language}) hardcoverSource:${isHardcoverSource}`
  );

  // ── 3. Resolve the best English ISBN and re-fetch with it ─────────────────
  const isbnSourcesWithLang = [isbndbData, olData, gbIsbnData].filter(
    (s) => s?.language
  );
  const anyNonEnglish = isbnSourcesWithLang.some((s) => !isEnglish(s.language));
  const needsEnglishRefetch = isHardcoverSource || anyNonEnglish;

  if (needsEnglishRefetch) {
    const englishIsbn =
      gbTitleData?._isEnglishEdition && isEnglishIsbn(gbTitleData?.isbn_13)
        ? gbTitleData.isbn_13
        : isbndbTitleData?._isEnglishEdition &&
            isEnglishIsbn(isbndbTitleData?.isbn_13)
          ? isbndbTitleData.isbn_13
          : null;

    const fetchIsbn = englishIsbn || null;

    console.warn(
      `[fetchBookSources] ${isHardcoverSource ? "Hardcover source" : `non-English ISBN ${isbn}`} — ` +
        `English ISBN: ${englishIsbn || "not found"}${!englishIsbn && isHardcoverSource ? `, falling back to Hardcover ISBN: ${isbn}` : ""}`
    );

    if (fetchIsbn) {
      if (fetchIsbn !== isbn) isbn = fetchIsbn;
      const [isbndb2R, ol2R, gbIsbn2R] = await Promise.allSettled([
        fetchFromIsbndb(isbn),
        fetchFromOpenLibrary(isbn),
        fetchFromGoogleBooks(isbn)
      ]);
      isbndbData = isbndb2R.status === "fulfilled" ? isbndb2R.value : null;
      olData = ol2R.status === "fulfilled" ? ol2R.value : null;
      gbIsbnData = gbIsbn2R.status === "fulfilled" ? gbIsbn2R.value : null;
      console.log(
        `[fetchBookSources] round2 with ISBN ${isbn} — isbndb:${!!isbndbData} ol:${!!olData} gbIsbn:${!!gbIsbnData}`
      );
    }
  }

  // ── 4. Hard English filter ────────────────────────────────────────────────
  const rejectIfNonEnglish = (s) => {
    if (!s?.language) return s;
    if (!isEnglish(s.language)) {
      console.warn(
        `[fetchBookSources] REJECTED lang="${s.language}" title="${s.title}"`
      );
      return null;
    }
    return s;
  };
  isbndbData = rejectIfNonEnglish(isbndbData);
  olData = rejectIfNonEnglish(olData);
  gbIsbnData = rejectIfNonEnglish(gbIsbnData);
  gbTitleData = rejectIfNonEnglish(gbTitleData);
  isbndbTitleData = rejectIfNonEnglish(isbndbTitleData);

  // ── 5. _raw / preview fallback ────────────────────────────────────────────
  let fallbackData = null;
  if (typeof input === "object") {
    const src = input.source;
    if (src === "isbndb" && input._raw) {
      fallbackData = normaliseISBNdb(input._raw);
    } else if (src === "openlibrary" && input._raw) {
      fallbackData = normaliseOpenLibrary(input._raw);
    } else if (src === "googlebooks" && input._raw) {
      fallbackData = normaliseGoogleBooks(input._raw);
    } else if (input.preview?.title) {
      fallbackData = {
        title: input.preview.title,
        authors: input.preview.author ? [input.preview.author] : [],
        isbn_13: input.preview.isbn_13 || null,
        isbn_10: input.preview.isbn_10 || null,
        cover_remote: input.preview.cover_preview_url || null,
        description: null,
        genres: null,
        page_count: null,
        published_date: null,
        publisher: null,
        language: null
      };
    }
    if (fallbackData) fallbackData._source = src || "unknown";
  }

  // ── 6. Merge ──────────────────────────────────────────────────────────────
  const merged = mergeBookData([
    isbndbData,
    olData,
    gbIsbnData,
    gbTitleData,
    isbndbTitleData,
    fallbackData
  ]);

  if (!merged.title && inputTitle) {
    merged.title = inputTitle;
  }

  // ── 7. Build cover candidates list ────────────────────────────────────────
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

  // Dedupe cover URLs
  const seenCovers = new Set();
  const uniqueCovers = [];
  for (const url of coverCandidates) {
    if (!seenCovers.has(url)) {
      seenCovers.add(url);
      uniqueCovers.push(url);
    }
  }

  // ── 8. Collect per-source data for the preview UI ─────────────────────────
  const labelSource = (data, name) => {
    if (!data) return null;
    const desc = data.description
      ? sanitiseDescription(data.description)
      : null;
    return {
      name,
      title: data.title || null,
      authors: data.authors || [],
      description: desc,
      cover_url: data.cover_remote || null,
      isbn_13: data.isbn_13 || null,
      genres: data.genres || [],
      page_count: data.page_count || null,
      published_date: data.published_date || null,
      publisher: data.publisher || null
    };
  };

  const sources = [
    labelSource(isbndbData, "ISBNdb"),
    labelSource(olData, "Open Library"),
    labelSource(gbIsbnData, "Google Books"),
    labelSource(gbTitleData, "Google Books (title)"),
    labelSource(isbndbTitleData, "ISBNdb (title)"),
    labelSource(fallbackData, "Search result")
  ].filter(Boolean);

  return { merged, sources, coverCandidates: uniqueCovers, isbn, inputTitle };
}

export async function fetchAndNormaliseBook(input, supabase) {
  // ── DB cache — only use if fully complete ──────────────────────────────────
  let quickIsbn = null;
  if (typeof input === "string") {
    quickIsbn = input;
  } else {
    quickIsbn =
      input?.preview?.isbn_13 ||
      input?.preview?.isbn_10 ||
      input?._raw?.isbn13 ||
      input?._raw?.isbn ||
      input?._raw?.isbn_13 ||
      input?._raw?.isbn_10 ||
      null;
  }

  if (quickIsbn && !isNonEnglishIsbn(quickIsbn)) {
    const { data: existing } = await supabase
      .from(TABLES.BOOKS)
      .select("*")
      .or(`isbn_13.eq.${quickIsbn},isbn_10.eq.${quickIsbn}`)
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

  // For local source: if already complete return immediately
  if (typeof input === "object" && input?.source === "local" && input?._raw) {
    const raw = input._raw;
    if (!raw.is_incomplete && raw.description && raw.cover_url) return raw;
  }

  // ── Fetch all sources ─────────────────────────────────────────────────────
  const result = await fetchBookSources(input);
  if (!result) return null;

  const { merged, isbn, inputTitle } = result;
  const preview = typeof input === "string" ? null : input?.preview || null;

  if (!merged.title) {
    console.error(
      `[fetchAndNormalise] FAILED: no title for isbn=${isbn} title="${inputTitle}"`
    );
    return null;
  }

  // ── Apply user overrides (chosenDescription / chosenCover) ────────────────
  const chosenDescription = input?.chosenDescription || null;
  const chosenCover = input?.chosenCover || null;

  if (chosenDescription) {
    merged.description = chosenDescription;
  }

  if (!merged.description) {
    console.warn(
      `[fetchAndNormalise] WARNING: no description for "${merged.title}".`
    );
  }

  // ── Cover — try candidates in order until one uploads ─────────────────────
  const isbnForCover = merged.isbn_13 || merged.isbn_10 || isbn;

  // If user chose a specific cover, try that first
  const coverOrder = chosenCover
    ? [chosenCover, ...result.coverCandidates.filter((u) => u !== chosenCover)]
    : [
        preview?.cover_preview_url,
        ...result.coverCandidates.filter(
          (u) => u !== preview?.cover_preview_url
        )
      ];

  let cover_url = null;
  for (const url of coverOrder) {
    if (!url) continue;
    cover_url = await downloadAndUploadCover(url, isbnForCover, supabase);
    if (cover_url) break;
  }

  if (!cover_url) {
    console.warn(
      `[fetchAndNormalise] WARNING: no cover for "${merged.title}" — tried ${coverOrder.length} URLs`
    );
  }

  // ── Finalise ──────────────────────────────────────────────────────────────
  if (merged.isbn_13 && isNonEnglishIsbn(merged.isbn_13)) {
    console.error(
      `[fetchAndNormalise] BLOCKED — merged isbn_13 ${merged.isbn_13} is non-English. Clearing it.`
    );
    merged.isbn_13 = null;
  }

  const description = chosenDescription
    ? sanitiseDescription(chosenDescription)
    : sanitiseDescription(merged.description);
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

  // ── Upsert ────────────────────────────────────────────────────────────────
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
      .filter((v) => {
        // Final safety net — reject non-English descriptions
        if (field === "description") return sanitiseDescription(v) !== null;
        return true;
      })
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

async function fetchFromIsbndbByTitle(title, author) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey || !title) return null;

  try {
    const query = author ? `${title} ${author}` : title;
    const res = await fetch(
      `https://api2.isbndb.com/books/${encodeURIComponent(query)}?pageSize=10`,
      {
        headers: { Authorization: apiKey, Accept: "application/json" }
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const books = data.books || [];
    if (!books.length) return null;

    // Rank by English ISBN and language match
    const scored = books
      .map((b) => {
        let score = 0;
        if (b.isbn13 && isEnglishIsbn(b.isbn13)) score += 200;
        else if (b.isbn13 && isNonEnglishIsbn(b.isbn13)) score -= 500;
        const lang = (b.language || "").toLowerCase();
        if (lang === "en" || lang === "english") score += 50;
        if (b.synopsis || b.overview) score += 40;
        if (b.isbn13) score += 20;
        if (b.image) score += 10;
        return { book: b, score };
      })
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;

    // Phase 2: check top 3 on Bookshop.org
    const top3 = scored.slice(0, 3);
    const bookshopChecks = await Promise.all(
      top3.map(async (candidate) => {
        const onBookshop = candidate.book.isbn13
          ? await isOnBookshop(candidate.book.isbn13)
          : false;
        return {
          ...candidate,
          onBookshop,
          bookshopBonus: onBookshop ? 50 : 0
        };
      })
    );

    const finalRanked = bookshopChecks.sort(
      (a, b) => b.score + b.bookshopBonus - (a.score + a.bookshopBonus)
    );

    console.log(
      `[fetchFromIsbndbByTitle] top candidates:`,
      finalRanked.slice(0, 3).map((c) => {
        return `${c.book.isbn13} score=${c.score} bookshop=${c.onBookshop}`;
      })
    );

    const best = finalRanked[0].book;

    const normalised = normaliseISBNdb(best);
    normalised._source = "isbndb";
    normalised._isEnglishEdition = !!(
      best.isbn13 && isEnglishIsbn(best.isbn13)
    );
    normalised._onBookshop = finalRanked[0].onBookshop;
    return normalised;
  } catch (e) {
    console.error("ISBNdb title search error:", e);
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
    // Some editions belong to multiple works — iterate all until a description is found.
    if (!normalised.description && bookData.works?.length) {
      for (const workRef of bookData.works) {
        if (!workRef.key) continue;
        try {
          const workRes = await fetch(
            `https://openlibrary.org${workRef.key}.json`
          );
          if (!workRes.ok) continue;
          const workData = await workRes.json();
          const rawDesc = workData.description;
          const descStr =
            typeof rawDesc === "string" ? rawDesc : rawDesc?.value || null;
          const sanitised = sanitiseDescription(descStr);
          if (sanitised) {
            normalised.description = sanitised;
            break;
          }
        } catch {
          continue;
        }
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

    // If the description failed sanitisation, null it out so the merge
    // does not use a non-English description as "longest"
    if (normalised.description) {
      const sanitised = sanitiseDescription(normalised.description);
      if (!sanitised) {
        console.warn(
          `[fetchFromGoogleBooks] ISBN ${isbn} description rejected as non-English`
        );
        normalised.description = null;
      }
    }

    return normalised;
  } catch (e) {
    console.error("Google Books fetch error:", e);
    return null;
  }
}

async function isOnBookshop(isbn13) {
  if (!isbn13) return false;
  try {
    const res = await fetch(`https://bookshop.org/a/0/${isbn13}`, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    return res.ok && (res.url || "").includes("/p/books/");
  } catch {
    return false;
  }
}

/** Score a Google Books volumeInfo by data completeness. English is mandatory. */
function scoreEdition(volumeInfo) {
  let score = 0;
  const ids = volumeInfo.industryIdentifiers || [];
  const isbn13 = ids.find((id) => id.type === "ISBN_13")?.identifier;

  // ISBN prefix check — most reliable English signal
  if (isbn13 && isEnglishIsbn(isbn13)) {
    score += 200;
  } else if (isbn13 && isNonEnglishIsbn(isbn13)) {
    score -= 500;
  }

  // Language field check (secondary signal — not always present)
  const lang = (volumeInfo.language || "").toLowerCase();
  if (!lang || lang === "en" || lang.startsWith("en-")) score += 50;

  // Data completeness
  if (volumeInfo.description) score += 40;
  if (isbn13) score += 20;
  if (volumeInfo.imageLinks?.thumbnail) score += 10;

  return score;
}

async function fetchFromGoogleBooksByTitle(title, author) {
  if (!title) return null;
  try {
    const parts = [`intitle:${title}`];
    if (author) parts.push(`inauthor:${author}`);
    const q = parts.join("+");
    // Fetch many candidates so we can rank by data completeness.
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=en&maxResults=10`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const items = (data.items || []).filter((i) => i.volumeInfo);
    if (!items.length) return null;

    // Phase 1: synchronous ranking by data completeness.
    // langRestrict=en is only a hint so we enforce language strictly here.
    const phase1Ranked = items
      .map((item) => {
        const ids = item.volumeInfo.industryIdentifiers || [];
        const hasIsbn = ids.some(
          (id) => id.type === "ISBN_13" || id.type === "ISBN_10"
        );
        return {
          info: item.volumeInfo,
          score: scoreEdition(item.volumeInfo),
          hasIsbn
        };
      })
      .filter((e) => e.hasIsbn && e.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!phase1Ranked.length) {
      const volumeInfo = items[0].volumeInfo;
      if (!volumeInfo) return null;
      const normalised = normaliseGoogleBooks(volumeInfo);
      normalised._source = "googlebooks";
      normalised._isEnglishEdition = false;
      return normalised;
    }

    // Phase 2: check top 3 on Bookshop.org (parallel, ~500ms each)
    const top3 = phase1Ranked.slice(0, 3);
    const bookshopChecks = await Promise.all(
      top3.map(async (candidate) => {
        const isbn13 = (candidate.info.industryIdentifiers || []).find(
          (id) => id.type === "ISBN_13"
        )?.identifier;
        const onBookshop = isbn13 ? await isOnBookshop(isbn13) : false;
        return { ...candidate, onBookshop, bookshopBonus: onBookshop ? 50 : 0 };
      })
    );

    // Re-rank with Bookshop.org bonus applied
    const finalRanked = bookshopChecks.sort(
      (a, b) => b.score + b.bookshopBonus - (a.score + a.bookshopBonus)
    );

    const best = finalRanked[0];
    const bestIsbn13 = (best.info.industryIdentifiers || []).find(
      (id) => id.type === "ISBN_13"
    )?.identifier;

    console.log(
      `[fetchFromGoogleBooksByTitle] top candidates:`,
      finalRanked.slice(0, 3).map((c) => {
        const isbn = (c.info.industryIdentifiers || []).find(
          (i) => i.type === "ISBN_13"
        )?.identifier;
        return `${isbn} score=${c.score} bookshop=${c.onBookshop}`;
      })
    );

    const normalised = normaliseGoogleBooks(best.info);
    normalised._source = "googlebooks";
    normalised._isEnglishEdition = !!(bestIsbn13 && isEnglishIsbn(bestIsbn13));
    normalised._onBookshop = best.onBookshop;
    return normalised;
  } catch (e) {
    console.error("Google Books title search error:", e);
    return null;
  }
}
