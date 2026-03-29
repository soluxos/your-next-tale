import { normaliseISBNdb } from "./adapters/isbndb";
import { normaliseOpenLibrary } from "./adapters/openlibrary";
import { TABLES } from "@/lib/supabase/types";

const STALE_DAYS = 30;

/**
 * Fetch and normalise a book by ISBN.
 * 1. Returns cached row if synced within 30 days.
 * 2. Tries ISBNdb, falls back to Open Library.
 * 3. Upserts into the books table and returns the normalised object.
 *
 * @param {string} isbn - Prefer ISBN-13
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @returns {Promise<object|null>} The normalised book or null on failure
 */
export async function fetchAndNormaliseBook(isbn, supabase) {
  // 1. Check cache
  const { data: existing } = await supabase
    .from(TABLES.BOOKS)
    .select("*")
    .eq("isbn_13", isbn)
    .single();

  if (existing?.last_synced_at) {
    const syncedAt = new Date(existing.last_synced_at);
    const ageMs = Date.now() - syncedAt.getTime();
    if (ageMs < STALE_DAYS * 24 * 60 * 60 * 1000) {
      return existing;
    }
  }

  // 2. Try ISBNdb
  let normalised = await tryISBNdb(isbn);

  // 3. Fall back to Open Library
  if (!normalised) {
    normalised = await tryOpenLibrary(isbn);
  }

  if (!normalised) return null;

  // 4. Upsert into books
  const { data: upserted, error } = await supabase
    .from(TABLES.BOOKS)
    .upsert(normalised, { onConflict: "isbn_13" })
    .select()
    .single();

  if (error) {
    console.error("fetchAndNormaliseBook upsert error:", error);
    return null;
  }

  return upserted;
}

async function tryISBNdb(isbn) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://api2.isbndb.com/book/${encodeURIComponent(isbn)}`, {
      headers: { Authorization: apiKey, Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.book) return null;

    return normaliseISBNdb(data.book);
  } catch (e) {
    console.error("ISBNdb fetch error:", e);
    return null;
  }
}

async function tryOpenLibrary(isbn) {
  const baseUrl = process.env.OPENLIBRARY_BASE_URL || "https://openlibrary.org";

  try {
    // Fetch edition by ISBN
    const editionRes = await fetch(`${baseUrl}/isbn/${encodeURIComponent(isbn)}.json`);
    if (!editionRes.ok) return null;

    const edition = await editionRes.json();

    // Fetch linked work for description / subjects
    let work = {};
    const workKey = edition.works?.[0]?.key;
    if (workKey) {
      const workRes = await fetch(`${baseUrl}${workKey}.json`);
      if (workRes.ok) {
        work = await workRes.json();
      }
    }

    // Resolve author names
    const authorKeys = (edition.authors || work.authors || []).map(
      (a) => a.key
    ).filter(Boolean);

    const resolvedAuthors = await Promise.all(
      authorKeys.map(async (key) => {
        try {
          const r = await fetch(`${baseUrl}${key}.json`);
          if (!r.ok) return key;
          const d = await r.json();
          return d.name || key;
        } catch {
          return key;
        }
      })
    );

    edition._resolvedAuthors = resolvedAuthors;

    return normaliseOpenLibrary(edition, work);
  } catch (e) {
    console.error("Open Library fetch error:", e);
    return null;
  }
}
