"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import BookCover from "@/components/book/BookCover";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { createShelf, getUserShelves } from "@/lib/bookshelves";
import { updateUserBook } from "@/lib/userBooks";
import { TABLES } from "@/lib/supabase/types";
import { normalise, describeWork, sameWork } from "@/lib/books/sameBook";
import { isEnglishIsbn, isNonEnglishIsbn } from "@/lib/books/isbnUtils";
import {
  parseLibraryCsv,
  planImport,
  rowPreview,
  catalogResult,
  sameBookAs,
  STATUS_SLUGS,
  ImportFormatError
} from "@/lib/import/goodreads";
import {
  fetchLibraryForExport,
  libraryToCsv,
  downloadCsv
} from "@/lib/import/libraryCsv";

/**
 * "Import & export" — bring a Goodreads library in, or take yours out.
 *
 *   choose → checking → preview → importing → done
 *
 * Nothing is written until the reader has seen the preview (matched / need
 * lookup / skipped) and pressed Import. Writes go through LibraryProvider's
 * addBook (status-shelf rules, no duplicate copies) and updateUserBook, both
 * silent, so an import doesn't flood followers' feeds.
 */

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MATCH_CHUNK = 500;
const LOOKUP_WORKERS = 3;
const PAGE_SIZE = 60;
// The last import's undo log (rows inserted / changed), kept in this browser.
export const IMPORT_LOG_KEY = "ynt:last-import-log";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "matched", label: "Matched" },
  { id: "lookup", label: "Need lookup" },
  { id: "skipped", label: "Skipped" }
];

