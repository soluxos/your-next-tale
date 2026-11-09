// Facts and blurbs for one ISBN from free book APIs that allow display:
// Open Library (no key), and Google Books when GOOGLE_BOOKS_API_KEY is set
// (Google's keyless quota is shared and runs out).
// Server only.
import { politeFetch } from "./retailers/politeFetch";
import { sanitiseDescription } from "@/lib/books/sanitiseDescription";
import { describeWork, sameWork } from "@/lib/books/sameBook";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");

/** "September 29, 2026" / "1 September 2026" / "2026-09-01" → "2026-09-29"; a bare year → null. */
export function exactDate(raw) {
  const s = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  let m = s.match(/^([a-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/i);
  if (m && MONTHS.includes(m[1].toLowerCase())) return `${m[3]}-${pad(MONTHS.indexOf(m[1].toLowerCase()) + 1)}-${pad(m[2])}`;
  m = s.match(/^(\d{1,2}) ([a-z]{3})[a-z]*\.? (\d{4})$/i);
  if (m && MONTHS.includes(m[2].toLowerCase())) return `${m[3]}-${pad(MONTHS.indexOf(m[2].toLowerCase()) + 1)}-${pad(m[1])}`;
  return null;
}

export async function openLibraryFacts(isbn) {
  const text = await politeFetch(`https://openlibrary.org/isbn/${isbn}.json`, { accept: "application/json" });
  if (!text) return null;
  const j = JSON.parse(text);
  const description = typeof j.description === "string" ? j.description : j.description?.value;
  return {
    shop: "openlibrary",
    isbn,
    title: [j.title, j.subtitle].filter(Boolean).join(": ") || null,
    authors: [],
    releaseDate: exactDate(j.publish_date),
    description: sanitiseDescription(description || null),
    pages: Number(j.number_of_pages) || null,
    covers: [],
    genres: [],
    children: false
  };
}

export async function googleBooksFacts(isbn) {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1&key=${key}`, {
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) return null;
  const v = (await res.json()).items?.[0]?.volumeInfo;
  if (!v) return null;
  const categories = (v.categories || []).join(" / ");
  return {
    shop: "googlebooks",
    isbn,
    title: [v.title, v.subtitle].filter(Boolean).join(": ") || null,
    authors: v.authors || [],
    releaseDate: exactDate(v.publishedDate),
    description: sanitiseDescription(v.description || null),
    pages: Number(v.pageCount) || null,
    covers: [],
    genres: [
      ...(/fantasy/i.test(categories) ? ["fantasy"] : []),
      ...(/science fiction/i.test(categories) ? ["science-fiction"] : [])
    ],
    children: /juvenile/i.test(categories)
  };
}

/**
 * The year a work first came out, from Open Library's editions of it, or
 * null if it doesn't know the book. Catches reissues the shops list as new:
 * a new hardback of a 2010 novel.
 */
export async function firstPublishedYear(title, author) {
  const q = new URLSearchParams({ title, author: author || "", fields: "title,author_name,first_publish_year", limit: "10" });
  const text = await politeFetch(`https://openlibrary.org/search.json?${q}`, { accept: "application/json" });
  if (!text) return null;
  const want = describeWork({ title, authors: author ? [author] : [] });
  const years = (JSON.parse(text).docs || [])
    .filter((d) => d.first_publish_year && sameWork(want, describeWork({ title: d.title, authors: d.author_name || [] })))
    .map((d) => d.first_publish_year);
  return years.length ? Math.min(...years) : null;
}
