import {
  discoverPopularBooks,
  getBookDetails,
  extractGenres,
  extractAuthors,
  cleanTitle
} from "./sources/hardcover";
import { normaliseISBNdb } from "./adapters/isbndb";
import { sanitiseDescription } from "./sanitiseDescription";
import { normaliseLanguage } from "./normaliseLanguage";
import { getBookshopLink } from "../bookshop";

export const SEED_GENRES = [
  { query: "Fantasy", label: "Fantasy", minReaders: 100 },
  { query: "Epic Fantasy", label: "Epic Fantasy", minReaders: 50 },
  { query: "Science Fiction", label: "Sci-Fi", minReaders: 100 },
  { query: "Space Opera", label: "Space Opera", minReaders: 50 },
  { query: "Dystopia", label: "Dystopian", minReaders: 50 },
  { query: "Urban Fantasy", label: "Urban Fantasy", minReaders: 50 },
  { query: "Dark Fantasy", label: "Dark Fantasy", minReaders: 50 },
  { query: "Romantasy", label: "Romantasy", minReaders: 25 }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalise a raw date string to YYYY-MM-DD.
 */
function normaliseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  return null;
}

/**
 * Hardcover-powered seeder: discovers popular books via community read counts,
 * enriches with ISBNdb metadata, and falls back to Hardcover data if ISBNdb misses.
 */
