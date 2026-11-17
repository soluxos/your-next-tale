"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import Book from "@/components/book/book";
import {
  Bookcase,
  ContactShadow,
  Shelf,
  ShelfSkeleton,
  chunkIntoShelves,
  useBooksPerRow
} from "@/components/bookcase/Bookcase";
import BookReviewModal from "@/components/shelves/BookReviewModal";
import ReviewList, { ReviewListSkeleton } from "@/components/shelves/ReviewList";
import CoverProgress from "@/components/shelves/CoverProgress";
import ShelfToolbar, { ActiveFilterChips, ViewToggle } from "@/components/shelves/ShelfToolbar";
import { clearPanelFilters } from "@/components/shelves/FilterPopover";
import { buildGenreIndex, filterByGenres, genreOptionsFor } from "@/components/shelves/shelfGenres";
import { sortShelfBooks } from "@/lib/shelfSort";
import {
  filterShelfBooks,
  hasActiveFilters,
  DEFAULT_FILTERS
} from "@/lib/shelfFilter";
import { useShelfDragDrop } from "@/hooks/useShelfDragDrop";
import { createClient } from "@/utils/supabase/client";
import { TABLES } from "@/lib/supabase/types";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { toast } from "sonner";

// What each status shelf is for — shown under the shelf name and in its
// empty state, so "Did Not Finish" never needs guessing.
const SHELF_COPY = {
  all: {
    blurb: "Every book in your library",
    emptyTitle: "Your bookcase is empty",
    empty: "Search our catalogue and the web in one go — every book you add lands here."
  },
  read: {
    blurb: "Books you’ve finished",
    empty: "Finished a book? Add it here, give it a rating and note what you thought."
  },
  "currently-reading": {
    blurb: "What you’re reading now — track your page as you go",
    empty: "Add the book on your nightstand and keep track of your progress."
  },
  "want-to-read": {
    blurb: "Your to-be-read pile",
    empty: "Save books you’d like to read next. Spot one on Discover? Add it in one click."
  },
  "did-not-finish": {
    blurb: "Books you started and set aside — no judgement",
    emptyTitle: "No DNFs yet",
    empty: "“Did not finish” is for books you put down part-way. Moving a book here keeps a record without counting it as read."
  },
  custom: {
    blurb: "Your own shelf — a book can be on as many as you like",
    empty: "Custom shelves work like tags: add books here alongside their reading status."
  }
};

function AddSlot({ onClick, label, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group/add w-full rounded-[3px] border-2 border-dashed border-black/20 bg-white/35 hover:bg-white/70 hover:border-black/40 transition-colors flex flex-col items-center justify-center gap-2 text-textPrimary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      style={{ aspectRatio: "2 / 3" }}
    >
      <span className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center group-hover/add:scale-105 transition-transform">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M8 2v12M2 8h12" />
        </svg>
      </span>
      {!compact && <span className="label">Add book</span>}
      {compact && <span className="label hidden sm:block">Add</span>}
    </button>
  );
}

// Module-level cache — survives client-side navigation within the same session.
// Key: shelfId or shelfSlug. Value: books array from last successful fetch.
const booksCache = new Map();
const NO_BOOKS = [];

// What a shelf needs per book. Descriptions are left out (they're about half
// the payload); the popover and drawer fetch the one they show.
const BOOK_COLUMNS =
  "id, title, authors, cover_url, genres, page_count, published_date, publisher, isbn_13, isbn_10, language, created_at";
const USER_BOOK_COLUMNS =
  "id, book_id, rating, review, created_at, progress_pages, progress_percent, date_started, date_finished";
const PAGE = 1000; // PostgREST's row cap — page past it rather than truncate

