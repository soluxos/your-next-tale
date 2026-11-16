"use client";

import Link from "next/link";
import Book from "@/components/book/book";
import SectionHeading, { SectionLink } from "@/components/hero/SectionHeading";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { generateBookSlug } from "@/lib/slugify";
import { cn } from "@/lib/utils";

// Eight across on a wide screen, six on a laptop, a swipeable strip on phones:
// the same row as Up next, so covers stay near the size they were scanned at.
const SHOW = 8;

/** The books a row shows: for a signed-in reader, only ones not on a shelf yet. */
export function useRowBooks(books) {
  const library = useLibrary();
  const list = books || [];
  return (library.userId && library.ready ? list.filter((b) => !library.getEntry(b.id)) : list).slice(0, SHOW);
}

/** A row of covers with their titles. Hover a cover for the card; click for details. */
export function CoverRow({ books, className }) {
  return (
    <ul
      className={cn(
        "flex gap-5 sm:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 -mx-4 px-4 pt-2 pb-2 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-6 xl:grid-cols-8 lg:overflow-visible",
        className
      )}
    >
      {books.map((book) => (
        <li
          key={book.id}
          className="w-[36%] xs:w-[140px] sm:w-[150px] shrink-0 snap-start lg:w-auto lg:max-xl:[&:nth-child(n+7)]:hidden"
        >
          <Book book={book} />
          <Link
            href={`/books/${generateBookSlug(book.title, book.authors?.[0])}`}
            tabIndex={-1}
            className="mt-4 block font-ppMondwest text-[16px] leading-[1.2] text-ink line-clamp-2 hover:underline underline-offset-4"
          >
            {book.title}
          </Link>
          {book.authors?.[0] && <p className="mt-1 text-[12.5px] text-textSecondary truncate">{book.authors[0]}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Home: one titled row from the catalogue, with a link to the rest. */
export default function BookRow({ id, title, description, href, linkLabel, books, className }) {
  const shown = useRowBooks(books);
  if (!shown.length) return null;
  return (
    <section aria-labelledby={id} className={cn("page-x mx-auto max-w-[1600px]", className)}>
      <SectionHeading
        id={id}
        title={title}
        description={description}
        stackUntil="none"
        action={href && <SectionLink href={href}>{linkLabel}</SectionLink>}
      />
      <CoverRow books={shown} />
    </section>
  );
}
