"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { describeWork, sameWork } from "@/lib/books/sameBook";

/**
 * "Add books" — one search, one list.
 *
 * As you type we ask our catalogue (instant) and online sources (a second or
 * two) at the same time, and show everything in a single list: catalogue
 * books first, online finds appended underneath as they arrive. Every row has
 * the same action — add it to the shelf picked at the top — whether we
 * already had the book or not. Books you own are marked so you never add a
 * duplicate, and the drawer stays open so you can add several in a row.
 */

const DEBOUNCE_MS = 250;
const SUGGESTION_COUNT = 18;

export default function AddBookDrawer({ open, initialShelfId, onClose }) {
  const library = useLibrary();
  const {
    statusShelves,
    customShelves,
    defaultShelfId,
    findEntry,
    addBook,
    openImport,
    entries
  } = library;

  const [query, setQuery] = useState("");
  const [targetShelfId, setTargetShelfId] = useState(null);
  const [localResults, setLocalResults] = useState([]);
  const [onlineResults, setOnlineResults] = useState([]);
  const [searchingLocal, setSearchingLocal] = useState(false);
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [rowState, setRowState] = useState({}); // key -> { status, message }
  const [addedCount, setAddedCount] = useState(0);

  const inputRef = useRef(null);
  const requestId = useRef(0);
  const debounceRef = useRef(null);

  // Reset each time the drawer opens
  useEffect(() => {
    if (!open) return;
    setTargetShelfId(initialShelfId || defaultShelfId);
    setRowState({});
    setAddedCount(0);
    // Fresh search every time — reopening shouldn't append to an old query
    setQuery("");
    clearTimeout(debounceRef.current);
    runSearch("");
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialShelfId]);

  // Shelves may finish loading after the drawer opens
  useEffect(() => {
    if (open && !targetShelfId && defaultShelfId) {
      setTargetShelfId(initialShelfId || defaultShelfId);
    }
  }, [open, targetShelfId, defaultShelfId, initialShelfId]);

  // Suggestions for the empty state — newest catalogue books. Fetch a deep
  // page: owned books are filtered out, and big libraries own most of them.
  useEffect(() => {
    if (!open || suggestionsLoaded) return;
    let cancelled = false;
    fetch(`/api/books?start=0&end=${SUGGESTION_COUNT * 6 - 1}`)
      .then((r) => (r.ok ? r.json() : { books: [] }))
      .then(({ books }) => {
        if (cancelled) return;
        setSuggestions(
          (books || []).filter((b) => b.cover_url).map(bookToResult)
        );
      })
      .catch(() => {})
      .finally(() => !cancelled && setSuggestionsLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [open, suggestionsLoaded]);

  const runSearch = useCallback(async (q) => {
    const id = ++requestId.current;
    const trimmed = q.trim();
    setSearchError(null);

    if (!trimmed) {
      setLocalResults([]);
      setOnlineResults([]);
      setSearchingLocal(false);
      setSearchingOnline(false);
      return;
    }

    setSearchingLocal(true);
    setSearchingOnline(true);
    const enc = encodeURIComponent(trimmed);

    // Both requests fire together; the catalogue answers first.
    fetch(`/api/books/search?q=${enc}&source=local`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(({ results }) => {
        if (id !== requestId.current) return;
        setLocalResults(results || []);
      })
      .catch(() => {
        if (id === requestId.current) setLocalResults([]);
      })
      .finally(() => {
        if (id === requestId.current) setSearchingLocal(false);
      });

    fetch(`/api/books/search?q=${enc}&source=online`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(({ results }) => {
        if (id !== requestId.current) return;
        setOnlineResults(results || []);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setOnlineResults([]);
        setSearchError("Couldn't reach online sources — showing catalogue matches only.");
      })
      .finally(() => {
        if (id === requestId.current) setSearchingOnline(false);
      });
  }, []);

  function handleQueryChange(value) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      runSearch("");
      return;
    }
    // Keep the previous results visible while the next search runs,
    // but show we're working.
    setSearchingLocal(true);
    debounceRef.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      clearTimeout(debounceRef.current);
      runSearch(query);
    }
    if (e.key === "Escape" && query) {
      e.preventDefault();
      e.stopPropagation();
      handleQueryChange("");
    }
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // ── The single list ──────────────────────────────────────────────────────
  const hasQuery = !!query.trim();
  const rows = useMemo(() => {
    const source = hasQuery
      ? collapseEditions(dedupe([...localResults, ...onlineResults]), findEntry)
      : // Suggestions are for discovering something new — skip owned books,
        // but keep the ones added just now so they can show "Added".
        collapseEditions(suggestions, findEntry)
          .filter((r) => !findEntry(r) || rowState[resultKey(r)])
          .slice(0, SUGGESTION_COUNT);
    return source.map((result) => ({
      key: resultKey(result),
      result,
      entry: findEntry(result)
    }));
  }, [hasQuery, localResults, onlineResults, suggestions, findEntry, rowState]);

  const targetShelf = useMemo(
    () =>
      [...statusShelves, ...customShelves].find(
        (s) => s.id === targetShelfId
      ) || null,
    [statusShelves, customShelves, targetShelfId]
  );

  async function handleAdd(row) {
    if (!targetShelfId) return;
    setRowState((s) => ({ ...s, [row.key]: { status: "adding" } }));
    try {
      const { alreadyThere } = await addBook({ result: row.result }, targetShelfId);
      setRowState((s) => ({
        ...s,
        [row.key]: { status: "added", shelfId: targetShelfId }
      }));
      if (!alreadyThere) setAddedCount((n) => n + 1);
    } catch (e) {
      console.error("Add book failed:", e);
      setRowState((s) => ({
        ...s,
        [row.key]: { status: "error", message: e.message }
      }));
    }
  }

  const showSkeletons = hasQuery && searchingLocal && rows.length === 0;
  const noResults =
    hasQuery && !searchingLocal && !searchingOnline && rows.length === 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] p-0 flex flex-col gap-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {/* ── Header + controls (fixed) ── */}
        <div className="px-5 pt-5 pb-4 border-b border-border space-y-4">
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="font-ppMondwest text-[22px] font-normal leading-tight">
              Add books
            </SheetTitle>
            <SheetDescription className="sr-only">
              Search by title, author or ISBN, then add a book to a shelf
            </SheetDescription>
          </SheetHeader>

          {/* Search */}
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Title, author or ISBN"
              aria-label="Search for a book"
              autoComplete="off"
              spellCheck={false}
              className="field !h-12 !pl-10 !pr-11 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  handleQueryChange("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-[6px] flex items-center justify-center text-textSecondary hover:text-ink hover:bg-paper-3 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Target shelf — a reading status, or one of your own shelves */}
          <div className="space-y-2">
          <div className="flex items-center gap-3">
            <p className="label text-textSecondary shrink-0" id="add-to-label">Add to</p>
            <div
              className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar -mr-5 pr-5 [mask-image:linear-gradient(to_right,#000_88%,transparent)]"
              role="radiogroup"
              aria-labelledby="add-to-label"
            >
              {[...statusShelves, ...customShelves].map((shelf, i) => {
                const selected = shelf.id === targetShelfId;
                return (
                  <span key={shelf.id} className="contents">
                    {/* Your own shelves come after the reading statuses */}
                    {i === statusShelves.length && i > 0 && (
                      <span className="w-px h-5 bg-line shrink-0 mx-1" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-active={selected}
                      onClick={() => setTargetShelfId(shelf.id)}
                      className="chip chip-lg shrink-0 whitespace-nowrap"
                    >
                      {shelf.name}
                    </button>
                  </span>
                );
              })}
              {statusShelves.length === 0 && (
                <span className="h-9 w-48 rounded-full bg-paper-3 animate-pulse" />
              )}
            </div>
          </div>
            {targetShelf && !targetShelf.is_exclusive && (
              <p className="label !normal-case !text-[12px] text-textSecondary">
                Books without a status also go on Want to Read.
              </p>
            )}
          </div>
        </div>

        {/* ── Results (scrolls) ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex items-center justify-between h-6 mb-1">
            <p className="label text-textSecondary">
              {hasQuery
                ? rows.length > 0
                  ? `${rows.length} result${rows.length === 1 ? "" : "s"}`
                  : searchingLocal || searchingOnline
                    ? "Searching…"
                    : "Results"
                : rows.length || !suggestionsLoaded
                  ? "New in the catalogue"
                  : ""}
            </p>
            {hasQuery && searchingOnline && rows.length > 0 && (
              <p className="label text-textSecondary flex items-center gap-1.5">
                <Spinner /> Checking more sources
              </p>
            )}
          </div>

          {/* New readers: offer to bring their Goodreads library instead */}
          {!hasQuery && library.ready && entries.size < 5 && (
            <div className="card p-4 mb-3 flex items-start gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-ppMondwest text-[17px] leading-snug text-ink">
                  Coming from Goodreads?
                </p>
                <p className="text-[13px] leading-snug text-textSecondary">
                  Import your whole library from a CSV export: shelves, ratings and reviews.
                </p>
              </div>
              <button type="button" onClick={openImport} className="btn btn-secondary btn-sm shrink-0">
                Import
              </button>
            </div>
          )}

          {searchError && (
            <p className="mb-2 font-departureMono text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2">
              {searchError}
            </p>
          )}

          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <ResultRow
                key={row.key}
                row={row}
                state={rowState[row.key]}
                targetShelf={targetShelf}
                library={library}
                onAdd={() => handleAdd(row)}
              />
            ))}
            {(showSkeletons || (hasQuery && searchingOnline)) &&
              Array.from({ length: showSkeletons ? 5 : 2 }).map((_, i) => (
                <SkeletonRow key={`sk-${i}`} />
              ))}
            {!hasQuery && !suggestionsLoaded &&
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={`sg-${i}`} />)}
          </ul>

          {!hasQuery && suggestionsLoaded && rows.length === 0 && (
            <div className="py-10 text-center">
              <p className="font-ppMondwest text-[20px] text-ink">Search above to add a book</p>
              <p className="mt-1 text-[13.5px] text-textSecondary">
                You already have everything new in the catalogue. Look one up, or see what’s coming out.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link href="/releases" onClick={onClose} className="btn btn-secondary btn-sm">
                  New releases
                </Link>
                <button type="button" onClick={openImport} className="btn btn-ghost btn-sm">
                  Import from Goodreads
                </button>
              </div>
            </div>
          )}

          {noResults && (
            <div className="py-12 text-center space-y-1">
              <p className="font-ppMondwest text-[18px] text-textPrimary">
                No books found for &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="label text-textSecondary">
                Try the author&rsquo;s surname, fewer words, or an ISBN
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-line flex items-center justify-between gap-3 bg-white">
          <p className="label text-textSecondary" aria-live="polite">
            {addedCount > 0
              ? `${addedCount} book${addedCount === 1 ? "" : "s"} added`
              : (
                <span className="hidden sm:inline">
                  <kbd className="font-departureMono px-1.5 py-0.5 rounded-[4px] border border-line text-[10px]">⌘K</kbd>{" "}
                  opens this anywhere
                </span>
              )}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={openImport} className="btn btn-ghost">
              <UploadIcon /> Import CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className={cn("btn", addedCount > 0 ? "btn-primary" : "btn-secondary")}
            >
              Done
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

function ResultRow({ row, state, targetShelf, library, onAdd }) {
  const { result, entry } = row;
  const p = result.preview || {};
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = !coverFailed ? p.cover_preview_url : null;

  const onTarget = entry?.shelfIds?.includes(targetShelf?.id);
  const ownedShelf = library.statusShelfFor(entry);
  const status = state?.status;

  const meta = [p.author, p.year].filter(Boolean).join(" · ");

  let action;
  if (status === "adding") {
    action = (
      <span className="h-9 px-3 inline-flex items-center gap-1.5 label text-textSecondary">
        <Spinner /> Adding
      </span>
    );
  } else if (onTarget || status === "added") {
    action = (
      <span className="btn btn-md btn-shelved pointer-events-none">
        <CheckIcon /> {status === "added" ? "Added" : "On shelf"}
      </span>
    );
  } else {
    action = (
      <button
        type="button"
        onClick={onAdd}
        disabled={!targetShelf}
        aria-label={
          entry && targetShelf?.is_exclusive && ownedShelf?.is_exclusive
            ? `Move ${p.title} from ${ownedShelf.name} to ${targetShelf.name}`
            : `Add ${p.title} to ${targetShelf?.name || "shelf"}`
        }
        title={
          entry && targetShelf?.is_exclusive && ownedShelf?.is_exclusive
            ? `Move from ${ownedShelf.name} to ${targetShelf.name}`
            : undefined
        }
        className={cn(
          "btn btn-md min-w-[72px]",
          status === "error" ? "btn-danger" : entry ? "btn-secondary" : "btn-primary"
        )}
      >
        {status === "error" ? (
          "Retry"
        ) : entry && targetShelf?.is_exclusive && ownedShelf?.is_exclusive ? (
          "Move here"
        ) : (
          <>
            <PlusIcon /> Add
          </>
        )}
      </button>
    );
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="w-11 h-[66px] shrink-0 rounded-[3px] overflow-hidden bg-[#ececec] shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-1">
            <span className="font-ppMondwest text-[8px] leading-tight text-center text-textSecondary line-clamp-4">
              {p.title}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-ppMondwest text-[15px] leading-snug text-textPrimary line-clamp-2">
          {p.title}
        </p>
        {meta && (
          <p className="font-departureMono text-[11px] text-textSecondary truncate mt-0.5">
            {meta}
          </p>
        )}
        {entry && ownedShelf && !onTarget && status !== "added" && (
          <p className="label !text-[10px] text-shelved mt-1">
            On your {ownedShelf.name} shelf
          </p>
        )}
        {status === "added" && targetShelf && (
          <p className="label !text-[10px] text-shelved mt-1">
            Added to {library.shelfById(state.shelfId)?.name || targetShelf.name}
          </p>
        )}
        {status === "error" && (
          <p className="label !normal-case !text-[12px] text-[#b42318] mt-1">
            {state.message || "Couldn't add this book"}
          </p>
        )}
      </div>

      <div className="shrink-0">{action}</div>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li className="flex items-center gap-3 py-3" aria-hidden="true">
      <div className="w-11 h-[66px] rounded-[3px] bg-[#ececec] animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 rounded bg-[#ececec] animate-pulse" />
        <div className="h-2.5 w-1/3 rounded bg-[#f1f1f1] animate-pulse" />
      </div>
      <div className="h-8 w-16 rounded-full bg-[#f1f1f1] animate-pulse" />
    </li>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function bookToResult(book) {
  return {
    source: "local",
    in_catalog: true,
    is_incomplete: book.is_incomplete || false,
    catalog_ids: [book.id],
    _raw: book,
    preview: {
      title: book.title,
      author: book.authors?.[0] || null,
      authors: book.authors || [],
      year: book.published_date ? String(book.published_date).slice(0, 4) : null,
      isbn_13: book.isbn_13,
      isbn_10: book.isbn_10,
      cover_preview_url: book.cover_url
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${book.cover_url}`
        : null
    }
  };
}

function resultKey(result) {
  if (result.source === "local" && result._raw?.id) return `b:${result._raw.id}`;
  const p = result.preview || {};
  return `x:${p.isbn_13 || p.isbn_10 || ""}:${(p.title || "").toLowerCase()}:${(p.author || "").toLowerCase()}`;
}

function dedupe(results) {
  const seen = new Set();
  return results.filter((r) => {
    const k = resultKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// The instant (catalogue) and online lists are merged client-side, and the
// catalogue can hold one book several times — show each book once, using the
// same rule as the search API. If the reader owns one of the copies, keep the
// row that says so, so they never add a duplicate.
function collapseEditions(results, findEntry) {
  const kept = [];
  for (const r of results) {
    const work = describeWork(r.preview);
    const ids = new Set(r.catalog_ids || []);
    const i = kept.findIndex(
      (x) =>
        sameWork(x.work, work) || (x.r.catalog_ids || []).some((id) => ids.has(id))
    );
    if (i === -1) kept.push({ r, work });
    else if (!findEntry(kept[i].r) && findEntry(r)) kept[i] = { r, work };
  }
  return kept.map((x) => x.r);
}

function SearchIcon({ className }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}
