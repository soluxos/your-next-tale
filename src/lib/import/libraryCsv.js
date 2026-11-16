import { TABLES } from "@/lib/supabase/types";
import { toCsv } from "@/lib/import/csv";
import { GOODREADS_SHELF_FOR } from "@/lib/import/goodreads";

/**
 * Library export. Uses Goodreads' column names (plus "Date Started"), so the
 * file re-imports here, and other book sites that read Goodreads exports
 * accept it too.
 */

export const EXPORT_HEADERS = [
  "Title",
  "Author",
  "Additional Authors",
  "ISBN",
  "ISBN13",
  "My Rating",
  "Exclusive Shelf",
  "Bookshelves",
  "Date Read",
  "Date Added",
  "Date Started",
  "My Review",
  "Number of Pages",
  "Current Page"
];

const PAGE = 1000;

/** Every book in the user's library with its shelves, newest first. */
export async function fetchLibraryForExport(supabase, userId) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(TABLES.USER_BOOKS)
      .select(
        "id, rating, review, progress_pages, date_started, date_finished, created_at, books (title, authors, isbn_13, isbn_10, page_count), bookshelf_books (bookshelf_id)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// Goodreads writes ISBNs as ="0441013597" so spreadsheets keep the digits
// (and leading zeros) instead of turning them into numbers.
function isbnCell(isbn) {
  return isbn ? { value: `="${isbn}"`, raw: true } : { value: '=""', raw: true };
}

/** "2023-05-14" or a timestamp → "2023/05/14" (Goodreads' date format). */
function gDate(value) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "/");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** user_books rows (from fetchLibraryForExport) + shelves → CSV text. */
export function libraryToCsv(userBooks, shelves) {
  const byId = new Map((shelves || []).map((s) => [s.id, s]));
  const lines = [EXPORT_HEADERS];
  for (const ub of userBooks) {
    const book = ub.books;
    if (!book) continue;
    const onShelves = (ub.bookshelf_books || [])
      .map((l) => byId.get(l.bookshelf_id))
      .filter(Boolean);
    const status = onShelves.find((s) => s.is_exclusive);
    const tags = onShelves
      .filter((s) => !s.is_exclusive)
      .map((s) => s.name.replace(/,/g, " ").trim());
    const [author = "", ...others] = book.authors || [];
    lines.push([
      book.title || "",
      author,
      others.join(", "),
      isbnCell(book.isbn_10),
      isbnCell(book.isbn_13),
      ub.rating ? String(ub.rating) : "0",
      status ? GOODREADS_SHELF_FOR[status.slug] || status.slug : "",
      tags.join(", "),
      gDate(ub.date_finished),
      gDate(ub.created_at),
      gDate(ub.date_started),
      ub.review || "",
      book.page_count ? String(book.page_count) : "",
      ub.progress_pages ? String(ub.progress_pages) : ""
    ]);
  }
  return toCsv(lines);
}

/** Hand a CSV string to the browser as a download. */
export function downloadCsv(filename, text) {
  // BOM so Excel opens UTF-8 (accents, curly quotes) correctly.
  const blob = new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
