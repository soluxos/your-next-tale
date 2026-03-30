"use client";

import React, { useEffect, useState, useRef } from "react";
import Book from "@/components/book/book";
import AddBookDrawer from "@/components/shelves/AddBookDrawer";
import BookDetailPanel from "@/components/shelves/BookDetailPanel";
import { removeBookFromShelf } from "@/lib/shelfBooks";
import { createClient } from "@/utils/supabase/client";

export default function ShelfView({
  books: initialBooks,
  shelfName,
  shelfId,
  shelfSlug,
  isOwner,
  userId,
  shelves = []
}) {
  const [books, setBooks] = useState(initialBooks);
  const [itemsPerRow, setItemsPerRow] = useState(9);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const supabase = createClient();

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
    // If owner, prepend an "add" placeholder
    const items = isOwner
      ? [{ id: "__add__", isAddTile: true }, ...bookList]
      : [...bookList];

    const minItems = perRow * 1; // At least 1 row
    while (items.length < minItems) {
      items.push({ id: `placeholder-${items.length}`, placeholder: true });
    }

    for (let i = 0; i < items.length; i += perRow) {
      rows.push(items.slice(i, i + perRow));
    }

    // Pad last row
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
    // Support both shapes: { book, userBook } (new) and plain book (legacy)
    const book = added?.book || added;
    const userBook = added?.userBook || null;
    const newEntry = {
      ...book,
      userBook: userBook
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
    setBooks((prev) => [newEntry, ...prev]);
  };

  const handleBookClick = (book) => {
    if (isOwner && book.userBook) {
      setSelectedBook(book);
    }
  };

  const handleDetailUpdate = (userBookId, updatedFields) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.userBook?.id === userBookId
          ? { ...b, userBook: { ...b.userBook, ...updatedFields } }
          : b
      )
    );
  };

  const handleRemoveBook = async (userBookId) => {
    if (!userBookId) return;
    const book = books.find((b) => b.userBook?.id === userBookId);
    const targetShelfId = book?.bookshelf_id || shelfId;
    if (!targetShelfId) return;
    try {
      await removeBookFromShelf(supabase, userBookId, targetShelfId);
      setBooks((prev) => prev.filter((b) => b.userBook?.id !== userBookId));
      setSelectedBook(null);
    } catch (e) {
      console.error("Error removing book:", e);
    }
  };

  const handleShelfMove = (userBookId, newShelfId, newShelfName) => {
    // If the book moved to a different shelf, remove it from the current view
    if (newShelfId !== shelfId && shelfSlug !== "all") {
      setBooks((prev) => prev.filter((b) => b.userBook?.id !== userBookId));
      setSelectedBook(null);
    }
  };

  const rows = chunkBooks(books, itemsPerRow);
  const isEmpty = books.length === 0;

  return (
    <>
      <div className="flex px-5">
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
              {!isOwner && isEmpty ? (
                <React.Fragment>
                  <div className="flex flex-row items-stretch bg-[#F4F4F4] overflow-hidden">
                    {/* Left inner shelf panel */}
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
                    {/* Empty state message */}
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                      <div className="flex-1 flex flex-col items-center justify-center bg-[#d5d5d5] min-h-[220px] p-8">
                        <p className="font-departureMono uppercase text-[10px] text-textPrimary pb-5">
                          No books on this shelf yet
                        </p>
                      </div>
                      <div className="h-[40px] w-full bg-[#f5f5f5] shrink-0 absolute bottom-0 left-0 z-[1]" />
                    </div>
                    {/* Right inner shelf panel */}
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
                      {/* Left inner shelf panel */}
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

                      {/* Books grid */}
                      <div className="flex-1 flex flex-col overflow-hidden relative">
                        <div className="flex-1 grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2 p-2 pb-2 pt-4 items-end overflow-hidden bg-[#d5d5d5]">
                          {row.map((book) =>
                            book.isAddTile ? (
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
                            ) : book.placeholder ? (
                              <div key={book.id} className="w-full" />
                            ) : (
                              <div
                                key={book.id}
                                className="w-full relative group cursor-pointer"
                                onClick={() => handleBookClick(book)}
                              >
                                <Book book={book} {...book} />
                                {isOwner && book.userBook && (
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <div className="w-6 h-6 rounded-full bg-white/90 border border-border flex items-center justify-center shadow-sm">
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
                              </div>
                            )
                          )}
                        </div>
                        {/* Bottom bar */}
                        <div className="h-[40px] w-full bg-[#f5f5f5] shrink-0 absolute bottom-0 left-0 z-[1]" />
                      </div>

                      {/* Right inner shelf panel */}
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
            </div>
          </div>
          <div className="left-border w-4 h-full border border-solid border-border" />
        </div>
      </div>

      {/* Add Book Drawer */}
      {isOwner && addDrawerOpen && (
        <AddBookDrawer
          userId={userId}
          shelfId={shelfId}
          onClose={() => setAddDrawerOpen(false)}
          onBookAdded={handleBookAdded}
        />
      )}

      {/* Book Detail Panel */}
      {selectedBook && (
        <BookDetailPanel
          book={selectedBook}
          userBook={selectedBook.userBook}
          userId={userId}
          shelves={shelves}
          currentShelfId={selectedBook.bookshelf_id || shelfId}
          readOnly={!isOwner}
          onClose={() => setSelectedBook(null)}
          onUpdate={handleDetailUpdate}
          onShelfMove={handleShelfMove}
          onRemove={isOwner ? handleRemoveBook : undefined}
        />
      )}
    </>
  );
}
