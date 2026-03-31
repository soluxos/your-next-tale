import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TABLES } from "@/lib/supabase/types";
import { normaliseISBNdb } from "@/lib/books/adapters/isbndb";
import { normaliseOpenLibrary } from "@/lib/books/adapters/openlibrary";
import { normaliseGoogleBooks } from "@/lib/books/adapters/googlebooks";
import { searchGoogleBooks } from "@/lib/books/sources/googlebooks";
import { searchHardcover } from "@/lib/books/sources/hardcover";
import { isEnglish } from "@/lib/books/normaliseLanguage";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || !q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const trimmed = q.trim();

  // 1. Local DB search
  const supabase = await createClient();
  const localPromise = supabase
    .from(TABLES.BOOKS)
    .select("id, title, authors, isbn_13, isbn_10, cover_url, is_incomplete")
    .or(`title.ilike.%${trimmed}%,authors.cs.{${trimmed}}`)
    .limit(10);

  // 2. External searches in parallel
  const isbndbPromise = fetchISBNdb(trimmed);
  const openLibraryPromise = fetchOpenLibrary(trimmed);
  const googleBooksPromise = searchGoogleBooks(trimmed, 5);
  const hardcoverPromise = searchHardcover(trimmed);

  const [localResult, isbndbResults, olResults, gbResults, hcResults] =
    await Promise.all([
      localPromise,
      isbndbPromise,
      openLibraryPromise,
      googleBooksPromise,
      hardcoverPromise
    ]);

  const localBooks = localResult.data || [];

  // 3. Collect all results from every source
  const allResults = [];

  for (const book of localBooks) {
    allResults.push({
      source: "local",
      is_incomplete: book.is_incomplete || false,
      _raw: book,
      preview: {
        title: book.title,
        author: book.authors?.[0] || null,
        isbn_13: book.isbn_13,
        isbn_10: book.isbn_10,
        cover_preview_url: book.cover_url
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${book.cover_url}`
          : null
      }
    });
  }

  for (const raw of isbndbResults) {
    const normalised = normaliseISBNdb(raw);
    if (normalised.language && !isEnglish(normalised.language)) continue;
    allResults.push({
      source: "isbndb",
      is_incomplete: checkIncomplete(normalised),
      _raw: raw,
      preview: {
        title: normalised.title,
        author: normalised.authors?.[0] || null,
        isbn_13: normalised.isbn_13,
        isbn_10: normalised.isbn_10,
        cover_preview_url: normalised.cover_remote || null
      }
    });
  }

  for (const doc of olResults) {
    const normalised = normaliseOpenLibrary(doc);
    if (normalised.language && !isEnglish(normalised.language)) continue;
    allResults.push({
      source: "openlibrary",
      is_incomplete: checkIncomplete(normalised),
      _raw: doc,
      preview: {
        title: normalised.title,
        author: normalised.authors?.[0] || null,
        isbn_13: normalised.isbn_13,
        isbn_10: normalised.isbn_10,
        cover_preview_url: normalised.cover_remote || null
      }
    });
  }

  for (const volumeInfo of gbResults) {
    const normalised = normaliseGoogleBooks(volumeInfo);
    if (normalised.language && !isEnglish(normalised.language)) continue;
    allResults.push({
      source: "googlebooks",
      is_incomplete: checkIncomplete(normalised),
      _raw: volumeInfo,
      preview: {
        title: normalised.title,
        author: normalised.authors?.[0] || null,
        isbn_13: normalised.isbn_13,
        isbn_10: normalised.isbn_10,
        cover_preview_url: normalised.cover_remote || null
      }
    });
  }

  for (const result of hcResults) {
    allResults.push(result);
  }

  // 4. Group by normalised title + first author to merge editions
  const groups = new Map();
  for (const result of allResults) {
    const key = dedupeKey(result.preview?.title, result.preview?.author);
    if (!key) {
      groups.set(`_orphan_${groups.size}`, [result]);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(result);
  }

  // 5. Pick best result per group, collect all covers
  const results = [];
  for (const [, group] of groups) {
    group.sort((a, b) => {
      if (a.source === "local" && b.source !== "local") return -1;
      if (b.source === "local" && a.source !== "local") return 1;
      if (a.source === "hardcover" && b.source !== "hardcover") return -1;
      if (b.source === "hardcover" && a.source !== "hardcover") return 1;
      const score = (r) => {
        let s = 0;
        if (r.preview?.cover_preview_url) s += 2;
        if (r.preview?.isbn_13) s += 1;
        if (r.preview?.author) s += 1;
        if (!r.is_incomplete) s += 1;
        if (r.source === "hardcover") s += 15;
        if ((r.preview?.users_read_count || 0) > 1000) s += 10;
        else if ((r.preview?.users_read_count || 0) > 100) s += 5;
        return s;
      };
      return score(b) - score(a);
    });

    const best = { ...group[0], preview: { ...group[0].preview } };

    const allCovers = [];
    const seenCovers = new Set();
    for (const r of group) {
      const url = r.preview?.cover_preview_url;
      if (url && !seenCovers.has(url)) {
        seenCovers.add(url);
        allCovers.push(url);
      }
    }
    best.preview.all_covers = allCovers;

    if (!best.preview.isbn_13) {
      for (const r of group) {
        if (r.preview?.isbn_13) {
          best.preview.isbn_13 = r.preview.isbn_13;
          break;
        }
      }
    }

    results.push(best);
  }

  return NextResponse.json({ results: results.slice(0, 20) });
}

function dedupeKey(title, author) {
  const t = (title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = (author || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return t ? `${t}::${a}` : "";
}

function checkIncomplete(normalised) {
  if (!normalised.title) return true;
  if (!normalised.authors || normalised.authors.length === 0) return true;
  if (!normalised.description) return true;
  if (!normalised.isbn_13 && !normalised.isbn_10) return true;
  if (!normalised.cover_remote) return true;
  return false;
}

async function fetchISBNdb(query) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey) {
    console.error("ISBNDB_API_KEY is not set — skipping ISBNdb source");
    return [];
  }

  try {
    const url = `https://api2.isbndb.com/books/${encodeURIComponent(query)}?page=1&pageSize=5&column=title&language=en`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey, Accept: "application/json" }
    });
    if (!res.ok) return [];

    const data = await res.json();
    return data.books || [];
  } catch (e) {
    console.error("ISBNdb search error:", e);
    return [];
  }
}

async function fetchOpenLibrary(query) {
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=5&language=eng`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return data.docs || [];
  } catch (e) {
    console.error("Open Library search error:", e);
    return [];
  }
}