async function fetchAllPages(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

const toUserBook = (ub) => ({
  id: ub.id,
  rating: ub.rating,
  review: ub.review,
  created_at: ub.created_at,
  progress_pages: ub.progress_pages,
  progress_percent: ub.progress_percent,
  date_started: ub.date_started,
  date_finished: ub.date_finished
});

export default function ShelfView({
  shelfName,
  shelfId,
  shelfSlug,
  isOwner,
  isAdmin = false,
  userId,
  username,
  shelves = [],
  defaultView = "books",
  profile = null,
  sortKey = "user",
  onSortChange,
  viewMode: viewModeProp,
  onViewModeChange,
  filters: filtersProp,
  onFiltersChange,
  knownCount
}) {
  const library = useLibrary();
  const cacheKey = shelfId || shelfSlug;
  const cached = booksCache.get(cacheKey);

  // The books on screen and the shelf they belong to, kept together so a
  // late answer for one shelf can never land on another. books: null while
  // the shelf's first load is under way.
  const [shelf, setShelf] = useState(() => ({ key: cacheKey, books: cached ?? null }));
  const itemsPerRow = useBooksPerRow();
  const [selectedBook, setSelectedBook] = useState(null);
  const [reviewBook, setReviewBook] = useState(null);

  // ShelfView stays mounted as you switch tabs, so a new shelf swaps in at
  // once, before anything paints: its cached list if you've been here,
  // otherwise placeholders. (Waiting for the fetch showed the last shelf's
  // books under the new shelf's name until it landed.)
  if (shelf.key !== cacheKey) {
    setShelf({ key: cacheKey, books: cached ?? null });
    setSelectedBook(null);
  }
  const current = shelf.key === cacheKey ? shelf.books : (cached ?? null);
  const books = current ?? NO_BOOKS;
  const booksLoading = current === null;

  // Changes to the books on screen (drag and drop, adds and removals, rating
  // edits) also update the cache, so coming back to this shelf shows them.
  const setBooks = useCallback(
    (update) =>
      setShelf((s) => {
        const next = typeof update === "function" ? update(s.books ?? NO_BOOKS) : update;
        if (next === s.books) return s;
        booksCache.set(s.key, next);
        return { key: s.key, books: next };
      }),
    []
  );
  const supabase = createClient();

  // Use props if provided, else fall back to local state (standalone usage)
  const viewMode = viewModeProp ?? defaultView;
  const filters = filtersProp ?? DEFAULT_FILTERS;

  function handleViewModeChange(mode) {
    onViewModeChange?.(mode);
    setSelectedBook(null);
  }

  const openAddBook = () =>
    library.openAddBook({ shelfId: shelfSlug === "all" ? null : shelfId });

  // Drag and drop — owner, custom order, a real shelf, and nothing hidden by
  // filters or the reviews view (otherwise drop positions don't line up).
  const dragEnabled =
    isOwner &&
    sortKey === "user" &&
    shelfSlug !== "all" &&
    !!shelfId &&
    viewMode === "books" &&
    !hasActiveFilters(filters);
  const {
    dragging,
    liveBooks,
    ghostPosRef,
    ghostSize,
    ghostElRef,
    offsetRef,
    draggedBook,
    overIndex: dragOverIndex,
    startDrag
  } = useShelfDragDrop({
    books,
    setBooks,
    shelfId,
    enabled: dragEnabled
  });

  // Sort then filter pipeline. Genres are matched by whole word here (see
  // shelfGenres); everything else by lib/shelfFilter.
  const genreIndex = useMemo(() => buildGenreIndex(books), [books]);
  const processedBooks = useMemo(() => {
    const sorted = sortShelfBooks(books, sortKey);
    const rest = filterShelfBooks(sorted, { ...filters, genres: [] });
    return filterByGenres(genreIndex, rest, filters.genres);
  }, [books, sortKey, filters, genreIndex]);

  // The Reviews view lists the books you've rated or written about
  const reviewItems = useMemo(
    () => processedBooks.filter((b) => b.user_book?.rating || b.user_book?.review?.trim()),
    [processedBooks]
  );
  const displayBooks = viewMode === "reviews" ? reviewItems : processedBooks;

  // Genre chips for the filter panel come from the books on this shelf, with
  // how many of the current results carry each.
  const genreOptions = useMemo(() => genreOptionsFor(genreIndex, processedBooks), [genreIndex, processedBooks]);

  // During drag render liveBooks (live-reordered); otherwise use sort+filter pipeline
  const renderBooks = dragging ? liveBooks : displayBooks;

  // Tag each item with its visual render index for data-drag-idx (drop target detection)
  const indexedRenderBooks = useMemo(
    () => renderBooks.map((b, i) => ({ ...b, _gridIdx: i })),
    [renderBooks]
  );

  // Cover URL for the floating ghost
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ghostCoverUrl = draggedBook?.book?.cover_url
    ? `${supabaseUrl}/storage/v1/object/public/books/${draggedBook.book.cover_url}`
    : null;

  // Fetch the shelf's books (or refresh the cached list) whenever it changes.
  useEffect(() => {
    let cancelled = false;

    async function fetchBooks() {
      let result = [];

      try {
        if (shelfSlug === "all") {
          const userBooks = await fetchAllPages(() =>
            supabase
              .from(TABLES.USER_BOOKS)
              .select(`${USER_BOOK_COLUMNS}, books (${BOOK_COLUMNS})`)
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
          );
          result = userBooks
            .filter((ub) => ub.books)
            .map((ub) => ({
              id: `all-${ub.id}`,
              position: null,
              bookshelf_id: null,
              book: { ...ub.books },
              user_book: toUserBook(ub)
            }));
        } else if (shelfId) {
          const shelfBooks = await fetchAllPages(() =>
            supabase
              .from(TABLES.BOOKSHELF_BOOKS)
              .select(`id, position, bookshelf_id, user_books (${USER_BOOK_COLUMNS}, books (${BOOK_COLUMNS}))`)
              .eq("bookshelf_id", shelfId)
              .order("position", { ascending: true, nullsFirst: false })
              .order("id", { ascending: true })
          );
          result = shelfBooks
            .filter((sb) => sb.user_books?.books)
            .map((sb) => ({
              id: sb.id,
              position: sb.position,
              bookshelf_id: sb.bookshelf_id,
              book: { ...sb.user_books.books },
              user_book: toUserBook(sb.user_books)
            }));
        }
      } catch (e) {
        console.error("Error loading shelf:", e);
        if (!cancelled) {
          // Stop the placeholders, but keep a cached list if there is one.
          setShelf((s) => (s.key === cacheKey && s.books === null ? { key: cacheKey, books: [] } : s));
          toast.error("Couldn’t load this shelf", { description: "Refresh to try again." });
        }
        return;
      }

      if (cancelled) return;
      // A refresh that changed nothing keeps the cached list (same objects),
      // so the covers don't all re-render with an identical copy.
      const before = booksCache.get(cacheKey);
      const next = before && JSON.stringify(before) === JSON.stringify(result) ? before : result;
      booksCache.set(cacheKey, next);
      // Only ever lands on the shelf it was fetched for.
      setShelf((s) => (s.key !== cacheKey || s.books === next ? s : { key: cacheKey, books: next }));
    }

    fetchBooks();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, shelfSlug, shelfId, userId]);

  // The owner's "Add" tile comes first on the shelf, beside where a book you
  // add lands in your own order.
  const chunkBooks = (bookList, perRow) => {
    if (!(isOwner && viewMode === "books" && !hasActiveFilters(filters))) {
      return chunkIntoShelves(bookList, perRow);
    }
    return chunkIntoShelves([{ id: "__add__", isAddTile: true }, ...bookList], perRow);
  };

  // Keep this shelf in sync with adds / moves / removals made anywhere —
  // the Add books drawer, Discover, a book page or the book modal.
  useEffect(() => {
    if (!isOwner) return;
    return library.subscribe((ev) => {
      // A rating, progress or date change: patch every cached shelf in place.
      if (ev.type === "updated") {
        const patch = (list) =>
          list.map((b) =>
            b.user_book?.id === ev.userBookId
              ? { ...b, user_book: { ...b.user_book, ...ev.fields } }
              : b
          );
        for (const [key, list] of booksCache) if (key !== cacheKey) booksCache.set(key, patch(list));
        setBooks(patch);
        return;
      }

      // Other shelves' cached lists are now stale; they refetch on visit.
      for (const key of [...booksCache.keys()]) {
        if (key !== cacheKey) booksCache.delete(key);
      }

      setBooks((prev) => {
        let next = prev;
        if (ev.type === "added") {
          const leaves =
            shelfSlug !== "all" && ev.removedShelfIds?.includes(shelfId);
          const joins =
            shelfSlug === "all" ? ev.isNewToLibrary : ev.shelfId === shelfId;
          if (leaves) next = next.filter((b) => b.book.id !== ev.book.id);
          if (joins && !next.some((b) => b.book.id === ev.book.id)) {
            next = [
              {
                id:
                  shelfSlug === "all"
                    ? `all-${ev.userBook?.id || ev.book.id}`
                    : ev.shelfBookId,
                position: shelfSlug === "all" ? null : ev.position,
                bookshelf_id: shelfSlug === "all" ? null : shelfId,
                book: { ...ev.book },
                user_book: ev.userBook ? toUserBook(ev.userBook) : null
              },
              ...next
            ];
          }
        } else if (ev.type === "removed") {
          const leaves =
            shelfSlug === "all"
              ? ev.libraryRemoved
              : ev.shelfIds.includes(shelfId);
          if (leaves) next = next.filter((b) => b.book.id !== ev.bookId);
        }
        return next;
      });
    });
  }, [isOwner, library.subscribe, cacheKey, shelfSlug, shelfId, setBooks]);

  const handleReviewCardClick = (bookId) => {
    const shelfBook = books.find((b) => b.book.id === bookId);
    if (shelfBook) {
      setReviewBook(shelfBook);
      window.history.pushState(
        { reviewBookId: bookId },
        "",
        `/u/${username}/${shelfSlug}/review/${bookId}`
      );
    }
  };

  useEffect(() => {
    function handlePopState() {
      setReviewBook(null);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleDetailUpdate = (userBookId, updatedFields) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.user_book?.id === userBookId ? { ...b, user_book: { ...b.user_book, ...updatedFields } } : b
      )
    );
  };

  // Two distinct ways to take a book away: off this custom shelf (the book
  // stays in your library), or out of your library entirely.
  const removeOptionsFor = (bookId) => {
    if (!isOwner) return [];
    const entry = library.getEntry(bookId);
    if (!entry) return [];
    const options = [];
    const shelf = shelves.find((s) => s.id === shelfId);
    if (shelf && !shelf.is_exclusive && entry.shelfIds.includes(shelfId) && entry.shelfIds.length > 1) {
      options.push({
        kind: "shelf",
        label: `Remove from ${shelfName}`,
        confirm: `Take it off ${shelfName}? It stays in your library with its rating and review.`,
        action: () => runRemoval(() => library.removeFromShelf(entry, shelfId), `Removed from ${shelfName}`)
      });
    }
    options.push({
      kind: "library",
      label: "Remove from library",
      confirm: "Remove this book from your library? Its rating, review, progress and dates are deleted too.",
      action: () => runRemoval(() => library.removeFromLibrary(entry), "Removed from your library")
    });
    return options;
  };

  async function runRemoval(fn, message) {
    try {
      await fn();
      setSelectedBook(null);
      toast.success(message);
    } catch (e) {
      console.error("Error removing book:", e);
      toast.error("Couldn’t remove this book", { description: e.message || "Please try again." });
    }
  }

  const rows = viewMode === "books" ? chunkBooks(indexedRenderBooks, itemsPerRow) : [];
  const isEmpty = books.length === 0;
  const filtersOn = hasActiveFilters(filters);
  const query = filters.query?.trim();
  const filteredEmpty = !isEmpty && renderBooks.length === 0;
  const copy = SHELF_COPY[shelfSlug] || SHELF_COPY.custom;
  const total = books.length;
  const shown = renderBooks.length;
  const plural = (n) => `${n} ${n === 1 ? "book" : "books"}`;
  const expected = typeof knownCount === "number" ? knownCount : null;

  const subtitle = booksLoading
    ? expected !== null
      ? plural(expected)
      : "Loading…"
    : viewMode === "reviews"
      ? `${shown} of ${plural(total)} rated or reviewed`
      : filtersOn
        ? `${shown} of ${plural(total)}`
        : plural(total);

  const clearSearch = () => onFiltersChange?.({ ...filters, query: "" });
  const clearFilters = () => onFiltersChange?.(clearPanelFilters(filters));

  // Shown when a search / filters leave nothing (both views)
  const noMatches = (
    <div className="w-full self-center text-center py-2 pb-6">
      <p className="font-ppMondwest text-[20px] text-ink">
        {query
          ? `Nothing here matches “${query}”`
          : viewMode === "reviews"
            ? "No reviews match"
            : "No books match"}
      </p>
      <p className="label text-textSecondary mt-2">
        {query
          ? shelfSlug === "all"
            ? "Check the spelling, or search by author"
            : "It may be on another shelf — try All books"
          : "Try loosening your filters"}
      </p>
      <button type="button" onClick={query ? clearSearch : clearFilters} className="btn btn-secondary btn-sm mt-4">
        {query ? "Clear search" : "Clear filters"}
      </button>
    </div>
  );

  return (
    <>
      <div className="ShelfView page-x mx-auto max-w-[1600px] pb-24">
        {/* Shelf heading + toolbar. On phones the view toggle shares the
            count's row (so the shelf name keeps the full width) and the
            toolbar is one 40px row: search + sort & filter. */}
        <div className="pt-6 pb-4 md:pb-5 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-x-6">
          <div className="min-w-0">
            <h2 className="font-ppMondwest text-ink text-[26px] sm:text-[30px] leading-none truncate">
              {shelfName}
            </h2>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="label text-textSecondary min-w-0" aria-live="polite">
                {subtitle}
                {isOwner && copy.blurb && viewMode === "books" && !filtersOn && (
                  <span className="hidden sm:inline"> · {copy.blurb}</span>
                )}
              </p>
              <ViewToggle mode={viewMode} onChange={handleViewModeChange} className="md:hidden" />
            </div>
          </div>
          <ShelfToolbar
            sortKey={sortKey}
            onSortChange={onSortChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            filters={filters}
            onFiltersChange={onFiltersChange}
            genreOptions={genreOptions}
            allowCustomOrder={shelfSlug !== "all"}
            searchLabel={
              shelfSlug === "all" ? (isOwner ? "Search your library" : "Search all books") : "Search this shelf"
            }
          />
        </div>

        <ActiveFilterChips filters={filters} onChange={onFiltersChange} className="pb-4" />

        {viewMode === "reviews" ? (
          booksLoading ? (
            <ReviewListSkeleton count={expected !== null ? Math.max(1, Math.min(expected, 4)) : 4} />
          ) : renderBooks.length ? (
            <ReviewList
              items={renderBooks}
              username={username}
              shelfSlug={shelfSlug}
              onOpen={handleReviewCardClick}
            />
          ) : (
            <div className="card px-6 py-12 text-center">
              {filtersOn ? (
                noMatches
              ) : (
                <>
                  <p className="font-ppMondwest text-[20px] text-ink">No reviews yet</p>
                  <p className="label text-textSecondary mt-2">
                    {isOwner
                      ? isEmpty
                        ? "Add books to this shelf, then rate or review them"
                        : "Rate or review a book and it shows up here"
                      : `Nothing on ${shelfName} has been rated or reviewed yet`}
                  </p>
                  {isOwner && !isEmpty && (
                    <button type="button" onClick={() => handleViewModeChange("books")} className="btn btn-secondary btn-sm mt-4">
                      Back to books
                    </button>
                  )}
                </>
              )}
            </div>
          )
        ) : (
          <Bookcase base aria-busy={booksLoading}>
            {booksLoading ? (
              // Sized from the tab's known count: a 4-book shelf shows 4
              // placeholders, and phones get a single shelf of them.
              <ShelfSkeleton rows={2} count={expected ?? undefined} />
            ) : isEmpty || filteredEmpty ? (
              <Shelf grid={false} booksClassName="min-h-[220px] sm:min-h-[260px]">
                {filteredEmpty ? (
                  noMatches
                ) : isOwner ? (
                  <div className="w-full flex flex-col-reverse items-center gap-5 py-4 xs:flex-row xs:items-end xs:gap-6 xs:py-0">
                    <div
                      className="shrink-0"
                      style={{
                        width:
                          itemsPerRow <= 3
                            ? "38%"
                            : `calc((100% - ${(itemsPerRow - 1) * 8}px) / ${itemsPerRow})`
                      }}
                    >
                      <AddSlot onClick={openAddBook} label={`Add books to ${shelfName}`} />
                    </div>
                    <div className="text-center xs:text-left xs:self-center xs:pb-8 max-w-md">
                      <p className="font-ppMondwest text-[22px] text-ink leading-tight">
                        {copy.emptyTitle || `Nothing on ${shelfName} yet`}
                      </p>
                      <p className="font-ppMondwest text-[16px] text-textPrimary mt-2 leading-snug">
                        {copy.empty}
                      </p>
                      <button type="button" onClick={openAddBook} className="btn btn-primary mt-4">
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                          <path d="M8 2v12M2 8h12" />
                        </svg>
                        Add books
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="w-full self-center text-center pb-6 font-ppMondwest text-[18px] text-textPrimary">
                    No books on this shelf yet
                  </p>
                )}
              </Shelf>
            ) : (
              // Keyed by shelf too: another shelf's books replace these at
              // once, instead of hundreds of covers animating out and in.
              rows.map((row, rowIndex) => (
                <Shelf key={`${cacheKey}:${rowIndex}`}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {row.map((item) => {
                      if (item.isAddTile) {
                        return (
                          <div key="__add__" className="w-full relative z-10">
                            <AddSlot onClick={openAddBook} label={`Add books to ${shelfName}`} compact />
                          </div>
                        );
                      }
                      if (item.placeholder) return <div key={item.id} className="w-full" />;

                      const bookIdx = item._gridIdx;
                      const isBeingDragged = dragging && draggedBook?.id === item.id;

                      return (
                        <motion.div
                          key={item.id}
                          layout="position"
                          initial={isBeingDragged ? false : { opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={isBeingDragged ? false : { opacity: 0, scale: 0.9 }}
                          transition={
                            dragging
                              ? { layout: { duration: 0 }, opacity: { duration: 0 }, scale: { duration: 0 } }
                              : {
                                  layout: { type: "spring", stiffness: 300, damping: 28 },
                                  opacity: { duration: 0.18 },
                                  scale: { duration: 0.18 }
                                }
                          }
                          data-drag-idx={dragEnabled ? bookIdx : undefined}
                          onPointerDown={dragEnabled ? (e) => startDrag(e, item.id) : undefined}
                          onDragStart={(e) => e.preventDefault()}
                          style={{ touchAction: dragEnabled ? "none" : undefined }}
                          className={`w-full z-10 relative group select-none ${
                            dragEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                          }`}
                        >
                          {isBeingDragged ? (
                            <div
                              style={{
                                aspectRatio: "2 / 3",
                                borderRadius: 4,
                                background: "rgba(0,0,0,0.07)",
                                boxShadow: "inset 0 2px 12px rgba(0,0,0,0.18)",
                                border: "2px dashed rgba(0,0,0,0.13)"
                              }}
                            />
                          ) : (
                            <>
                              <ContactShadow />
                              <Book
                                book={item.book}
                                disableHover={dragging}
                                onClick={
                                  isOwner && item.user_book ? () => setSelectedBook(item) : undefined
                                }
                              />
                            </>
                          )}

                          {/* Reading progress on Currently Reading */}
                          {!isBeingDragged && shelfSlug === "currently-reading" && (
                            <CoverProgress
                              userBook={item.user_book}
                              pageCount={item.book.page_count}
                              showEmpty={isOwner}
                            />
                          )}

                          {dragEnabled && (
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                              <div className="w-6 h-6 rounded-full bg-black/55 flex items-center justify-center">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                                  <circle cx="9" cy="7" r="1.5" />
                                  <circle cx="15" cy="7" r="1.5" />
                                  <circle cx="9" cy="12" r="1.5" />
                                  <circle cx="15" cy="12" r="1.5" />
                                  <circle cx="9" cy="17" r="1.5" />
                                  <circle cx="15" cy="17" r="1.5" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </Shelf>
              ))
            )}
          </Bookcase>
        )}
      </div>

      {/* Floating ghost — cover image that follows the cursor while dragging */}
      {dragging &&
        draggedBook &&
        createPortal(
          <div
            ref={ghostElRef}
            style={{
              position: "fixed",
              left: ghostPosRef.current
                ? ghostPosRef.current.x - offsetRef.current.x
                : -9999,
              top: ghostPosRef.current
                ? ghostPosRef.current.y - offsetRef.current.y
                : -9999,
              width: ghostSize.w,
              height: ghostSize.h,
              pointerEvents: "none",
              zIndex: 9999,
              opacity: 0.92,
              transform: "rotate(2deg) scale(1.05)",
              filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))"
            }}
          >
            {ghostCoverUrl ? (
              <img
                src={ghostCoverUrl}
                alt=""
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: 4
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "#bbb",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    textAlign: "center",
                    fontFamily: "monospace"
                  }}
                >
                  {draggedBook.book.title}
                </span>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* Review modal — reviews mode (also opened from /review/[bookId] URLs) */}
      {reviewBook && (
        <BookReviewModal
          book={reviewBook.book}
          userBook={reviewBook.user_book}
          profile={profile}
          username={username}
          isOwner={isOwner}
          onClose={() => {
            setReviewBook(null);
            window.history.replaceState(
              null,
              "",
              `/u/${username}/${shelfSlug}`
            );
          }}
          onUpdate={handleDetailUpdate}
          removeOptions={removeOptionsFor(reviewBook.book.id)}
        />
      )}

      {/* Owner clicked a book — rating, review, shelves, progress */}
      {viewMode === "books" && selectedBook && (
        <BookReviewModal
          book={selectedBook.book}
          userBook={selectedBook.user_book}
          profile={profile}
          username={username}
          isOwner={isOwner}
          onClose={() => setSelectedBook(null)}
          onUpdate={handleDetailUpdate}
          removeOptions={removeOptionsFor(selectedBook.book.id)}
        />
      )}
    </>
  );
}
