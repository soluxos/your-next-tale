"use client";
import React, { useEffect, useState, useRef } from "react";
import Book from "@/components/book/book";
import LoadingEffect from "@/components/loadingEffect/LoadingEffect";
import { AnimatePresence } from "motion/react";
import Navigation from "@/components/navigation/Navigation";

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
  const [rowHeights, setRowHeights] = useState({}); // Store height for each row
  const bookRefs = useRef([]);
  const observerRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const loadedImages = useRef(new Set()); // Track loaded images to prevent duplicate calls
  const rowRefs = useRef({}); // Store refs for each row

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
      // Reset row heights on resize to recalculate
      setRowHeights({});
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Add a class to the body before the page is loaded
  useEffect(() => {
    document.body.classList.add("books-page");
    return () => {
      document.body.classList.remove("books-page");
    };
  }, []);

  useEffect(() => {
    // Only fetch more books if we don't have initial books
    if (initialBooks.length === 0) {
      fetchMoreBooks(true);
    }
  }, []);

  // Update row heights after images load
  useEffect(() => {
    if (books.length > 0) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        updateRowHeights();
      });
    }
  }, [books, itemsPerRow, imagesLoaded]);

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
      if (data.Books && Array.isArray(data.Books)) {
        setBooks((prevBooks) => [...prevBooks, ...data.Books]);
        setPage((prevPage) => prevPage + 1);
        if (data.Books.length < pageSize) setHasMore(false);
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

  const updateRowHeights = () => {
    const newRowHeights = { ...rowHeights };

    Object.keys(rowRefs.current).forEach((rowIndex) => {
      const rowElement = rowRefs.current[rowIndex];
      if (rowElement && !newRowHeights[rowIndex]) {
        // Only set height if not already set (prevents layout shift)
        const height = rowElement.offsetHeight;
        if (height > 0) {
          newRowHeights[rowIndex] = Math.max(height, 160); // Min height of 160px
        }
      }
    });

    setRowHeights(newRowHeights);
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
      <AnimatePresence>{initialLoading && <LoadingEffect />}</AnimatePresence>
      <div className="flex">
        {/* <div className="sticky left-0 h-screen top-0 w-12 min-w-12 z-10 flex items-start justify-center py-5">
          <div>
            <img src="/icons/logo.svg" alt="logo" className="w-6" />
          </div>
        </div> */}
        <div className="grid grid-cols-[16px_auto_16px] pb-[88px] w-full">
          <div className="w-4 h-full border border-solid border-border"></div>
          <div className="flex-1 flex-col w-full h-full">
            <div className="left-border w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
            <div id="grid-container" className="grid">
              {rows.map((row, rowIndex) => (
                <React.Fragment key={rowIndex}>
                  <div
                    key={rowIndex}
                    ref={(el) => {
                      if (el) {
                        rowRefs.current[rowIndex] = el;
                      }
                    }}
                    className="row min-h-28 bg-[linear-gradient(to_bottom,_#F0F0F0,_#F8F8F8)] grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2 p-2 pb-0 pt-4 items-end overflow-hidden"
                    style={{
                      minHeight: rowHeights[rowIndex]
                        ? `${rowHeights[rowIndex]}px`
                        : "160px"
                    }}
                  >
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
                  <div
                    id={`row-${rowIndex}`}
                    className="h-4 border-1 border-border border flex border-r-0 border-l-0 w-full"
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
      {!initialLoading && <Navigation isLoggedIn={isLoggedIn} />}
    </>
  );
}
