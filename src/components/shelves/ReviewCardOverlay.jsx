"use client";

import StarRating from "@/components/ui/StarRating";

const SNIPPET_LENGTH = 110;

/**
 * Reviews view: each cover carries its rating (always visible, so it works on
 * touch) and reveals a snippet of the review on hover / keyboard focus.
 */
export default function ReviewCardOverlay({ bookId, bookTitle, rating, review, onReviewClick }) {
  if (!rating && !review) return null;

  const snippet = review
    ? review.length > SNIPPET_LENGTH
      ? review.slice(0, review.lastIndexOf(" ", SNIPPET_LENGTH)).trimEnd() + "…"
      : review
    : null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onReviewClick(bookId);
      }}
      aria-label={`${review ? "Read review" : "See rating"}${bookTitle ? ` of ${bookTitle}` : ""}${
        rating ? ` — ${rating} out of 5 stars` : ""
      }`}
      className="group/review absolute inset-0 z-10 flex flex-col justify-end text-left rounded-[3px] overflow-hidden
                 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span
        className="flex flex-col gap-1 px-2 pb-2 pt-6 bg-gradient-to-t from-black/85 via-black/55 to-transparent
                   transition-[padding] duration-200 group-hover/review:pt-10 group-focus-visible/review:pt-10"
      >
        <span className="flex items-center justify-between gap-1 text-[#f6c453]">
          {rating ? <StarRating rating={rating} size={10} /> : <span />}
          {review && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/90 shrink-0" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </span>
        {snippet && (
          <span
            className="hidden group-hover/review:block group-focus-visible/review:block font-ppMondwest text-[12px]
                       leading-[1.3] text-white line-clamp-4"
          >
            &ldquo;{snippet}&rdquo;
          </span>
        )}
      </span>
    </button>
  );
}
