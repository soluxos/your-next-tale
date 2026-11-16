"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Book from "@/components/book/book";
import { Bookcase, Shelf, ShelfSkeleton, chunkIntoShelves, useBooksPerRow } from "@/components/bookcase/Bookcase";
import Segmented from "@/components/ui/Segmented";
import DataCredit from "@/components/ui/DataCredit";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { PAGE_SIZE } from "@/lib/books/catalogueRanks";
import { SFF, SFF_GENRES } from "@/lib/genres";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "popular", label: "Popular" },
  { value: "newest", label: "Newest" }
];
const BLURB = {
  popular: "most read first",
  newest: "newest first"
};

/**
 * Discover: the catalogue as one long bookcase. Fantasy and science fiction
 * for now, most popular first, with the reader's own books left out.
 */
export default function DiscoverPage({ initialGenre = null, initialSort = "popular", initialBooks = [], initialHasMore = true, initialTotal = null }) {
  const [genre, setGenre] = useState(initialGenre);
  const [sort, setSort] = useState(initialSort);
  const [books, setBooks] = useState(initialBooks);
  const [page, setPage] = useState(initialBooks.length ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(initialTotal);
  const [hideOwned, setHideOwned] = useState(true);
  const perRow = useBooksPerRow();
  const library = useLibrary();
  const signedIn = !!library.userId;
  const sentinel = useRef(null);
  const request = useRef(0);

  const fetchPage = useCallback(async (pageNo, genreSlug, sortKey, replace) => {
    const id = ++request.current;
    setLoading(true);
    try {
      const start = pageNo * PAGE_SIZE;
      const params = new URLSearchParams({ start, end: start + PAGE_SIZE - 1, genre: genreSlug || SFF, sort: sortKey });
      if (replace) params.set("count", "1");
      const res = await fetch(`/api/books?${params}`);
      if (!res.ok) throw new Error("Failed to fetch books");
      const { books: next = [], hasMore: more, total: count } = await res.json();
      if (id !== request.current) return;
      setBooks((prev) => {
        if (replace) return next;
        const seen = new Set(prev.map((b) => b.id));
        return [...prev, ...next.filter((b) => !seen.has(b.id))];
      });
      setPage(pageNo + 1);
      setHasMore(more ?? next.length === PAGE_SIZE);
      if (replace && count != null) setTotal(count);
    } catch (err) {
      console.error("Error fetching books:", err);
      if (id === request.current) setHasMore(false);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialBooks.length && initialHasMore) fetchPage(0, initialGenre, initialSort, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && fetchPage(page, genre, sort, false),
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, page, genre, sort, fetchPage]);

  function show(nextGenre, nextSort) {
    if (nextGenre === genre && nextSort === sort) return;
    setGenre(nextGenre);
    setSort(nextSort);
    setBooks([]);
    setHasMore(true);
    if (nextGenre !== genre) setTotal(null);
    fetchPage(0, nextGenre, nextSort, true);
    // Keep the address in step, so a filtered view can be shared or reloaded.
    const params = new URLSearchParams();
    if (nextGenre) params.set("genre", nextGenre);
    if (nextSort !== "popular") params.set("sort", nextSort);
    window.history.replaceState(null, "", `/discover${params.size ? `?${params}` : ""}`);
  }

  // Discovery is for books you don't have yet.
  const visible = signedIn && hideOwned ? books.filter((b) => !library.getEntry(b.id)) : books;
  const ownedHidden = books.length - visible.length;
  const rows = chunkIntoShelves(visible, perRow, { minRows: visible.length ? 1 : 0 });
  const showSkeleton = (loading || hasMore) && !visible.length;
  const genreLabel = SFF_GENRES.find((g) => g.slug === genre)?.label.toLowerCase() || "fantasy and science fiction";

  return (
    <section aria-labelledby="discover-heading">
      <div className="page-x mx-auto max-w-[1600px] pt-10 sm:pt-16 lg:pt-20">
        <p className="label text-textSecondary min-h-5 flex items-center">
          The catalogue
          {total != null && (
            <>
              <span aria-hidden="true" className="mx-2 opacity-60">·</span>
              {total.toLocaleString("en-GB")} books
            </>
          )}
        </p>
        <h1
          id="discover-heading"
          className="mt-4 sm:mt-5 font-ppMondwest text-ink text-[42px] sm:text-[58px] min-[1440px]:text-[66px] leading-[0.98] tracking-[-0.01em]"
        >
          Discover
        </h1>
        <p className="mt-5 sm:mt-6 max-w-[40ch] font-ppMondwest text-[19px] sm:text-[22px] leading-[1.35] text-textSecondary">
          The best of {genreLabel}, {BLURB[sort]}. Hover a cover for the story, or add it straight to a shelf.
        </p>
        <DataCredit className="mt-4" />

        <div className="mt-10 sm:mt-12 mb-6 sm:mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="Filter by genre" className="flex flex-wrap gap-1.5">
            <GenreChip active={!genre} onClick={() => show(null, sort)}>
              All
            </GenreChip>
            {SFF_GENRES.map((g) => (
              <GenreChip key={g.slug} active={genre === g.slug} onClick={() => show(g.slug, sort)}>
                {g.label}
              </GenreChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {signedIn && (
              <button
                type="button"
                aria-pressed={hideOwned}
                onClick={() => setHideOwned((v) => !v)}
                className="min-h-10 label text-textSecondary hover:text-ink flex items-center gap-2 rounded-[4px] focus-ring"
              >
                <span
                  className={cn(
                    "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors",
                    hideOwned ? "bg-ink border-ink text-white" : "border-line bg-white"
                  )}
                  aria-hidden="true"
                >
                  {hideOwned && (
                    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8.5l3 3 7-7" />
                    </svg>
                  )}
                </span>
                Hide books I’ve shelved
              </button>
            )}
            <Segmented label="Sort by" options={SORT_OPTIONS} value={sort} onChange={(s) => show(genre, s)} className="max-xs:flex max-xs:w-full" />
          </div>
        </div>
      </div>

      <div className="page-x mx-auto max-w-[1600px] pb-24">
        <Bookcase aria-busy={loading}>
          {showSkeleton ? (
            <ShelfSkeleton perRow={perRow} rows={3} />
          ) : rows.length ? (
            rows.map((row, i) => (
              <Shelf key={i}>
                {row.map((book) =>
                  book.placeholder ? (
                    <div key={book.id} />
                  ) : (
                    <Book
                      key={book.id}
                      book={book}
                      onDeleted={(id) => setBooks((prev) => prev.filter((b) => b.id !== id))}
                    />
                  )
                )}
              </Shelf>
            ))
          ) : (
            <Shelf grid={false} booksClassName="justify-center min-h-[200px] items-center flex-col gap-3">
              <p className="font-ppMondwest text-[18px] text-textPrimary">
                {ownedHidden && !hasMore ? "You’ve shelved every book here." : "No books here yet."}
              </p>
              {ownedHidden > 0 && !hasMore && (
                <button type="button" onClick={() => setHideOwned(false)} className="btn btn-secondary btn-sm">
                  Show them anyway
                </button>
              )}
            </Shelf>
          )}
          {loading && books.length > 0 && <ShelfSkeleton perRow={perRow} rows={1} />}
        </Bookcase>
        <div ref={sentinel} className="h-px" aria-hidden="true" />
      </div>
    </section>
  );
}

function GenreChip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="chip chip-lg shrink-0">
      {children}
    </button>
  );
}
