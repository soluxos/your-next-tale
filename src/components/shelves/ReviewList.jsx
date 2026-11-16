"use client";

import BookCover from "@/components/book/BookCover";
import StarRating from "@/components/ui/StarRating";

const finishedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

function finishedLabel(date) {
  if (!date) return null;
  const d = new Date(String(date).length === 10 ? `${date}T00:00:00Z` : date);
  return Number.isNaN(d.getTime()) ? null : `Finished ${finishedFormat.format(d)}`;
}

/**
 * The Reviews view: a reading list rather than a wall of covers. Each card
 * shows the cover small, the rating, the first lines of the review and when
 * the book was finished, and opens the full review. Books that were only
 * rated show their stars and nothing else.
 *
 * Cards are real links to the review's own URL (open in a new tab, copy the
 * link); a plain click calls `onOpen` so the modal opens in place.
 */
export default function ReviewList({ items, username, shelfSlug, onOpen }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item) => {
        const { book, user_book: ub } = item;
        const href = `/u/${encodeURIComponent(username)}/${shelfSlug}/review/${book.id}`;
        const review = ub?.review?.trim().replace(/\s+/g, " ");
        const finished = finishedLabel(ub?.date_finished);
        const author = book.authors?.[0];
        return (
          <li key={item.id}>
            <article
              className="card card-hover relative h-full flex gap-4 p-4 has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ink"
            >
              <div className="w-12 sm:w-16 shrink-0 self-start">
                <BookCover book={book} sizes="64px" />
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <h3 className="font-ppMondwest text-[18px] leading-tight text-ink line-clamp-2">
                  {/* The title link stretches over the whole card */}
                  <a
                    href={href}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
                      e.preventDefault();
                      onOpen(book.id);
                    }}
                    className="outline-none after:absolute after:inset-0 after:rounded-[12px] after:content-['']"
                  >
                    {book.title}
                  </a>
                </h3>
                {author && <p className="label text-textSecondary truncate mt-1">{author}</p>}
                {ub?.rating ? (
                  <div className="mt-2 flex items-center gap-2">
                    <StarRating rating={ub.rating} size={13} />
                    <span className="sr-only">{ub.rating} out of 5 stars</span>
                  </div>
                ) : null}
                {review && (
                  <p className="mt-2 font-ppMondwest text-[15.5px] leading-[1.45] text-textPrimary line-clamp-3">
                    {review}
                  </p>
                )}
                {(finished || review) && (
                  <div className="mt-auto pt-3 flex items-center justify-between gap-3">
                    <span className="label text-textSecondary">{finished}</span>
                    {review && (
                      <span className="label text-ink inline-flex items-center gap-1 shrink-0" aria-hidden="true">
                        Read review
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 3l5 5-5 5" />
                        </svg>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

/** Card-shaped placeholders while the shelf loads in Reviews view. */
export function ReviewListSkeleton({ count = 4 }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="card flex gap-4 p-4">
          <div className="w-12 sm:w-16 shrink-0 rounded-[3px] bg-paper-3 animate-pulse" style={{ aspectRatio: "2 / 3" }} />
          <div className="flex-1 flex flex-col gap-2.5 pt-1">
            <div className="h-4 w-2/3 rounded-[6px] bg-paper-3 animate-pulse" />
            <div className="h-3 w-1/3 rounded-[6px] bg-paper-3 animate-pulse" />
            <div className="h-3 w-full rounded-[6px] bg-paper-3 animate-pulse mt-2" />
            <div className="h-3 w-5/6 rounded-[6px] bg-paper-3 animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}
