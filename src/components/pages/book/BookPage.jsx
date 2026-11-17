"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import BuyButton from "@/components/book/BuyButton";
import AddToShelfButton from "@/components/book/AddToShelfButton";
import BookCover from "@/components/book/BookCover";
import Book from "@/components/book/book";
import { Bookcase, Shelf } from "@/components/bookcase/Bookcase";
import BookReaders from "@/components/pages/book/BookReaders";
import YourReading from "@/components/pages/book/YourReading";
import { tidyGenres } from "@/lib/genres";
import { countdown, daysUntil, isDateTbc } from "@/lib/releases/dates";
import { generateBookSlug } from "@/lib/slugify";

// Both covers (phone header, tablet+ cubby) share one `sizes`, so whichever
// is visible picks the same srcset candidate and the image is fetched once.
const COVER_SIZES = "(min-width: 768px) 200px, 136px";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A book's own page: the cover standing in its cubby, the facts a reader
 * decides with (genre, length, year), where you are with it if it's yours,
 * what other readers thought, and more by the same author.
 */
export default function BookPage({ book, moreByAuthor = [] }) {
  const { title, authors = [], description } = book;
  const author = authors[0];
  const year = book.published_date?.slice(0, 4);
  const genres = tidyGenres(book.genres).slice(0, 6);
  const [summary, setSummary] = useState(null);
  const onSummary = useCallback((s) => setSummary(s), []);
  const release = useRelease(book.published_date);

  const facts = [
    book.page_count && `${book.page_count.toLocaleString()} pages`,
    release ? release.date : year,
    book.publisher
  ].filter(Boolean);

  return (
    <div className="BookPage">
      <div className="page-x mx-auto max-w-[1600px] pt-2 sm:pt-6 md:pt-10 pb-24">
        <nav aria-label="Breadcrumb" className="mb-3 sm:mb-6 md:mb-10">
          <ol className="flex items-center gap-1 label text-textSecondary min-w-0">
            <li className="shrink-0">
              {/* 40px tall: on phones this is the back link */}
              <Link
                href="/discover"
                className="inline-flex items-center gap-1.5 h-10 -ml-2 px-2 rounded-[8px] hover:text-ink hover:bg-paper-2 transition-colors focus-ring"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:hidden" aria-hidden="true">
                  <path d="M10 3L5 8l5 5" />
                </svg>
                Discover
              </Link>
            </li>
            <li aria-hidden="true" className="hidden md:block">/</li>
            <li className="hidden md:block truncate text-textPrimary px-1" aria-current="page">
              {title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-6 md:gap-10 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-16">
          {/* The book, standing in its cubby (tablet and up) */}
          <div className="hidden md:block md:sticky md:top-24 self-start w-full">
            <Bookcase base>
              <Shelf grid={false} booksClassName="justify-center !pt-8 !pb-3">
                <div className="w-[66%] relative z-10">
                  <BookCover book={book} eager sizes={COVER_SIZES} />
                </div>
              </Shelf>
            </Bookcase>
          </div>

          <div className="min-w-0 flex flex-col gap-6 md:gap-8">
            <header className="flex items-start gap-4 xs:gap-5">
              {/* Phones: a compact cover beside the title keeps the actions in view */}
              <div className="md:hidden w-[104px] xs:w-[120px] sm:w-[136px] shrink-0">
                <BookCover book={book} eager sizes={COVER_SIZES} />
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-1.5 md:gap-3">
                {(genres[0] || release) && (
                  <p className="label text-textSecondary">
                    {genres[0]}
                    {genres[0] && release && <span aria-hidden="true"> · </span>}
                    {release && <span className="text-shelved">{release.countdown}</span>}
                  </p>
                )}
                <h1 className="font-ppMondwest text-ink text-[26px] xs:text-[30px] sm:text-[36px] md:text-[46px] leading-[1.05] break-words">
                  {title}
                </h1>
                {author && (
                  <p className="font-ppMondwest text-[17px] sm:text-[20px] md:text-[22px] leading-snug text-textSecondary">
                    by <span className="text-textPrimary">{authors.join(", ")}</span>
                  </p>
                )}
                {facts.length > 0 && (
                  <p className="font-ppMondwest text-[15px] md:text-[16px] leading-snug text-textSecondary">
                    {facts.join(" · ")}
                  </p>
                )}
                <ReadersSummary summary={summary} upcoming={!!release} />
              </div>
            </header>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col xs:flex-row gap-2">
                <AddToShelfButton book={book} size="lg" className="w-full xs:w-auto xs:min-w-[240px]" />
                <BuyButton
                  isbn_13={book.isbn_13}
                  title={title}
                  authors={authors}
                  variant="secondary"
                  size="lg"
                  preorder={!!release}
                  className="w-full xs:w-auto"
                />
              </div>
              <YourReading book={book} />
            </div>

            <section aria-labelledby="about-heading" className="flex flex-col gap-3">
              <h2 id="about-heading" className="label text-textSecondary">
                About this book
              </h2>
              <Description text={description} />
              {genres.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 pt-2" aria-label="Genres">
                  {genres.map((g) => (
                    <li key={g} className="chip">
                      {g}
                    </li>
                  ))}
                </ul>
              )}
              {book.isbn_13 && (
                <p className="label !text-[10px] text-textSecondary pt-1">ISBN {book.isbn_13}</p>
              )}
            </section>

            <section aria-labelledby="readers-heading" className="flex flex-col gap-3">
              <h2 id="readers-heading" className="label text-textSecondary">
                On readers’ shelves
              </h2>
              <BookReaders book={book} onSummary={onSummary} />
            </section>
          </div>
        </div>

        {moreByAuthor.length > 0 && (
          <section aria-labelledby="more-heading" className="mt-16 md:mt-20">
            <h2 id="more-heading" className="font-ppMondwest text-[24px] sm:text-[26px] text-ink mb-5">
              More by {author}
            </h2>
            {moreByAuthor.length < 4 ? (
              <CoverRow books={moreByAuthor} />
            ) : (
              <Bookcase>
                <Shelf>
                  {moreByAuthor.slice(0, 9).map((b, i) => (
                    <div
                      key={b.id}
                      className={
                        i >= 6 ? "hidden lg:block" : i >= 4 ? "hidden md:block" : i >= 3 ? "hidden xs:block" : ""
                      }
                    >
                      <Book book={b} />
                    </div>
                  ))}
                </Shelf>
              </Bookcase>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * For a book that isn't out yet: "Out 12 January 2027" and "Out in 9 weeks".
 * Null once it's out, or when only a year is known.
 */
function useRelease(date) {
  const [now] = useState(() => Date.now());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || daysUntil(date, now) < 0) return null;
  const d = new Date(`${date}T00:00:00`);
  if (isDateTbc(date, now)) return { date: `Out in ${d.getFullYear()}`, countdown: "Coming soon" };
  const c = countdown(date, now);
  return {
    date: `Out ${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    countdown: c.n === "Out" ? "Out today" : `Out in ${c.n} ${c.unit}`
  };
}

/**
 * "★ 4.2 · 12 readers" under the title. Always takes its line, with a
 * placeholder while readers load, so nothing below it jumps.
 */
function ReadersSummary({ summary, upcoming }) {
  return (
    <p className="label text-textSecondary flex items-center gap-2 min-h-[18px] mt-0.5">
      {summary === null ? (
        <span className="w-28 h-3 rounded-[3px] bg-paper-3 animate-pulse" aria-hidden="true" />
      ) : summary.count > 0 ? (
        <>
          {summary.average > 0 && (
            <>
              <span className="text-[#9a6700]">★ {summary.average.toFixed(1)}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          {summary.count} {upcoming ? "waiting" : summary.count === 1 ? "reader" : "readers"}
        </>
      ) : upcoming ? (
        "No one waiting yet"
      ) : (
        "No readers yet"
      )}
    </p>
  );
}

/** A short list of covers with captions — a bookcase would be mostly empty. */
function CoverRow({ books }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-8 sm:gap-x-8">
      {books.map((b) => (
        <li key={b.id} className="w-[104px] sm:w-[128px]">
          <Book book={b} />
          <Link
            href={`/books/${generateBookSlug(b.title, b.authors?.[0])}`}
            className="mt-3 block font-ppMondwest text-[15px] leading-snug text-ink line-clamp-2 hover:underline underline-offset-2 focus-ring rounded-[4px]"
          >
            {b.title}
          </Link>
          {b.published_date && (
            <p className="mt-1 label text-textSecondary">{b.published_date.slice(0, 4)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Description({ text }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Whether "Read more" is needed depends on how the text wraps at this
  // width, not its length — measure the clamped box, and again on resize.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);

  if (!text) {
    return (
      <p className="font-ppMondwest text-[17px] text-textSecondary">
        No description yet.
      </p>
    );
  }
  const paragraphs = text.split(/\n+/).filter(Boolean);
  return (
    <div>
      <div
        ref={ref}
        id="book-description"
        className={`prose-book ${open ? "" : "line-clamp-6 md:line-clamp-[9]"}`}
      >
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="book-description"
          className="mt-1 h-10 -ml-2 px-2 label text-ink underline underline-offset-4 hover:no-underline focus-ring rounded-[6px]"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