export default function ImportLibraryDialog({ open, onClose }) {
  const library = useLibrary();
  const { profile } = useAuth();
  const supabase = useRef(createClient()).current;

  const [step, setStep] = useState("choose");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState(null);
  const [checked, setChecked] = useState({ done: 0, total: 0 });
  const [parsed, setParsed] = useState(null); // { rows, skipped }
  const [plan, setPlan] = useState([]);
  const [fillOwned, setFillOwned] = useState(true);
  const [filter, setFilter] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const fileRef = useRef(null);
  const cancelRef = useRef(false);
  const running = step === "checking" || step === "importing";

  // Fresh start each time it opens (unless an import is still running)
  useEffect(() => {
    if (!open || running) return;
    if (step === "done") reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Leaving mid-import would stop it — ask first
  useEffect(() => {
    if (step !== "importing") return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  function reset() {
    setStep("choose");
    setFileName("");
    setError(null);
    setParsed(null);
    setPlan([]);
    setFillOwned(true);
    setFilter("all");
    setVisible(PAGE_SIZE);
    setProgress(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Choose + check ───────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    setError(null);
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("Choose a .csv file — Goodreads exports your library as CSV.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is too big. Library exports are usually under 5 MB.");
      return;
    }

    let data;
    try {
      data = parseLibraryCsv(await file.text());
    } catch (e) {
      setError(
        e instanceof ImportFormatError ? e.message : "We couldn’t read that file."
      );
      return;
    }
    if (!data.rows.length) {
      setError("We couldn’t find any books in that file.");
      return;
    }

    setFileName(file.name);
    setParsed(data);
    setStep("checking");
    setChecked({ done: 0, total: data.rows.length });

    try {
      const matches = {};
      for (let i = 0; i < data.rows.length; i += MATCH_CHUNK) {
        const chunk = data.rows.slice(i, i + MATCH_CHUNK);
        const res = await fetch("/api/books/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ books: chunk.map(rowPreview) })
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
        const { matches: found } = await res.json();
        for (const [j, book] of Object.entries(found || {})) {
          matches[i + Number(j)] = book;
        }
        setChecked({ done: Math.min(i + MATCH_CHUNK, data.rows.length), total: data.rows.length });
      }
      setPlan(planImport(data.rows, matches, library.findEntry));
      setStep("preview");
    } catch (e) {
      console.error("[import] match failed", e);
      setError(e.message || "We couldn’t check your books against the catalogue. Try again.");
      setStep("choose");
    }
  }

  // ── Preview numbers ──────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const by = { matched: [], lookup: [], owned: [], skipped: [] };
    for (const item of plan) by[item.kind].push(item);
    const toImport = [...by.matched, ...by.lookup, ...(fillOwned ? by.owned : [])];
    const statusCounts = Object.fromEntries(STATUS_SLUGS.map((s) => [s, 0]));
    const tagNames = new Map();
    let ratings = 0;
    let reviews = 0;
    for (const { row } of toImport) {
      statusCounts[row.status] += 1;
      for (const t of row.tags) if (!tagNames.has(t.slug)) tagNames.set(t.slug, t.name);
      if (row.rating) ratings += 1;
      if (row.review) reviews += 1;
    }
    const existing = new Set(library.customShelves.map((s) => s.slug));
    const existingNames = new Set(library.customShelves.map((s) => normalise(s.name)));
    const newShelves = [...tagNames]
      .filter(([slug, name]) => !existing.has(slug) && !existingNames.has(normalise(name)))
      .map(([, name]) => name);
    const skippedCount =
      (parsed?.skipped.length || 0) + by.skipped.length + (fillOwned ? 0 : by.owned.length);
    return { by, toImport, statusCounts, newShelves, ratings, reviews, skippedCount };
  }, [plan, fillOwned, library.customShelves, parsed]);

  const listRows = useMemo(() => {
    const skippedRows = [
      ...(parsed?.skipped || []).map((s) => ({ kind: "skipped", row: { line: s.line, title: s.title, authors: [] }, reason: s.reason })),
      ...summary.by.skipped,
      ...(fillOwned ? [] : summary.by.owned.map((o) => ({ ...o, reason: "Already on your shelves" })))
    ];
    const ownedUpdates = fillOwned ? summary.by.owned : [];
    const sets = {
      matched: [...summary.by.matched, ...ownedUpdates],
      lookup: summary.by.lookup,
      skipped: skippedRows
    };
    const list = filter === "all" ? [...sets.matched, ...sets.lookup, ...sets.skipped] : sets[filter];
    return list.sort((a, b) => a.row.line - b.row.line);
  }, [filter, summary, parsed, fillOwned]);

  const statusName = (slug) =>
    library.statusShelves.find((s) => s.slug === slug)?.name || slug;

  // ── Import ───────────────────────────────────────────────────────────────
  // `retry`: books that failed part-way may already be on a shelf — finish
  // them (fill in what's missing) rather than skipping them.
  async function runImport(items, { retry = false } = {}) {
    const { addBook, statusShelves, customShelves, entryForBook, statusShelfFor } = library;
    const userId = library.userId;
    cancelRef.current = false;
    setStep("importing");

    const out = { added: 0, filled: 0, unchanged: 0, skipped: [], failed: [], conflicts: [], shelvesCreated: [] };
    // Undo log: every row this import inserts or changes, saved as it goes.
    const log = {
      version: 1,
      userId,
      fileName,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      shelvesCreated: [], // bookshelves.id
      newUserBooks: [], // { userBookId, bookId, line } — delete links, then row
      addedLinks: [], // { userBookId, shelfId } on books you already had
      filled: [], // { userBookId, before: { field: previous value } }
      lookups: [] // { line, bookId, used } — catalogue rows lookups returned
    };
    const saveLog = () => {
      try {
        localStorage.setItem(IMPORT_LOG_KEY, JSON.stringify(log));
      } catch {
        // Private mode / storage full — the import itself still works.
      }
    };
    saveLog();

    // Oldest first: each book goes to the front of its shelf, so the most
    // recently added on Goodreads end up on top here too.
    const queue = [...items].sort(
      (a, b) =>
        (a.row.dateAdded || "").localeCompare(b.row.dateAdded || "") ||
        b.row.line - a.row.line
    );

    try {
      // 1. Shelves: reuse yours (same name), create the rest — quietly.
      const statusBySlug = new Map(statusShelves.map((s) => [s.slug, s]));
      const tagShelves = new Map();
      let known = [...customShelves];
      const findShelf = (t) =>
        known.find((s) => s.slug === t.slug) ||
        known.find((s) => normalise(s.name) === normalise(t.name));
      const wanted = new Map();
      for (const { row } of queue) for (const t of row.tags) wanted.set(t.slug, t);
      const created = [];
      for (const t of wanted.values()) {
        let shelf = findShelf(t);
        if (!shelf) {
          setProgress({ phase: "Creating shelves", done: created.length, total: wanted.size, current: t.name });
          try {
            shelf = await createShelf(supabase, userId, { name: t.name }, { silent: true });
            created.push(shelf);
            log.shelvesCreated.push(shelf.id);
            saveLog();
          } catch {
            // Most likely a shelf with this slug appeared meanwhile — reload.
            known = (await getUserShelves(supabase, userId)).filter((s) => !s.is_exclusive);
            shelf = findShelf(t);
          }
        }
        if (shelf) tagShelves.set(t.slug, shelf);
      }
      if (created.length) {
        library.setShelves((prev) => [...prev, ...created.filter((c) => !prev.some((p) => p.id === c.id))]);
        out.shelvesCreated = created.map((s) => s.name);
      }

      // 2. Look up books we don't have yet (a few at a time — slow sources).
      //    Strict: only books an online source actually found, and only if
      //    what came back is the same book. Nothing is made up from the CSV.
      const lookups = queue.filter((it) => it.kind === "lookup");
      const resolved = new Map();
      const lookupErrors = new Map();
      let looked = 0;
      const next = [...lookups];
      async function worker() {
        while (next.length && !cancelRef.current) {
          const item = next.shift();
          try {
            // No usable ISBN in the file (none, or a non-English edition's):
            // find the English edition with the app's online search and look
            // that up. If search has nothing, the server looks the title up
            // itself (ISBNdb). Either way it must be the same book.
            let preview = rowPreview(item.row);
            const foreign = !!preview.isbn_13 && isNonEnglishIsbn(preview.isbn_13);
            const viaSearch = foreign || (!preview.isbn_13 && !preview.isbn_10);
            if (viaSearch) {
              const hit = await findOnline(item.row);
              preview = { ...preview, isbn_13: hit?.isbn_13 || null, isbn_10: hit?.isbn_10 || null };
            }
            const lookUp = async (p) => {
              const res = await fetch("/api/books/normalise", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // The server applies the same same-book check before saving,
                // so a rejected edition never reaches the catalogue.
                body: JSON.stringify({
                  source: "goodreads",
                  strict: true,
                  match: viaSearch ? "work" : "edition",
                  preview: p,
                  _raw: p
                })
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok || !data.book?.id) {
                return { error: res.status === 422 ? "Not found online" : data.error || "Lookup failed" };
              }
              // An ISBN from search (not your file) needs the titles to agree.
              const used = viaSearch
                ? sameWork(item.row.work, describeWork(data.book))
                : sameBookAs(item.row, data.book);
              log.lookups.push({ line: item.row.line, bookId: data.book.id, used });
              saveLog();
              return used
                ? { book: data.book }
                : { error: `Online match was a different book (“${data.book.title}”)` };
            };
            let found = await lookUp(preview);
            // The edition search suggested didn't check out (often a foreign
            // or audio edition) — let the server look the title up instead.
            if (!found.book && viaSearch && (preview.isbn_13 || preview.isbn_10)) {
              found = await lookUp({ ...preview, isbn_13: null, isbn_10: null });
            }
            if (!found.book) throw new Error(found.error);
            resolved.set(item, found.book);
          } catch (e) {
            lookupErrors.set(item, e.message);
          }
          looked += 1;
          setProgress({ phase: "Looking up books", done: looked, total: lookups.length, current: item.row.title });
        }
      }
      if (lookups.length) {
        setProgress({ phase: "Looking up books", done: 0, total: lookups.length, current: lookups[0].row.title });
        await Promise.all(Array.from({ length: LOOKUP_WORKERS }, worker));
      }

      // 3. Shelve them, one at a time (keeps shelf order exact).
      const shelved = new Set();
      for (let i = 0; i < queue.length; i++) {
        if (cancelRef.current) break;
        const item = queue[i];
        const { row } = item;
        setProgress({ phase: "Adding to your shelves", done: i, total: queue.length, current: row.title });
        try {
          let book = item.book || resolved.get(item) || null;
          if (!book && item.entry) {
            const { data } = await supabase
              .from(TABLES.BOOKS)
              .select("id, title, authors, isbn_13, isbn_10, cover_url, is_incomplete")
              .eq("id", item.entry.bookId)
              .single();
            book = data;
          }
          if (!book) throw new Error(lookupErrors.get(item) || "We couldn’t find this book");

          // A lookup can land on one an earlier row just added.
          if (shelved.has(book.id)) {
            out.skipped.push({ line: row.line, title: row.title, reason: "Same book as another row" });
            continue;
          }
          shelved.add(book.id);
          const status = statusBySlug.get(row.status) || statusBySlug.get("want-to-read");

          // ── A book you already had: keep yours, fill in only what's empty.
          const entry = item.entry || entryForBook(book);
          if (entry) {
            if (!fillOwned && !retry) {
              out.skipped.push({ line: row.line, title: row.title, reason: "Already on your shelves" });
              continue;
            }
            const changed = await fillInOwned({ row, book, entry, status, tagShelves });
            if (changed) out.filled += 1;
            else out.unchanged += 1;
            continue;
          }

          // ── A new book.
          const res = await addBook({ book, result: catalogResult(book) }, status.id, { silent: true });
          const userBookId = res.entry?.userBookId;
          if (res.isNewToLibrary && userBookId) {
            log.newUserBooks.push({ userBookId, bookId: res.book.id, line: row.line });
            saveLog();
          }
          for (const t of row.tags) {
            const shelf = tagShelves.get(t.slug);
            if (shelf) await addBook({ book: res.book }, shelf.id, { silent: true });
          }

          const fields = {};
          if (row.rating) fields.rating = row.rating;
          if (row.review) fields.review = row.review;
          if (row.status === "read" && row.dateRead) fields.date_finished = row.dateRead;
          if (row.dateStarted) fields.date_started = row.dateStarted;
          if (res.isNewToLibrary && row.dateAdded) {
            fields.created_at = `${row.dateAdded}T12:00:00.000Z`;
          }
          if (userBookId && Object.keys(fields).length) {
            try {
              await updateUserBook(supabase, userBookId, fields, null, { silent: true });
            } catch (e) {
              // Date added is a nice-to-have — never lose a rating or
              // review over it.
              if (!fields.created_at) throw e;
              const { created_at: _skip, ...rest } = fields;
              if (Object.keys(rest).length) {
                await updateUserBook(supabase, userBookId, rest, null, { silent: true });
              }
            }
          }
          out.added += 1;
        } catch (e) {
          console.error("[import] row failed", row.line, e);
          out.failed.push({ item, message: e.message || "Something went wrong" });
        }
      }
      setProgress({ phase: "Adding to your shelves", done: queue.length, total: queue.length });
    } catch (e) {
      console.error("[import] failed", e);
      out.error = e.message || "The import stopped unexpectedly.";
    }

    log.finishedAt = new Date().toISOString();
    log.stopped = cancelRef.current;
    saveLog();
    out.stopped = cancelRef.current;
    setResult(out);
    setStep("done");
    library.refresh();

    /**
     * Fill in a book that was already on your shelves. Your shelf, rating,
     * review and dates win; Goodreads only fills what's empty. Differences
     * are reported, never overwritten. Returns true if anything changed.
     */
    async function fillInOwned({ row, book, entry, status, tagShelves }) {
      const { data: cur, error } = await supabase
        .from(TABLES.USER_BOOKS)
        .select("id, rating, review, date_started, date_finished")
        .eq("id", entry.userBookId)
        .single();
      if (error || !cur) throw new Error("Couldn’t read your copy of this book");

      const notes = [];
      const yourStatus = statusShelfFor(entry);
      const hasStatus = !!yourStatus?.is_exclusive;
      const effectiveStatus = hasStatus ? yourStatus.slug : row.status;
      if (hasStatus && yourStatus.slug !== row.status) {
        notes.push(`Shelf: yours ${yourStatus.name}, Goodreads ${statusName(row.status)}`);
      }

      const fields = {};
      if (row.rating) {
        if (cur.rating == null) fields.rating = row.rating;
        else if (cur.rating !== row.rating) notes.push(`Rating: yours ${cur.rating}★, Goodreads ${row.rating}★`);
      }
      if (row.review) {
        if (!cur.review?.trim()) fields.review = row.review;
        else if (cur.review.trim() !== row.review.trim()) notes.push("Review: kept yours");
      }
      if (row.status === "read" && row.dateRead) {
        if (effectiveStatus !== "read") notes.push(`Date read ${row.dateRead} not added (not on your Read shelf)`);
        else if (!cur.date_finished) fields.date_finished = row.dateRead;
        else if (cur.date_finished !== row.dateRead) notes.push(`Date read: yours ${cur.date_finished}, Goodreads ${row.dateRead}`);
      }
      if (row.dateStarted) {
        if (!cur.date_started) fields.date_started = row.dateStarted;
        else if (cur.date_started !== row.dateStarted) notes.push(`Date started: yours ${cur.date_started}, Goodreads ${row.dateStarted}`);
      }
      if (notes.length) out.conflicts.push({ line: row.line, title: row.title, notes });

      const newShelfIds = [
        ...(hasStatus ? [] : [status.id]),
        ...row.tags
          .map((t) => tagShelves.get(t.slug)?.id)
          .filter((id) => id && !entry.shelfIds.includes(id))
      ];
      if (!newShelfIds.length && !Object.keys(fields).length) return false;

      // Log before writing, so even a half-finished change can be undone.
      for (const shelfId of newShelfIds) log.addedLinks.push({ userBookId: entry.userBookId, shelfId });
      if (Object.keys(fields).length) {
        log.filled.push({
          userBookId: entry.userBookId,
          before: Object.fromEntries(Object.keys(fields).map((k) => [k, cur[k] ?? null]))
        });
      }
      saveLog();

      for (const shelfId of newShelfIds) {
        await addBook({ book }, shelfId, { silent: true });
      }
      if (Object.keys(fields).length) {
        await updateUserBook(supabase, entry.userBookId, fields, null, { silent: true });
      }
      return true;
    }
  }

  /** The app's online search → { isbn_13, isbn_10 } of the same book, or null. */
  async function findOnline(row) {
    const q = [row.searchTitle, row.authors[0]].filter(Boolean).join(" ");
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}&source=online`);
        if (!res.ok) continue;
        const { results = [] } = await res.json();
        const hits = results
          .map((r) => r.preview || {})
          .filter((p) => (p.isbn_13 || p.isbn_10) && sameWork(row.work, describeWork(p)))
          .filter((p) => !p.isbn_13 || !isNonEnglishIsbn(p.isbn_13))
          // English editions first — other editions often aren't confirmable.
          .sort((a, b) => isEnglishIsbn(b.isbn_13) - isEnglishIsbn(a.isbn_13));
        if (hits.length) return hits[0];
      } catch {
        // try once more
      }
    }
    return null;
  }

  // ── Export ───────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const rows = await fetchLibraryForExport(supabase, library.userId);
      const csv = libraryToCsv(rows, library.shelves);
      const date = new Date().toISOString().slice(0, 10);
      downloadCsv(`your-next-tale-library-${date}.csv`, csv);
    } catch (e) {
      console.error("[export] failed", e);
      setExportError("We couldn’t export your library. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const bookcaseHref = profile?.username ? `/u/${encodeURIComponent(profile.username)}` : "/account";
  const libraryCount = library.entries.size;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o && !running) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] p-0 flex flex-col gap-0"
        onEscapeKeyDown={(e) => running && e.preventDefault()}
        onPointerDownOutside={(e) => running && e.preventDefault()}
        onInteractOutside={(e) => running && e.preventDefault()}
      >
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <SheetHeader className="space-y-1 text-left pr-10">
            <SheetTitle className="font-ppMondwest text-[22px] font-normal leading-tight">
              {step === "choose" ? "Import & export" : "Import from Goodreads"}
            </SheetTitle>
            <SheetDescription className="label text-textSecondary">
              {step === "choose" && "Bring your Goodreads library, or take yours with you"}
              {step === "checking" && "Checking your books"}
              {step === "preview" && "Check what we found, then import"}
              {step === "importing" && "Importing — keep this page open"}
              {step === "done" && "All done"}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === "choose" && (
            <div className="space-y-6">
              <section className="space-y-3" aria-labelledby="import-heading">
                <h3 id="import-heading" className="label-lg text-ink">Import from Goodreads</h3>
                <ol className="space-y-1.5 text-[14px] leading-snug text-textPrimary list-decimal pl-5">
                  <li>
                    On Goodreads, open <strong className="font-medium text-ink">My Books</strong>, then{" "}
                    <strong className="font-medium text-ink">Import and export</strong>.
                  </li>
                  <li>
                    Press <strong className="font-medium text-ink">Export library</strong> and download the CSV.
                  </li>
                  <li>Choose that file below. Nothing is added until you’ve checked the preview.</li>
                </ol>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    handleFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "rounded-[12px] border border-dashed px-4 py-6 flex flex-col items-center text-center gap-3 transition-colors",
                    dragging ? "border-ink bg-paper-2" : "border-[#cfcfcf] bg-paper-2/50"
                  )}
                >
                  <UploadIcon />
                  <p className="text-[14px] text-textPrimary">
                    <span className="hidden sm:inline">Drop your Goodreads CSV here, or</span>
                    <span className="sm:hidden">Your Goodreads export (.csv)</span>
                  </p>
                  <label className="btn btn-primary cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-ink focus-within:outline-offset-2">
                    Choose CSV file
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                  </label>
                </div>
                {error && <Notice tone="error">{error}</Notice>}
              </section>

              <div className="h-px bg-line" />

              <section className="space-y-3" aria-labelledby="export-heading">
                <h3 id="export-heading" className="label-lg text-ink">Export your library</h3>
                <p className="text-[14px] leading-snug text-textPrimary">
                  Download every book on your shelves as a CSV: status, shelves, ratings, reviews and
                  dates. It uses Goodreads’ format, so you can import it here or elsewhere.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting || !library.ready || libraryCount === 0}
                    className="btn btn-secondary"
                  >
                    {exporting ? <Spinner /> : <DownloadIcon />}
                    {exporting ? "Exporting" : "Download CSV"}
                  </button>
                  <p className="label text-textSecondary">
                    {library.ready
                      ? libraryCount === 0
                        ? "Your shelves are empty"
                        : `${libraryCount.toLocaleString()} book${libraryCount === 1 ? "" : "s"}`
                      : "Loading…"}
                  </p>
                </div>
                {exportError && <Notice tone="error">{exportError}</Notice>}
              </section>
            </div>
          )}

          {step === "checking" && (
            <div className="py-16 flex flex-col items-center text-center gap-3" aria-live="polite">
              <Spinner size={20} className="text-ink" />
              <p className="font-ppMondwest text-[18px] text-ink">
                Checking {checked.total.toLocaleString()} book{checked.total === 1 ? "" : "s"} against our catalogue
              </p>
              <p className="label text-textSecondary">
                {checked.done.toLocaleString()} of {checked.total.toLocaleString()}
              </p>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <p className="label text-textSecondary truncate min-w-0" title={fileName}>
                  {fileName}
                </p>
                <button type="button" onClick={reset} className="btn btn-ghost btn-sm shrink-0">
                  Choose another file
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2" aria-label="Import summary">
                <Stat
                  value={summary.by.matched.length + (fillOwned ? summary.by.owned.length : 0)}
                  label="Matched"
                  hint={fillOwned && summary.by.owned.length ? `Incl. ${summary.by.owned.length} you have` : "In our catalogue"}
                  onClick={() => setFilter("matched")}
                  active={filter === "matched"}
                />
                <Stat
                  value={summary.by.lookup.length}
                  label="Need lookup"
                  hint="We’ll find these online"
                  onClick={() => setFilter("lookup")}
                  active={filter === "lookup"}
                />
                <Stat
                  value={summary.skippedCount}
                  label="Skipped"
                  hint="Already shelved or listed twice"
                  onClick={() => setFilter("skipped")}
                  active={filter === "skipped"}
                />
              </div>

              {summary.by.owned.length > 0 && (
                <label className="card flex items-start gap-3 p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fillOwned}
                    onChange={(e) => setFillOwned(e.target.checked)}
                    className="mt-0.5 w-5 h-5 shrink-0 accent-[#1f1f1f]"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-[14px] text-ink">
                      Fill in missing details for the {summary.by.owned.length} book{summary.by.owned.length === 1 ? "" : "s"} already on your shelves
                    </span>
                    <span className="block text-[13px] leading-snug text-textSecondary">
                      Your shelf, rating, review and dates stay as they are. Goodreads only fills in what’s empty.
                    </span>
                  </span>
                </label>
              )}

              {summary.toImport.length > 0 && (
                <section className="space-y-2.5" aria-labelledby="where-heading">
                  <h3 id="where-heading" className="label text-textSecondary">Where they’ll go</h3>
                  <ul className="card divide-y divide-line">
                    {STATUS_SLUGS.filter((s) => summary.statusCounts[s] > 0).map((slug) => (
                      <li key={slug} className="flex items-center justify-between px-3.5 h-11">
                        <span className="text-[14px] text-ink">{statusName(slug)}</span>
                        <span className="label text-textSecondary">{summary.statusCounts[slug].toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  {summary.newShelves.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="label text-textSecondary">
                        New shelves we’ll create
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.newShelves.map((name) => (
                          <span key={name} className="chip border-dashed">{name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(summary.ratings > 0 || summary.reviews > 0) && (
                    <p className="label text-textSecondary pt-1">
                      {[
                        summary.ratings && `${summary.ratings.toLocaleString()} rating${summary.ratings === 1 ? "" : "s"}`,
                        summary.reviews && `${summary.reviews.toLocaleString()} review${summary.reviews === 1 ? "" : "s"}`
                      ]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      come too
                    </p>
                  )}
                </section>
              )}

              <section className="space-y-2.5" aria-labelledby="books-heading">
                <h3 id="books-heading" className="sr-only">Books in this file</h3>
                <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1" role="tablist" aria-label="Filter books">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={filter === f.id}
                      data-active={filter === f.id}
                      onClick={() => {
                        setFilter(f.id);
                        setVisible(PAGE_SIZE);
                      }}
                      className="chip chip-lg shrink-0"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <ul className="divide-y divide-line">
                  {listRows.slice(0, visible).map((item) => (
                    <PreviewRow key={item.row.line} item={item} statusName={statusName} fillOwned={fillOwned} />
                  ))}
                </ul>
                {listRows.length === 0 && (
                  <p className="py-6 text-center label text-textSecondary">Nothing here</p>
                )}
                {listRows.length > visible && (
                  <button
                    type="button"
                    onClick={() => setVisible((v) => v + PAGE_SIZE * 2)}
                    className="btn btn-secondary w-full"
                  >
                    Show more ({(listRows.length - visible).toLocaleString()} left)
                  </button>
                )}
              </section>
            </div>
          )}

          {step === "importing" && progress && (
            <div className="py-10 space-y-4" aria-live="polite">
              <p className="font-ppMondwest text-[20px] text-ink">{progress.phase}</p>
              <div
                className="h-2 rounded-full bg-paper-3 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total || 1}
                aria-valuenow={progress.done}
                aria-label={progress.phase}
              >
                <div
                  className="h-full bg-ink rounded-full transition-[width] duration-300"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[14px] text-textPrimary truncate min-w-0">{progress.current || " "}</p>
                <p className="label text-textSecondary shrink-0">
                  {progress.done.toLocaleString()} of {progress.total.toLocaleString()}
                </p>
              </div>
              <p className="text-[13px] leading-snug text-textSecondary">
                Imports don’t show up in your followers’ feeds. Closing this page stops the import; books
                already added stay on your shelves.
              </p>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="font-ppMondwest text-[24px] leading-tight text-ink">
                  {result.added > 0
                    ? `Imported ${result.added.toLocaleString()} book${result.added === 1 ? "" : "s"}`
                    : result.filled > 0
                      ? "Filled in your books"
                      : "Nothing new to add"}
                </p>
                {result.stopped && <p className="label text-textSecondary">You stopped the import early</p>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat value={result.added} label="Added" />
                <Stat value={result.filled} label="Filled in" hint={result.unchanged ? `${result.unchanged} already complete` : undefined} />
                <Stat value={result.failed.length} label="Couldn’t add" tone={result.failed.length ? "error" : undefined} />
              </div>
              {result.error && <Notice tone="error">{result.error}</Notice>}
              {result.shelvesCreated.length > 0 && (
                <div className="space-y-2">
                  <p className="label text-textSecondary">New shelves</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.shelvesCreated.map((name) => (
                      <span key={name} className="chip">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.failed.length > 0 && (
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="label text-textSecondary">Couldn’t add</h3>
                    <button
                      type="button"
                      onClick={() => runImport(result.failed.map((f) => f.item), { retry: true })}
                      className="btn btn-secondary btn-sm"
                    >
                      Try again
                    </button>
                  </div>
                  <ul className="divide-y divide-line">
                    {result.failed.map(({ item, message }) => (
                      <li key={item.row.line} className="py-2.5">
                        <p className="text-[14px] text-ink line-clamp-2">{item.row.title}</p>
                        <p className="text-[13px] text-[#b42318]">{message}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {result.conflicts.length > 0 && (
                <ResultList
                  title={`Kept your version (${result.conflicts.length})`}
                  items={result.conflicts.map((c) => ({ key: c.line, title: c.title, detail: c.notes.join(" · ") }))}
                />
              )}
              {result.skipped.length > 0 && (
                <ResultList
                  title={`Skipped (${result.skipped.length})`}
                  items={result.skipped.map((sk) => ({ key: sk.line, title: sk.title, detail: sk.reason }))}
                />
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-line flex items-center justify-end gap-2 bg-white">
          {step === "choose" && (
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          )}
          {step === "checking" && (
            <p className="label text-textSecondary mr-auto">This takes a few seconds</p>
          )}
          {step === "preview" && (
            <>
              <button type="button" onClick={reset} className="btn btn-ghost mr-auto">
                Back
              </button>
              <button
                type="button"
                onClick={() => runImport(summary.toImport)}
                disabled={summary.toImport.length === 0}
                className="btn btn-primary"
              >
                {summary.toImport.length === 0
                  ? "Nothing to import"
                  : `Import ${summary.toImport.length.toLocaleString()} book${summary.toImport.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
          {step === "importing" && (
            <button
              type="button"
              onClick={() => {
                cancelRef.current = true;
              }}
              className="btn btn-secondary"
            >
              Stop import
            </button>
          )}
          {step === "done" && (
            <>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Done
              </button>
              <Link href={bookcaseHref} onClick={onClose} className="btn btn-primary">
                View my bookcase
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Stat({ value, label, hint, onClick, active, tone }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cn(
        "card px-3 py-3 text-left min-w-0 flex flex-col gap-1",
        onClick && "card-hover focus-ring",
        active && "border-ink"
      )}
    >
      <span className={cn("font-ppMondwest text-[26px] leading-none", tone === "error" && value ? "text-[#b42318]" : "text-ink")}>
        {Number(value || 0).toLocaleString()}
      </span>
      <span className="label text-ink">{label}</span>
      {hint && <span className="text-[12px] leading-tight text-textSecondary">{hint}</span>}
    </Tag>
  );
}

function PreviewRow({ item, statusName, fillOwned }) {
  const { row, kind, book } = item;
  const author = book?.authors?.[0] || row.authors?.[0];
  let tag;
  if (kind === "skipped" || (kind === "owned" && !fillOwned)) {
    tag = <span className="label text-textSecondary">{item.reason || "Skipped"}</span>;
  } else {
    tag = (
      <span className="label text-textSecondary">
        {kind === "owned" ? "Fill in blanks" : kind === "lookup" ? `Look up · ${statusName(row.status)}` : statusName(row.status)}
        {row.rating ? ` · ${"★".repeat(row.rating)}` : ""}
      </span>
    );
  }
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="w-9 shrink-0">
        {book ? (
          <BookCover book={book} flat sizes="36px" />
        ) : (
          <div
            className="w-full rounded-[3px] border border-dashed border-[#cfcfcf] bg-paper-2"
            style={{ aspectRatio: "2 / 3" }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-ppMondwest text-[15px] leading-snug line-clamp-2", row.title ? "text-ink" : "text-textSecondary italic")}>
          {row.title || `Line ${row.line} — no title`}
        </p>
        {author && <p className="text-[13px] text-textSecondary truncate">{author}</p>}
        <div className="mt-0.5">{tag}</div>
      </div>
    </li>
  );
}

function ResultList({ title, items }) {
  return (
    <details className="group">
      <summary className="label text-textSecondary cursor-pointer list-none flex items-center gap-1.5 h-8">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="transition-transform group-open:rotate-90" aria-hidden="true">
          <path d="M6 3l5 5-5 5" />
        </svg>
        {title}
      </summary>
      <ul className="divide-y divide-line">
        {items.map((it) => (
          <li key={it.key} className="py-2.5">
            <p className="text-[14px] text-ink line-clamp-2">{it.title}</p>
            <p className="text-[13px] text-textSecondary">{it.detail}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Notice({ tone, children }) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "text-[13px] leading-snug rounded-[8px] px-3 py-2 border",
        tone === "error"
          ? "text-[#b42318] bg-[#fef3f2] border-[#f1c7c2]"
          : "text-textPrimary bg-paper-2 border-line"
      )}
    >
      {children}
    </p>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-textSecondary" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}
