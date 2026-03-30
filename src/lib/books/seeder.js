import { discoverBySubject } from "./sources/openLibraryDiscover";
import { discoverBySubjectGoogle } from "./sources/googleBooksDiscover";
import { normaliseISBNdb } from "./adapters/isbndb";
import { normaliseOpenLibrary } from "./adapters/openlibrary";
import { sanitiseDescription } from "./sanitiseDescription";
import { normaliseLanguage } from "./normaliseLanguage";
import { getBookshopLink } from "../bookshop";

export const SEED_SUBJECTS = [
  { subject: "fantasy", label: "Fantasy", minEditions: 8 },
  { subject: "epic fantasy", label: "Epic Fantasy", minEditions: 5 },
  { subject: "science fiction", label: "Sci-Fi", minEditions: 8 },
  { subject: "space opera", label: "Space Opera", minEditions: 5 },
  { subject: "dystopian fiction", label: "Dystopian", minEditions: 5 },
  { subject: "urban fantasy", label: "Urban Fantasy", minEditions: 5 },
  { subject: "dark fantasy", label: "Dark Fantasy", minEditions: 5 },
  { subject: "romantasy", label: "Romantasy", minEditions: 3 }
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
 * Multi-source seeder: discovers popular books via Open Library edition count
 * and Google Books relevance, then enriches each with ISBNdb metadata.
 */
export async function runSeeder({ subjects = SEED_SUBJECTS, send, supabase }) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey) throw new Error("ISBNDB_API_KEY is not set");

  send({
    type: "progress",
    message: `Starting discovery for ${subjects.length} subjects...`
  });

  // 1. Fetch all existing isbn_13s — skip already-complete books
  const { data: existing } = await supabase
    .from("books")
    .select("isbn_13, is_incomplete");

  const existingComplete = new Set(
    (existing || []).filter((b) => !b.is_incomplete).map((b) => b.isbn_13)
  );

  send({
    type: "progress",
    message: `${existingComplete.size} complete books already in DB.`
  });

  // 2. Discover ISBNs from all subjects
  const discovered = new Map();

  for (const { subject, label, minEditions } of subjects) {
    // Open Library
    send({
      type: "progress",
      message: `Discovering "${label}" from Open Library...`
    });

    try {
      const olResults = await discoverBySubject(subject, { minEditions });
      let added = 0;
      for (const r of olResults) {
        const isbn = r.isbn_13 || r.isbn_10;
        if (!isbn || existingComplete.has(r.isbn_13)) continue;
        if (!discovered.has(isbn)) {
          discovered.set(isbn, { ...r, category: label.toLowerCase() });
          added++;
        } else if (
          r.edition_count > (discovered.get(isbn).edition_count || 0)
        ) {
          discovered.set(isbn, { ...r, category: label.toLowerCase() });
        }
      }
      send({
        type: "progress",
        message: `  → ${olResults.length} found, ${added} new ISBNs`
      });
    } catch (e) {
      send({
        type: "progress",
        message: `  → Open Library error: ${e.message}`
      });
    }

    await sleep(1000);

    // Google Books
    send({
      type: "progress",
      message: `  Discovering "${label}" from Google Books...`
    });
    try {
      const gbResults = await discoverBySubjectGoogle(subject);
      let gbAdded = 0;
      for (const r of gbResults) {
        const isbn = r.isbn_13 || r.isbn_10;
        if (!isbn || existingComplete.has(r.isbn_13)) continue;
        if (!discovered.has(isbn)) {
          discovered.set(isbn, { ...r, category: label.toLowerCase() });
          gbAdded++;
        }
      }
      send({
        type: "progress",
        message: `  → ${gbResults.length} found, ${gbAdded} new ISBNs`
      });
    } catch (e) {
      send({
        type: "progress",
        message: `  → Google Books error: ${e.message}`
      });
    }

    await sleep(500);
  }

  // 3. Filter and sort by edition_count (most popular first)
  const toProcess = [...discovered.values()].filter(
    (r) => !existingComplete.has(r.isbn_13)
  );
  toProcess.sort((a, b) => (b.edition_count || 0) - (a.edition_count || 0));

  send({
    type: "progress",
    message: `Discovery complete. ${discovered.size} unique ISBNs. Processing ${toProcess.length} new books...`
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
    const isbn = item.isbn_13 || item.isbn_10;

    send({
      type: "progress",
      message: `[${i + 1}/${toProcess.length}] ${item.ol_preview?.title || item.google_preview?.title || isbn}...`
    });

    try {
      // 4. Fetch full data from ISBNdb single-book endpoint
      let adapted = null;

      const isbndbRes = await fetch(`https://api2.isbndb.com/book/${isbn}`, {
        headers: { Authorization: apiKey }
      });

      if (isbndbRes.ok) {
        const isbndbData = await isbndbRes.json();
        if (isbndbData.book) {
          adapted = normaliseISBNdb(isbndbData.book);
        }
      }

      // 5. Fall back to Open Library if ISBNdb had nothing or missing description
      if ((!adapted || !adapted.description) && isbn) {
        try {
          const olRes = await fetch(
            `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
          );
          if (olRes.ok) {
            const olData = await olRes.json();
            const olBook = olData[`ISBN:${isbn}`];
            if (olBook) {
              const olAdapted = normaliseOpenLibrary(olBook);
              if (!adapted) {
                adapted = olAdapted;
              } else {
                adapted.description =
                  adapted.description || olAdapted.description;
                adapted.genres = [
                  ...new Set([
                    ...(adapted.genres || []),
                    ...(olAdapted.genres || [])
                  ])
                ];
                adapted.cover_remote =
                  adapted.cover_remote || olAdapted.cover_remote;
              }
            }
          }
        } catch {
          // OL fallback failed — continue
        }
      }

      // If still nothing, use preview data from discovery
      if (!adapted) {
        const preview = item.ol_preview || item.google_preview;
        if (preview) {
          adapted = {
            title: preview.title,
            authors: preview.authors || [],
            description: preview.description || null,
            isbn_13: item.isbn_13,
            isbn_10: item.isbn_10,
            genres: preview.subjects || preview.categories || [],
            page_count: preview.page_count || null,
            published_date: preview.first_publish_year
              ? `${preview.first_publish_year}-01-01`
              : preview.published_date || null,
            publisher: preview.publisher || null,
            language: "en",
            cover_remote: preview.cover_id
              ? `https://covers.openlibrary.org/b/id/${preview.cover_id}-L.jpg`
              : preview.cover_url || null,
            _source: "discovery_preview"
          };
        }
      }

      if (!adapted?.title) {
        send({ type: "progress", message: "  [SKIP] No title found" });
        results.failed++;
        await sleep(300);
        continue;
      }

      // Include the discovered category in genres
      const genres = [
        ...new Set(
          [...(adapted.genres || []), item.category]
            .map((g) => g?.toLowerCase().trim())
            .filter(Boolean)
        )
      ].slice(0, 15);

      const description = sanitiseDescription(adapted.description);

      // 6. Cover image
      let cover_url = null;
      const coverRemote =
        adapted.cover_remote ||
        (item.ol_preview?.cover_id
          ? `https://covers.openlibrary.org/b/id/${item.ol_preview.cover_id}-L.jpg`
          : null);

      if (coverRemote) {
        try {
          const coverRes = await fetch(coverRemote);
          if (!coverRes.ok) throw new Error(`HTTP ${coverRes.status}`);

          const contentType = coverRes.headers.get("content-type") || "";
          const contentLength = coverRes.headers.get("content-length");

          // Reject Open Library placeholder GIFs (tiny, < 500 bytes)
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
        !adapted.title ||
        !adapted.authors?.length ||
        !description ||
        !cover_url;

      const bookData = {
        isbn_13: adapted.isbn_13 || item.isbn_13 || null,
        isbn_10: adapted.isbn_10 || item.isbn_10 || null,
        title: adapted.title,
        authors: adapted.authors || [],
        description: description || null,
        cover_url,
        genres,
        page_count: adapted.page_count || null,
        published_date: normaliseDate(adapted.published_date),
        publisher: adapted.publisher || null,
        language: normaliseLanguage(adapted.language),
        source: adapted._source || "isbndb",
        last_synced_at: new Date().toISOString(),
        is_incomplete,
        bookshop_affiliate_link: getBookshopLink(
          adapted.isbn_13 || item.isbn_13
        )
      };

      const conflictCol = bookData.isbn_13 ? "isbn_13" : "isbn_10";
      const { error: upsertError } = await supabase
        .from("books")
        .upsert(bookData, {
          onConflict: conflictCol,
          ignoreDuplicates: false
        });

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
          message: `  [OK] ${adapted.title}${is_incomplete ? " (incomplete)" : ""} — ${item.edition_count || 0} editions`
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
      subjectsQueried: subjects.length,
      totalDiscovered: discovered.size,
      alreadyInDb: existingComplete.size,
      processed: results.processed,
      inserted: results.inserted,
      coverFailures: results.coverFailures,
      incompleteBooks: results.incompleteBooks,
      failed: results.failed
    }
  });
}
