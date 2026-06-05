"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import Book from "@/components/book/book";
import AddBookDrawer from "@/components/shelves/AddBookDrawer";
import BookDetailPanel from "@/components/shelves/BookDetailPanel";
import BookReviewModal from "@/components/shelves/BookReviewModal";
import ReviewCardOverlay from "@/components/shelves/ReviewCardOverlay";
import { removeBookFromShelf } from "@/lib/shelfBooks";
import { sortShelfBooks } from "@/lib/shelfSort";
import { filterShelfBooks, DEFAULT_FILTERS } from "@/lib/shelfFilter";
import { useShelfDragDrop } from "@/hooks/useShelfDragDrop";
import { createClient } from "@/utils/supabase/client";
import { TABLES } from "@/lib/supabase/types";

// Module-level cache — survives client-side navigation within the same session.
// Key: shelfId or shelfSlug. Value: books array from last successful fetch.
const booksCache = new Map();

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
  onFiltersChange
}) {
  const router = useRouter();
  const cacheKey = shelfId || shelfSlug;
  const cached = booksCache.get(cacheKey);

  const [books, setBooks] = useState(cached || []);
  const [booksLoading, setBooksLoading] = useState(!cached);
  const [itemsPerRow, setItemsPerRow] = useState(9);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [reviewBook, setReviewBook] = useState(null);
  const supabase = createClient();

  // Use props if provided, else fall back to local state (standalone usage)
  const viewMode = viewModeProp ?? defaultView;
  const filters = filtersProp ?? DEFAULT_FILTERS;

  function handleViewModeChange(mode) {
    onViewModeChange?.(mode);
    setSelectedBook(null);
  }

  // Drag and drop — only for owner in user sort on a specific shelf
  const dragEnabled =
    isOwner && sortKey === "user" && shelfSlug !== "all" && !!shelfId;
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

  // Sort then filter pipeline
  const processedBooks = useMemo(() => {
    const sorted = sortShelfBooks(books, sortKey);
    return filterShelfBooks(sorted, filters);
  }, [books, sortKey, filters]);

  // In reviews mode, further filter to books with rating or review
  const displayBooks =
    viewMode === "reviews"
      ? processedBooks.filter((b) => b.user_book?.rating || b.user_book?.review)
      : processedBooks;

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

  // Fetch books client-side whenever the shelf changes.
  useEffect(() => {
    let cancelled = false;

    async function fetchBooks() {
      const hasCached = booksCache.has(cacheKey);
      if (!hasCached) {
        setBooksLoading(true);
        setBooks([]);
      }
      setSelectedBook(null);

      let result = [];

      if (shelfSlug === "all") {
        const { data: userBooks } = await supabase
          .from(TABLES.USER_BOOKS)
          .select(
            `id, book_id, rating, review, created_at, progress_pages, progress_percent,
             date_started, date_finished, books (*)`
          )
          .eq("user_id", userId);

        result = (userBooks || []).map((ub) => ({
          id: `all-${ub.id}`,
          position: null,
          bookshelf_id: null,
          book: { ...ub.books },
          user_book: {
            id: ub.id,
            rating: ub.rating,
            review: ub.review,
            created_at: ub.created_at,
            progress_pages: ub.progress_pages,
            progress_percent: ub.progress_percent,
            date_started: ub.date_started,
            date_finished: ub.date_finished
          }
        }));
      } else if (shelfId) {
        const { data: shelfBooks } = await supabase
          .from(TABLES.BOOKSHELF_BOOKS)
          .select(
            `id, position, bookshelf_id,
             user_books (id, book_id, rating, review, created_at, progress_pages,
               progress_percent, date_started, date_finished, books (*))`
          )
          .eq("bookshelf_id", shelfId)
          .order("position", { ascending: true, nullsFirst: false });

        result = (shelfBooks || [])
          .map((sb) => {
            const ub = sb.user_books;
            if (!ub?.books) return null;
            return {
              id: sb.id,
              position: sb.position,
              bookshelf_id: sb.bookshelf_id,
              book: { ...ub.books },
              user_book: {
                id: ub.id,
                rating: ub.rating,
                review: ub.review,
                created_at: ub.created_at,
                progress_pages: ub.progress_pages,
                progress_percent: ub.progress_percent,
                date_started: ub.date_started,
                date_finished: ub.date_finished
              }
            };
          })
          .filter(Boolean);
      }

      if (!cancelled) {
        booksCache.set(cacheKey, result);
        setBooks(result);
        setBooksLoading(false);
      }
    }

    fetchBooks();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, shelfSlug, shelfId, userId]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1024) setItemsPerRow(9);
      else if (width >= 768) setItemsPerRow(6);
      else if (width >= 480) setItemsPerRow(4);
      else setItemsPerRow(2);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const chunkBooks = (bookList, perRow) => {
    const rows = [];
    const items = isOwner
      ? [{ id: "__add__", isAddTile: true }, ...bookList]
      : [...bookList];

    const minItems = perRow * 1;
    while (items.length < minItems) {
      items.push({ id: `placeholder-${items.length}`, placeholder: true });
    }

    for (let i = 0; i < items.length; i += perRow) {
      rows.push(items.slice(i, i + perRow));
    }

    const lastRow = rows[rows.length - 1];
    while (lastRow && lastRow.length < perRow) {
      lastRow.push({
        id: `placeholder-pad-${lastRow.length}`,
        placeholder: true
      });
    }

    return rows;
  };

  const handleBookAdded = (added) => {
    const book = added?.book || added;
    const userBook = added?.userBook || null;
    const newEntry = {
      id: `new-${Date.now()}`,
      position: 1,
      bookshelf_id: shelfId,
      book: { ...book },
      user_book: userBook
        ? {
            id: userBook.id,
            rating: userBook.rating,
            review: userBook.review,
            progress_pages: userBook.progress_pages,
            progress_percent: userBook.progress_percent,
            date_started: userBook.date_started,
            date_finished: userBook.date_finished
          }
        : null
    };
    setBooks((prev) => {
      // Bump all existing positions by 1 so the new book sits at position 1
      const bumped = prev.map((b) => ({
        ...b,
        position: b.position != null ? b.position + 1 : b.position
      }));
      const next = [newEntry, ...bumped];
      booksCache.set(cacheKey, next);
      return next;
    });
  };

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
    setBooks((prev) => {
      const next = prev.map((b) =>
        b.user_book?.id === userBookId
          ? { ...b, user_book: { ...b.user_book, ...updatedFields } }
          : b
      );
      booksCache.set(cacheKey, next);
      return next;
    });
  };

  const handleRemoveBook = async (userBookId) => {
    if (!userBookId) return;
    const shelfBook = books.find((b) => b.user_book?.id === userBookId);
    const targetShelfId = shelfBook?.bookshelf_id || shelfId;
    if (!targetShelfId) return;
    try {
      await removeBookFromShelf(supabase, userBookId, targetShelfId);
      setBooks((prev) => {
        const next = prev.filter((b) => b.user_book?.id !== userBookId);
        booksCache.set(cacheKey, next);
        return next;
      });
      setSelectedBook(null);
    } catch (e) {
      console.error("Error removing book:", e);
    }
  };

  const handleShelfMove = (userBookId, newShelfId, newShelfName) => {
    if (newShelfId !== shelfId && shelfSlug !== "all") {
      setBooks((prev) => {
        const next = prev.filter((b) => b.user_book?.id !== userBookId);
        booksCache.set(cacheKey, next);
        return next;
      });
      setSelectedBook(null);
    }
  };

  const rows = chunkBooks(indexedRenderBooks, itemsPerRow);
  const isEmpty = books.length === 0;
  const filteredEmpty = !isEmpty && renderBooks.length === 0;
  const activeIsEmpty = isEmpty || filteredEmpty;

  return (
    <>
      <div className="ShelfView flex px-10">
        <div className="grid grid-cols-[16px_auto_16px] pb-[88px] w-full relative">
          {/* Top shelf surface: left angle + center bar + right angle */}
          <div className="col-span-3 flex h-[40px]">
            <div className="w-[40px] shrink-0 relative overflow-hidden">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                aria-hidden="true"
                style={{ display: "block" }}
              >
                <polygon points="0,40 40,40 40,0" fill="#F5F5F5" />
                <line
                  x1="0"
                  y1="40"
                  x2="40"
                  y2="0"
                  stroke="#dddddd"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div className="flex-1 bg-[#F5F5F5] border-t border-[#dddddd]" />
            <div className="w-[40px] shrink-0 relative overflow-hidden">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                aria-hidden="true"
                style={{ display: "block" }}
              >
                <polygon points="0,0 0,40 40,40" fill="#F5F5F5" />
                <line
                  x1="0"
                  y1="0"
                  x2="40"
                  y2="40"
                  stroke="#dddddd"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </div>

          <div className="w-4 h-full border border-solid border-border" />
          <div className="flex-1 flex-col w-full h-full">
            <div className="left-border w-full h-4 border-1 border-border border flex border-r-0 border-l-0" />
            <div id="grid-container" className="grid">
              <AnimatePresence mode="popLayout">
                {booksLoading ? (
                  <React.Fragment>
                    <div className="row flex flex-row items-stretch bg-[#F4F4F4] overflow-hidden">
                      <div className="flex flex-col shrink-0 w-[40px]">
                        <div className="flex-1 bg-[#E6E6E6]" />
                        <svg
                          width="40"
                          height="40"
                          viewBox="0 0 40 40"
                          aria-hidden="true"
                          style={{ display: "block", flexShrink: 0 }}
                        >
                          <polygon
                            points="0,0 40,0 0,40"
                            style={{ fill: "#E6E6E6" }}
                          />
                          <polygon
                            points="40,0 40,40 0,40"
                            style={{ fill: "transparent" }}
                          />
                        </svg>
                      </div>
                      <div className="flex-1 flex flex-col overflow-hidden relative">
                        <div className="flex-1 grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2 p-2 pb-2 pt-4 items-end overflow-hidden bg-[#d5d5d5]">
                          {Array.from({ length: itemsPerRow }).map((_, i) => (
                            <div
                              key={i}
                              className="w-full relative z-10 animate-pulse bg-[#bbb] rounded-sm"
                              style={{ aspectRatio: "2 / 3" }}
                            />
                          ))}
                        </div>
                        <div className="h-[40px] w-full bg-[#f5f5f5] shrink-0 absolute bottom-0 left-0 z-[1]" />
                      </div>
                      <div className="flex flex-col shrink-0 w-[40px]">
                        <div className="flex-1 bg-[#E0E0E0]" />
                        <svg
                          width="40"
                          height="40"
                          viewBox="0 0 40 40"
                          aria-hidden="true"
                          style={{ display: "block", flexShrink: 0 }}
                        >
                          <polygon
                            points="0,0 40,0 40,40"
                            style={{ fill: "#E0E0E0" }}
                          />
                          <polygon
                            points="0,0 0,40 40,40"
                            style={{ fill: "transparent" }}
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="h-4 flex w-full border-t border-b border-[#ddd] bg-[#F4F4F4]" />
                  </React.Fragment>
                ) : activeIsEmpty ? (
                  <React.Fragment>
                    <div className="flex flex-row items-stretch bg-[#F4F4F4] overflow-hidden">
                      <div className="flex flex-col shrink-0 w-[40px]">
                        <div className="flex-1 bg-[#E6E6E6]" />
                        <svg
                          width="40"
                          height="40"
                          viewBox="0 0 40 40"
                          aria-hidden="true"
                          style={{ display: "block", flexShrink: 0 }}
                        >
                          <polygon
                            points="0,0 40,0 0,40"
                            style={{ fill: "#E6E6E6" }}
                          />
                          <polygon
                            points="40,0 40,40 0,40"
                            style={{ fill: "transparent" }}
                          />
                        </svg>
                      </div>
                      <div className="flex-1 flex flex-col overflow-hidden relative">
                        <div className="flex-1 flex flex-row items-end gap-2 p-2 pt-4 bg-[#d5d5d5] min-h-[220px]">
                          {filteredEmpty ? (
                            <div className="w-full text-center self-center pb-5">
                              <p className="font-ppMondwest text-[18px] text-textPrimary mb-1">
                                {viewMode === "reviews"
                                  ? "No reviews match"
                                  : "No books match"}
                              </p>
                              <p className="font-departureMono uppercase text-[9px] text-textSecondary">
                                Try adjusting your filters
                              </p>
                            </div>
                          ) : isOwner && viewMode !== "reviews" ? (
                            <div
                              className="cursor-pointer shrink-0"
                              style={{
                                width: `calc((100% - ${(itemsPerRow - 1) * 8}px) / ${itemsPerRow})`
                              }}
                              onClick={() => setAddDrawerOpen(true)}
                            >
                              <div
                                className="w-full z-10 bg-[#e0e0e0] border-2 border-dashed border-[#bbb] rounded-sm flex flex-col items-center justify-center gap-1 hover:border-textPrimary hover:bg-[#d8d8d8] transition-colors"
                                style={{ aspectRatio: "2 / 3" }}
                              >
                                <p className="font-departureMono uppercase text-textPrimary text-xs">
                                  Add book
                                </p>
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="text-textPrimary"
                                >
                                  <line x1="8" y1="2" x2="8" y2="14" />
                                  <line x1="2" y1="8" x2="14" y2="8" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <p className="font-departureMono uppercase text-[10px] text-textPrimary w-full text-center self-center pb-5">
                              {viewMode === "reviews"
                                ? "No reviews yet"
                                : "No books on this shelf yet"}
                            </p>
                          )}
                        </div>
                        <div className="h-[40px] w-full bg-[#f5f5f5] shrink-0 absolute bottom-0 left-0 z-[1]" />
                      </div>
                      <div className="flex flex-col shrink-0 w-[40px]">
                        <div className="flex-1 bg-[#E0E0E0]" />
                        <svg
                          width="40"
                          height="40"
                          viewBox="0 0 40 40"
                          aria-hidden="true"
                          style={{ display: "block", flexShrink: 0 }}
                        >
                          <polygon
                            points="0,0 40,0 40,40"
                            style={{ fill: "#E0E0E0" }}
                          />
                          <polygon
                            points="0,0 0,40 40,40"
                            style={{ fill: "transparent" }}
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="h-4 flex w-full border-t border-b border-[#ddd] bg-[#F4F4F4]" />
                  </React.Fragment>
                ) : (
                  rows.map((row, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                      <div className="row flex flex-row items-stretch bg-[#F4F4F4] overflow-hidden">
                        <div className="flex flex-col shrink-0 w-[40px]">
                          <div className="flex-1 bg-[#E6E6E6]" />
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 40 40"
                            aria-hidden="true"
                            style={{ display: "block", flexShrink: 0 }}
                          >
                            <polygon
                              points="0,0 40,0 0,40"
                              style={{ fill: "#E6E6E6" }}
                            />
                            <polygon
                              points="40,0 40,40 0,40"
                              style={{ fill: "transparent" }}
                            />
                          </svg>
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden relative">
                          <div className="flex-1 grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2 p-2 pb-2 pt-4 items-end overflow-hidden bg-[#d5d5d5]">
                            {row.map((item) => {
                              if (item.isAddTile) {
                                return (
                                  <div
                                    key="__add__"
                                    className="w-full relative z-10 cursor-pointer"
                                    onClick={() => setAddDrawerOpen(true)}
                                  >
                                    <div
                                      className="w-full z-10 bg-[#e0e0e0] border-2 border-dashed border-[#bbb] rounded-sm flex flex-col items-center justify-center gap-1 hover:border-textPrimary hover:bg-[#d8d8d8] transition-colors"
                                      style={{ aspectRatio: "2 / 3" }}
                                    >
                                      <p className="font-departureMono uppercase text-textPrimary text-xs">
                                        Add book
                                      </p>
                                      <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="text-textPrimary"
                                      >
                                        <line x1="8" y1="2" x2="8" y2="14" />
                                        <line x1="2" y1="8" x2="14" y2="8" />
                                      </svg>
                                    </div>
                                  </div>
                                );
                              }

                              if (item.placeholder) {
                                return <div key={item.id} className="w-full" />;
                              }

                              const bookIdx = item._gridIdx;
                              // The dragged book is invisible in the grid — the floating ghost represents it
                              const isBeingDragged =
                                dragging && draggedBook?.id === item.id;

                              return (
                                <motion.div
                                  key={item.id}
                                  layout="position"
                                  initial={
                                    isBeingDragged
                                      ? false
                                      : { opacity: 0, scale: 0.95 }
                                  }
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={
                                    isBeingDragged
                                      ? false
                                      : { opacity: 0, scale: 0.9 }
                                  }
                                  transition={
                                    dragging
                                      ? {
                                          layout: { duration: 0 },
                                          opacity: { duration: 0 },
                                          scale: { duration: 0 }
                                        }
                                      : {
                                          layout: {
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 28
                                          },
                                          opacity: { duration: 0.18 },
                                          scale: { duration: 0.18 }
                                        }
                                  }
                                  data-drag-idx={
                                    dragEnabled ? bookIdx : undefined
                                  }
                                  onPointerDown={
                                    dragEnabled
                                      ? (e) => startDrag(e, item.id)
                                      : undefined
                                  }
                                  onDragStart={(e) => e.preventDefault()}
                                  style={{
                                    touchAction: dragEnabled
                                      ? "none"
                                      : undefined
                                  }}
                                  className={`w-full z-10 relative group select-none ${
                                    dragEnabled
                                      ? "cursor-grab active:cursor-grabbing"
                                      : "cursor-pointer"
                                  }`}
                                >
                                  {isBeingDragged ? (
                                    // Shadow drop-zone — shows where the book will land
                                    <div
                                      style={{
                                        aspectRatio: "2 / 3",
                                        borderRadius: 4,
                                        background: "rgba(0,0,0,0.07)",
                                        boxShadow:
                                          "inset 0 2px 12px rgba(0,0,0,0.18)",
                                        border: "2px dashed rgba(0,0,0,0.13)"
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className={
                                        viewMode === "reviews"
                                          ? "pointer-events-none"
                                          : undefined
                                      }
                                    >
                                      <Book
                                        book={item.book}
                                        disableHover={dragging}
                                      />
                                    </div>
                                  )}

                                  {/* Drag handle indicator (owner + user sort) */}
                                  {dragEnabled && (
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                      <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                                        <svg
                                          width="10"
                                          height="10"
                                          viewBox="0 0 24 24"
                                          fill="white"
                                        >
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

                                  {/* BOOKS MODE: pencil icon for owner */}
                                  {viewMode === "books" &&
                                    isOwner &&
                                    item.user_book &&
                                    !dragEnabled && (
                                      <div
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedBook(item);
                                        }}
                                      >
                                        <div className="w-6 h-6 rounded-full bg-white/90 border border-border flex items-center justify-center shadow-sm cursor-pointer hover:bg-white transition-colors">
                                          <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="text-textPrimary"
                                          >
                                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                            <path d="m15 5 4 4" />
                                          </svg>
                                        </div>
                                      </div>
                                    )}

                                  {/* REVIEWS MODE: review card overlay */}
                                  {viewMode === "reviews" && (
                                    <ReviewCardOverlay
                                      bookId={item.book.id}
                                      rating={item.user_book?.rating}
                                      review={item.user_book?.review}
                                      onReviewClick={handleReviewCardClick}
                                    />
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                          <div className="h-[40px] w-full bg-[#f5f5f5] shrink-0 absolute bottom-0 left-0" />
                        </div>

                        <div className="flex flex-col shrink-0 w-[40px]">
                          <div className="flex-1 bg-[#E0E0E0]" />
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 40 40"
                            aria-hidden="true"
                            style={{ display: "block", flexShrink: 0 }}
                          >
                            <polygon
                              points="0,0 40,0 40,40"
                              style={{ fill: "#E0E0E0" }}
                            />
                            <polygon
                              points="0,0 0,40 40,40"
                              style={{ fill: "transparent" }}
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="h-4 flex w-full border-t border-b border-[#ddd] bg-[#F4F4F4]" />
                    </React.Fragment>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="left-border w-4 h-full border border-solid border-border" />
        </div>
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

      {/* Add Book Drawer */}
      {isOwner && addDrawerOpen && (
        <AddBookDrawer
          userId={userId}
          shelfId={shelfId}
          onClose={() => setAddDrawerOpen(false)}
          onBookAdded={handleBookAdded}
        />
      )}

      {/* Review modal — reviews mode */}
      {reviewBook && (
        <BookReviewModal
          book={reviewBook.book}
          userBook={reviewBook.user_book}
          profile={profile}
          username={username}
          isOwner={isOwner}
          userId={userId}
          shelves={shelves}
          currentShelfId={reviewBook.bookshelf_id || shelfId}
          onClose={() => {
            setReviewBook(null);
            window.history.replaceState(
              null,
              "",
              `/u/${username}/${shelfSlug}`
            );
          }}
          onUpdate={handleDetailUpdate}
          onShelfMove={handleShelfMove}
          onRemove={isOwner ? handleRemoveBook : undefined}
        />
      )}

      {/* Book detail — books mode */}
      {viewMode === "books" &&
        selectedBook &&
        (isAdmin ? (
          <BookDetailPanel
            book={selectedBook.book}
            userBook={selectedBook.user_book}
            isAdmin={isAdmin}
            userId={userId}
            shelves={shelves}
            currentShelfId={selectedBook.bookshelf_id || shelfId}
            onClose={() => setSelectedBook(null)}
            onUpdate={handleDetailUpdate}
            onShelfMove={handleShelfMove}
            onRemove={isOwner ? handleRemoveBook : undefined}
            onBookUpdated={() => router.refresh()}
          />
        ) : (
          <BookReviewModal
            book={selectedBook.book}
            userBook={selectedBook.user_book}
            isOwner={isOwner}
            userId={userId}
            shelves={shelves}
            currentShelfId={selectedBook.bookshelf_id || shelfId}
            onClose={() => setSelectedBook(null)}
            onUpdate={handleDetailUpdate}
            onShelfMove={handleShelfMove}
            onRemove={isOwner ? handleRemoveBook : undefined}
          />
        ))}
    </>
  );
}
