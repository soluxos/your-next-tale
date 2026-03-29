"use client";
import React, { useEffect, useState, useRef } from "react";
import Book from "@/components/book/book";
import LoadingEffect from "@/components/loadingEffect/LoadingEffect";
import Hero from "@/components/pages/home/Hero";
import { AnimatePresence } from "motion/react";
import HeroNew from "@/components/hero/HeroNew";

export default function HomePage(props) {
  const { isLoggedIn, initialBooks = [] } = props;
  const pageSize = 45;
  const [books, setBooks] = useState(initialBooks);
  const [page, setPage] = useState(initialBooks.length > 0 ? 1 : 0); // Start at page 1 if we have initial books
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(
    initialBooks.length === 0
  );
  const [hasMore, setHasMore] = useState(true);
  const [itemsPerRow, setItemsPerRow] = useState(9);
  const bookRefs = useRef([]);
  const observerRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const loadedImages = useRef(new Set()); // Track loaded images to prevent duplicate calls

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setItemsPerRow(9);
      } else if (width >= 768) {
        setItemsPerRow(6);
      } else if (width >= 480) {
        setItemsPerRow(4);
      } else {
        setItemsPerRow(2);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Only fetch more books if we don't have initial books
    if (initialBooks.length === 0) {
      fetchMoreBooks(true);
    }
  }, []);

  useEffect(() => {
    if (!initialLoading && observerRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && hasMore && !loading) {
            fetchMoreBooks();
          }
        },
        { rootMargin: "200px" }
      );

      observer.observe(observerRef.current);

      return () => observer.disconnect();
    }
  }, [hasMore, loading, initialLoading]);

  const fetchMoreBooks = async (isInitialLoad = false) => {
    if (!isInitialLoad) setLoading(true);
    const start = page * pageSize;
    const end = start + pageSize - 1;

    try {
      const res = await fetch(`/api/books?start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Failed to fetch books");

      const data = await res.json();
      if (data.books && Array.isArray(data.books)) {
        setBooks((prevBooks) => [...prevBooks, ...data.books]);
        setPage((prevPage) => prevPage + 1);
        if (data.books.length < pageSize) setHasMore(false);
        // Reset imagesLoaded and loadedImages when new books are fetched
        setImagesLoaded(0);
        loadedImages.current.clear();
      } else {
        console.error("Fetched data is not an array:", data);
      }
    } catch (err) {
      console.error("Error fetching more books:", err);
    }

    setTimeout(() => {
      if (!isInitialLoad) setLoading(false);
    }, 500);
  };

  const chunkBooks = (books, itemsPerRow) => {
    const rows = [];
    const minBooks = itemsPerRow * 5; // Minimum books needed for 5 rows

    // Pad the books array with placeholders if there are not enough books
    const paddedBooks = [...books];
    while (paddedBooks.length < minBooks) {
      paddedBooks.push({
        id: `placeholder-${paddedBooks.length}`,
        placeholder: true
      });
    }

    for (let i = 0; i < paddedBooks.length; i += itemsPerRow) {
      rows.push(paddedBooks.slice(i, i + itemsPerRow));
    }
    return rows;
  };

  const handleImageLoad = (id) => {
    // Prevent duplicate calls for the same image
    if (!loadedImages.current.has(id)) {
      loadedImages.current.add(id);
      setImagesLoaded((prev) => prev + 1);
    }
  };

  useEffect(() => {
    if (imagesLoaded === books.length && books.length > 0) {
      setInitialLoading(false);
    }
  }, [imagesLoaded, books.length]);

  const rows = chunkBooks(books, itemsPerRow);

  return (
    <>
      <div aria-hidden="true" className="vignette-overlay" />
      <AnimatePresence>{initialLoading && <LoadingEffect />}</AnimatePresence>
      {/* <Hero /> */}
      <HeroNew />
      <div className="flex px-5">
        {/* <div className="sticky left-0 h-screen top-0 w-12 min-w-12 z-10 flex items-start justify-center py-5">
          <div>
            <img src="/icons/logo.svg" alt="logo" className="w-6" />
          </div>
        </div> */}
        <div className="grid grid-cols-[16px_auto_16px] pb-[88px] w-full relative">
          {/* Top shelf surface: left angle + center bar + right angle */}
          <div className="col-span-3 flex h-[40px]">
            {/* Left angled section */}
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
            {/* Center bar */}
            <div className="flex-1 bg-[#F5F5F5] border-t border-[#dddddd]" />
            {/* Right angled section */}
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
          <div className="w-4 h-full border border-solid border-border"></div>
          <div className="flex-1 flex-col w-full h-full">
            <div className="left-border w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
            <div id="grid-container" className="grid">
              {rows.map((row, rowIndex) => (
                <React.Fragment key={rowIndex}>
                  <div
                    key={rowIndex}
                    className="row flex flex-row items-stretch bg-[#F4F4F4] overflow-hidden"
                  >
                    {/* Left inner shelf panel: rectangle + fixed angled SVG at bottom */}
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
                        {row.map((book, bookIndex) => (
                          <div
                            key={book.id}
                            className="w-full"
                            ref={(el) => {
                              if (!book.placeholder) {
                                bookRefs.current[
                                  rowIndex * itemsPerRow + bookIndex
                                ] = el;
                              }
                            }}
                          >
                            {!book.placeholder && (
                              <Book
                                book={book}
                                onImageLoad={() => handleImageLoad(book.id)}
                                {...book}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Bottom bar matching the height of the corner SVGs */}
                      <div className="h-[40px] w-full bg-[#f5f5f5] shrink-0 absolute bottom-0 left-0 z-[1]" />
                    </div>

                    {/* Right inner shelf panel: rectangle + fixed angled SVG at bottom */}
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
                  <div
                    id={`row-${rowIndex}`}
                    className="h-4 flex w-full border-t border-b border-[#ddd] bg-[#F4F4F4]"
                  ></div>
                </React.Fragment>
              ))}
            </div>
            <div ref={observerRef} className="h-0"></div>
          </div>
          <div className="left-border w-4 h-full border border-solid border-border"></div>
        </div>
      </div>
      <div className="book-case-bottom-gradient z-20"></div>
    </>
  );
}
