import { normaliseISBNdb } from "@/lib/books/adapters/isbndb";
import { sanitiseDescription } from "@/lib/books/sanitiseDescription";
import { isEnglish } from "@/lib/books/normaliseLanguage";
import { getBookshopLink } from "@/lib/bookshop";

export const DEFAULT_SUBJECT_TERMS = [
  "epic fantasy",
  "fantasy fiction",
  "high fantasy",
  "sword and sorcery",
  "dark fantasy",
  "urban fantasy",
  "science fiction",
  "space opera",
  "hard science fiction",
  "dystopian fiction",
  "cyberpunk",
  "military science fiction"
];

const ISBNDB_DELAY_MS = 500;
const BATCH_SIZE = 50;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run the book seeder against ISBNdb subjects.
 *
 * @param {{ terms: string[], send: (payload: object) => void, supabase: import("@supabase/supabase-js").SupabaseClient }} opts
 */
export async function runSeeder({ terms, send, supabase }) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey)
    throw new Error("ISBNDB_API_KEY is not set in environment variables");

  // 1. Fetch from ISBNdb for each term
  const allRaw = [];
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    if (i > 0) await delay(ISBNDB_DELAY_MS);

    try {
      const res = await fetch(
        `https://api2.isbndb.com/books/${encodeURIComponent(term)}?page=1&pageSize=50&column=&language=en`,
        { headers: { Authorization: apiKey, Accept: "application/json" } }
      );

      if (!res.ok) {
        send({
          type: "progress",
          message: `[${i + 1}/${terms.length}] Failed to fetch "${term}" — HTTP ${res.status}`
        });
        continue;
      }

      const data = await res.json();
      const books = data.books || [];
      allRaw.push(...books);
      send({
        type: "progress",
        message: `[${i + 1}/${terms.length}] Fetched "${term}" — ${books.length} results`
      });
    } catch (e) {
      send({
        type: "progress",
        message: `[${i + 1}/${terms.length}] Error fetching "${term}": ${e.message}`
      });
    }
  }

  const totalFetched = allRaw.length;
  send({ type: "progress", message: `Total fetched: ${totalFetched}` });

  // 2. Deduplicate by isbn_13
  const seen = new Map();
  for (const raw of allRaw) {
    const isbn = raw.isbn13 && raw.isbn13.length === 13 ? raw.isbn13 : null;
    if (!isbn) continue;
    if (!seen.has(isbn)) seen.set(isbn, raw);
  }

  const allUnique = Array.from(seen.values());
  const uniqueAfterDedup = allUnique.length;

  // Filter to English-language books only
  const uniqueRaw = allUnique.filter(
    (raw) => !raw.language || isEnglish(raw.language)
  );

  // 3. Check which ISBNs already exist in the DB
  const isbnList = uniqueRaw
    .map((r) => (r.isbn13 && r.isbn13.length === 13 ? r.isbn13 : null))
    .filter(Boolean);

  const existingIsbns = new Set();
  // Query in batches to avoid URL length limits
  for (let i = 0; i < isbnList.length; i += 200) {
    const batch = isbnList.slice(i, i + 200);
    const { data: existing } = await supabase
      .from("books")
      .select("isbn_13")
      .in("isbn_13", batch);
    if (existing) {
      for (const row of existing) {
        existingIsbns.add(row.isbn_13);
      }
    }
  }

  const newRaw = uniqueRaw.filter((r) => {
    const isbn = r.isbn13 && r.isbn13.length === 13 ? r.isbn13 : null;
    return isbn && !existingIsbns.has(isbn);
  });

  const skippedLang = uniqueAfterDedup - uniqueRaw.length;
  const alreadyInDb = uniqueRaw.length - newRaw.length;
  send({
    type: "progress",
    message: `${uniqueAfterDedup} unique after dedup. ${skippedLang} skipped (non-English). ${alreadyInDb} already in DB. ${newRaw.length} to process.`
  });

  // 4. Normalise and process each new book
  let coverFailures = 0;
  let incompleteBooks = 0;
  const rows = [];

  for (let i = 0; i < newRaw.length; i++) {
    const raw = newRaw[i];
    const normalised = normaliseISBNdb(raw);
    normalised.description = sanitiseDescription(normalised.description);

    // Download and upload cover
    let coverFilename = null;
    const coverRemote = normalised.cover_remote;
    if (coverRemote) {
      try {
        const coverRes = await fetch(coverRemote);
        if (coverRes.ok) {
          const contentType = coverRes.headers.get("content-type") || "";
          const ext = contentType.includes("png") ? ".png" : ".jpg";
          const filename =
            (normalised.isbn_13 || normalised.isbn_10 || crypto.randomUUID()) +
            ext;

          const buffer = Buffer.from(await coverRes.arrayBuffer());

          if (buffer.length >= 1000) {
            const { error: uploadErr } = await supabase.storage
              .from("books")
              .upload(filename, buffer, {
                contentType: contentType || "image/jpeg",
                upsert: true
              });

            if (!uploadErr) {
              coverFilename = filename;
            } else {
              send({
                type: "progress",
                message: `[COVER UPLOAD FAIL] ${normalised.title}: ${uploadErr.message}`
              });
            }
          }
        }
      } catch (e) {
        // Cover fetch failed — continue without cover
      }
    }

    if (!coverFilename) {
      coverFailures++;
      send({
        type: "progress",
        message: `[COVER FAIL] ${normalised.title || raw.title || "Unknown"}`
      });
    }

    const isIncomplete =
      !normalised.title ||
      !normalised.authors ||
      normalised.authors.length === 0 ||
      !normalised.description ||
      (!normalised.isbn_13 && !normalised.isbn_10) ||
      !coverFilename;

    if (isIncomplete) incompleteBooks++;

    rows.push({
      title: normalised.title,
      authors: normalised.authors,
      description: normalised.description,
      isbn_13: normalised.isbn_13,
      isbn_10: normalised.isbn_10,
      genres: normalised.genres?.length > 0 ? normalised.genres : null,
      page_count: normalised.page_count,
      published_date: normalised.published_date,
      publisher: normalised.publisher,
      language: normalised.language,
      cover_url: coverFilename,
      bookshop_affiliate_link: getBookshopLink(normalised.isbn_13) || null,
      is_incomplete: isIncomplete,
      source: "isbndb",
      last_synced_at: new Date().toISOString()
    });

    if ((i + 1) % 10 === 0) {
      send({
        type: "progress",
        message: `Processed ${i + 1}/${newRaw.length} books...`
      });
    }
  }

  // 5. Batch upsert
  let inserted = 0;
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    send({
      type: "progress",
      message: `Inserting batch ${batchNum}/${totalBatches}...`
    });

    const { data, error } = await supabase
      .from("books")
      .upsert(batch, { onConflict: "isbn_13" })
      .select("id");

    if (error) {
      send({
        type: "progress",
        message: `Batch ${batchNum} error: ${error.message}`
      });
    } else {
      inserted += data?.length || 0;
    }
  }

  // 6. Summary
  send({
    type: "summary",
    data: {
      totalFetched,
      uniqueAfterDedup,
      alreadyInDb,
      processed: newRaw.length,
      inserted,
      coverFailures,
      incompleteBooks
    }
  });
}
