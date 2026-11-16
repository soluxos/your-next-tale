"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useLibrary } from "@/components/providers/LibraryProvider";
import BookCover from "@/components/book/BookCover";
import { readingProgress } from "@/components/shelves/CoverProgress";
import { cn } from "@/lib/utils";

const SHOWN = 4;

/**
 * The first few books on Currently Reading, in shelf order, kept in step
 * with progress logged or books moved anywhere in the app. `items` is null
 * until loaded; `count` is how many are on the shelf in all.
 */
export function useCurrentlyReading() {
  const library = useLibrary();
  const shelf = library.statusShelves.find((s) => s.slug === "currently-reading");
  const [items, setItems] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      library.subscribe((ev) => {
        // Progress edits patch in place; shelf moves change which books show.
        if (ev.type === "updated") {
          setItems((prev) =>
            prev?.map((r) =>
              r.user_books.id === ev.userBookId ? { ...r, user_books: { ...r.user_books, ...ev.fields } } : r
            )
          );
        } else {
          setVersion((v) => v + 1);
        }
      }),
    [library.subscribe]
  );

  useEffect(() => {
    if (!shelf) return;
    let cancelled = false;
    createClient()
      .from("bookshelf_books")
      .select(
        "id, position, user_books (id, rating, review, progress_pages, progress_percent, date_started, date_finished, books (id, title, authors, cover_url, page_count))"
      )
      .eq("bookshelf_id", shelf.id)
      .order("position", { ascending: true, nullsFirst: false })
      .limit(SHOWN)
      .then(({ data }) => {
        if (!cancelled) setItems((data || []).filter((r) => r.user_books?.books));
      });
    return () => {
      cancelled = true;
    };
  }, [shelf?.id, version]);

  let count = 0;
  if (shelf) for (const e of library.entries.values()) if (e.shelfIds.includes(shelf.id)) count++;

  // A library with no Currently Reading shelf simply has nothing on the go.
  const loaded = library.ready && (!shelf || items !== null);
  return { shelf, items: loaded ? (shelf ? items : []) : null, count };
}

// Covers stay at a size the stored images can fill without being enlarged
// (most are about 320px wide, and a 2x screen draws 140px from 280).
// Three on phones and small laptops, four where there's room.
const SLOT =
  "relative flex-1 min-w-0 max-w-[140px] lg:flex-none lg:w-[132px] xl:w-[140px] [&:nth-child(4)]:hidden sm:[&:nth-child(4)]:block lg:[&:nth-child(4)]:hidden xl:[&:nth-child(4)]:block";
const ROW = "flex items-start gap-4 sm:gap-6";

/**
 * The hero's "Reading now": the books you're in the middle of, each with how
 * far through you are. A book opens the log-progress sheet.
 */
export default function ReadingNow({ items, count, shelfHref, onOpen, empty }) {
  const loading = items === null;
  const more = count > items?.length;
  return (
    <div aria-busy={loading || undefined}>
      <div className="flex items-center justify-between gap-4 min-h-5">
        {loading ? (
          <span className="h-3 w-28 rounded bg-paper-2 animate-pulse" aria-hidden="true" />
        ) : (
          <p className="label text-textSecondary">
            Reading now
            {count > 0 && (
              <>
                <span aria-hidden="true" className="mx-2 opacity-60">·</span>
                {count}
              </>
            )}
          </p>
        )}
        {shelfHref && count > 0 && (
          <Link
            href={shelfHref}
            className="label text-textPrimary hover:text-ink inline-flex items-center gap-1.5 rounded-[4px] focus-ring group"
          >
            {more ? `See all ${count}` : "See shelf"}
            <Chevron />
          </Link>
        )}
      </div>

      <div className={cn(ROW, "mt-5 sm:mt-6")}>
        {loading
          ? Array.from({ length: SHOWN }, (_, i) => (
              <div key={i} className={SLOT} aria-hidden="true">
                <div className="aspect-[2/3] rounded-[3px] bg-paper-2 animate-pulse" />
                <span className="mt-4 block h-[14px] w-[80%] rounded bg-paper-2 animate-pulse" />
                <span className="mt-2 block h-[11px] w-[50%] rounded bg-paper-2 animate-pulse" />
              </div>
            ))
          : items.length
            ? items.map(({ id, user_books: ub }) => <Reading key={id} userBook={ub} onOpen={() => onOpen(ub)} />)
            : empty}
      </div>
    </div>
  );
}

function Reading({ userBook, onOpen }) {
  const book = userBook.books;
  const progress = readingProgress(userBook, book.page_count);
  const by = book.authors?.[0] ? ` by ${book.authors[0]}` : "";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${book.title}${by}. ${progress?.spoken ?? "No progress logged yet"}. Update progress`}
      className={cn(SLOT, "group text-left rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink")}
    >
      <span className="block transition-transform duration-200 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
        <BookCover book={book} sizes="(max-width: 640px) 30vw, 140px" eager />
      </span>
      <span className="mt-4 block font-ppMondwest text-[15px] sm:text-[16px] leading-[1.2] text-ink line-clamp-2 group-hover:underline underline-offset-2 decoration-1">
        {book.title}
      </span>
      {book.authors?.[0] && (
        <span className="mt-1 block text-[12.5px] text-textSecondary truncate">{book.authors[0]}</span>
      )}
      {progress && (
        <span className="mt-3 flex items-center gap-2">
          {progress.pct !== null && (
            <span className="h-[3px] flex-1 rounded-full bg-black/10 overflow-hidden">
              <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(progress.pct, 4)}%` }} />
            </span>
          )}
          <span className="label !text-[10.5px] text-textPrimary tabular-nums whitespace-nowrap">
            {progress.pct !== null ? `${progress.pct}%` : progress.label}
          </span>
        </span>
      )}
    </button>
  );
}

/** An empty slot, sized like a cover, for when nothing's on the go. */
export function EmptySlot({ onClick, href, children }) {
  const className = cn(
    SLOT,
    "aspect-[2/3] rounded-[4px] border border-dashed border-black/20 hover:border-black/40 hover:bg-white/60",
    "flex flex-col items-center justify-center gap-2 p-3 text-center transition-colors focus-ring"
  );
  const inner = (
    <>
      <span className="w-8 h-8 rounded-full bg-white border border-line flex items-center justify-center text-ink" aria-hidden="true">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M8 2v12M2 8h12" />
        </svg>
      </span>
      <span className="label !text-[10.5px] text-textPrimary leading-tight">{children}</span>
    </>
  );
  return href ? (
    <a href={href} className={className}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