export async function runSeeder({ genres = SEED_GENRES, send, supabase }) {
  const apiKey = process.env.ISBNDB_API_KEY;

  send({
    type: "progress",
    message: `Starting Hardcover discovery for ${genres.length} genres...`
  });

  // 1. Fetch existing books — skip re-processing them
  const { data: existing } = await supabase
    .from("books")
    .select("isbn_13, hardcover_id, is_incomplete");

  const existingByIsbn = new Set(
    (existing || [])
      .filter((b) => !b.is_incomplete && b.isbn_13)
      .map((b) => b.isbn_13)
  );
  const existingByHardcoverId = new Set(
    (existing || [])
      .filter((b) => !b.is_incomplete && b.hardcover_id)
      .map((b) => b.hardcover_id)
  );

  send({
    type: "progress",
    message: `${existingByIsbn.size} complete books in DB (${existingByHardcoverId.size} with Hardcover IDs).`
  });

  // 2. Discover books from Hardcover for each genre
  const discovered = new Map(); // hardcover_id → { ...discoveryData, category }

  for (const { query: genreQuery, label, minReaders } of genres) {
    send({
      type: "progress",
      message: `Discovering "${label}" from Hardcover (min ${minReaders} readers)...`
    });

    try {
      const results = await discoverPopularBooks({
        genreTag: genreQuery,
        targetCount: 50,
        minUsersReadCount: minReaders
      });

      let added = 0;
      for (const r of results) {
        if (!r.hardcover_id) continue;
        if (existingByHardcoverId.has(String(r.hardcover_id))) continue;
        if (r.isbn_13 && existingByIsbn.has(r.isbn_13)) continue;
        if (!discovered.has(r.hardcover_id)) {
          discovered.set(r.hardcover_id, {
            ...r,
            primaryGenre: label.toLowerCase()
          });
          added++;
        } else if (
          r.users_read_count >
          (discovered.get(r.hardcover_id).users_read_count || 0)
        ) {
          discovered.set(r.hardcover_id, {
            ...r,
            primaryGenre: label.toLowerCase()
          });
        }
      }

      send({
        type: "progress",
        message: `  → ${results.length} found, ${added} new books`
      });
    } catch (e) {
      send({
        type: "progress",
        message: `  → Hardcover error: ${e.message}`
      });
    }

    await sleep(1000);
  }

  // 3. Sort by popularity, skip any that are already complete in DB
  const toProcess = [...discovered.values()]
    .filter((r) => !r.isbn_13 || !existingByIsbn.has(r.isbn_13))
    .sort((a, b) => b.users_read_count - a.users_read_count);

  send({
    type: "progress",
    message: `Discovery complete. ${discovered.size} unique books. Processing ${toProcess.length}...`
  });

  const results = {
    processed: 0,
    inserted: 0,
    coverFailures: 0,
    incompleteBooks: 0,
    failed: 0
  };

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];

    const seriesLabel = item.is_standalone
      ? "standalone"
      : `series #${item.series_position}`;

    send({
      type: "progress",
      message: `[${i + 1}/${toProcess.length}] ${item.title || item.hardcover_id} (${item.users_read_count} readers, ${seriesLabel})...`
    });

    try {
      // 4. Get full details from Hardcover
      const details = await getBookDetails(item.hardcover_id);
      await sleep(400);

      const edition = details?.editions?.[0] || null;
      const isbn_13 = edition?.isbn_13 || item.isbn_13 || null;
      const isbn_10 = edition?.isbn_10 || item.isbn_10 || null;

      // Skip if already in DB by ISBN (resolved after fetching isbn_13 from editions)
      if (isbn_13 && existingByIsbn.has(isbn_13)) {
        send({
          type: "progress",
          message: `  [SKIP] ISBN ${isbn_13} already in DB`
        });
        continue;
      }

      // 5. Try ISBNdb enrichment if we have an ISBN
      let isbndbData = null;
      if (isbn_13 && apiKey) {
        try {
          const isbndbRes = await fetch(
            `https://api2.isbndb.com/book/${isbn_13}`,
            { headers: { Authorization: apiKey } }
          );
          if (isbndbRes.ok) {
            const json = await isbndbRes.json();
            if (json.book) isbndbData = normaliseISBNdb(json.book);
          }
        } catch {
          // ISBNdb enrichment failed — continue with Hardcover data
        }
      }

      // 6. Merge data, preferring ISBNdb, falling back to Hardcover
      const hcAuthors =
        extractAuthors(details?.cached_contributors) || item.author_names || [];
      const hcGenres = extractGenres(details?.cached_tags);

      const title = cleanTitle(
        isbndbData?.title || details?.title || item.title
      );
      if (!title) {
        send({ type: "progress", message: "  [SKIP] No title found" });
        results.failed++;
        continue;
      }

      const authors = isbndbData?.authors?.length
        ? isbndbData.authors
        : hcAuthors;

      const description = sanitiseDescription(
        isbndbData?.description || details?.description || null
      );

      const genres = [
        ...new Set(
          [...(isbndbData?.genres || []), ...hcGenres, item.primaryGenre]
            .map((g) => g?.toLowerCase().trim())
            .filter(Boolean)
        )
      ].slice(0, 15);

      const page_count = isbndbData?.page_count || details?.pages || null;

      const published_date = normaliseDate(
        isbndbData?.published_date ||
          edition?.release_date ||
          details?.release_date ||
          null
      );

      const publisher =
        isbndbData?.publisher || edition?.publisher?.name || null;

      const cover_remote =
        isbndbData?.cover_remote ||
        details?.image?.url ||
        item.image_url ||
        null;

      // 7. Upload cover image to Supabase storage
      let cover_url = null;
      if (cover_remote) {
        const isbn = isbn_13 || isbn_10 || String(item.hardcover_id);
        try {
          const coverRes = await fetch(cover_remote);
          if (!coverRes.ok) throw new Error(`HTTP ${coverRes.status}`);

          const contentType = coverRes.headers.get("content-type") || "";
          const contentLength = coverRes.headers.get("content-length");

          if (
            contentType.includes("gif") ||
            (contentLength && parseInt(contentLength) < 500)
          ) {
            throw new Error("Placeholder cover image");
          }

          const ext = contentType.includes("png") ? ".png" : ".jpg";
          const filename = `${isbn}${ext}`;
          const buffer = Buffer.from(await coverRes.arrayBuffer());

          if (buffer.length < 500) throw new Error("Cover too small");

          const { error: uploadError } = await supabase.storage
            .from("books")
            .upload(filename, buffer, { contentType, upsert: true });

          if (uploadError) throw uploadError;
          cover_url = filename;
        } catch (e) {
          send({
            type: "progress",
            message: `  [COVER FAIL] ${e.message}`
          });
          results.coverFailures++;
        }
      } else {
        results.coverFailures++;
      }

      const is_incomplete =
        !title || !authors.length || !description || !cover_url;

      const bookData = {
        isbn_13: isbn_13 || null,
        isbn_10: isbn_10 || null,
        title,
        authors,
        description: description || null,
        cover_url,
        genres,
        page_count,
        published_date,
        publisher,
        language: normaliseLanguage(isbndbData?.language || "en"),
        source: isbndbData ? "isbndb" : "hardcover",
        last_synced_at: new Date().toISOString(),
        is_incomplete,
        bookshop_affiliate_link: getBookshopLink(isbn_13),
        hardcover_id: String(item.hardcover_id)
      };

      const conflictCol = bookData.isbn_13 ? "isbn_13" : "isbn_10";
      const { error: upsertError } =
        bookData.isbn_13 || bookData.isbn_10
          ? await supabase.from("books").upsert(bookData, {
              onConflict: conflictCol,
              ignoreDuplicates: false
            })
          : await supabase.from("books").insert(bookData);

      if (upsertError) {
        send({
          type: "progress",
          message: `  [DB ERROR] ${upsertError.message}`
        });
        results.failed++;
      } else {
        results.inserted++;
        if (is_incomplete) results.incompleteBooks++;
        send({
          type: "progress",
          message: `  [OK] ${title}${is_incomplete ? " (incomplete)" : ""} — ${item.users_read_count} readers`
        });
      }

      results.processed++;
    } catch (e) {
      send({ type: "progress", message: `  [ERROR] ${e.message}` });
      results.failed++;
    }

    await sleep(300);
  }

  send({
    type: "summary",
    data: {
      genresQueried: genres.length,
      totalDiscovered: discovered.size,
      alreadyInDb: existingByIsbn.size,
      processed: results.processed,
      inserted: results.inserted,
      coverFailures: results.coverFailures,
      incompleteBooks: results.incompleteBooks,
      failed: results.failed
    }
  });
}
