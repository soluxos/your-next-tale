"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";
import BookReviewModal from "@/components/shelves/BookReviewModal";
import StatusIcon, { statusName } from "@/components/book/StatusIcon";

const FIELDS =
  "id, book_id, rating, review, progress_pages, progress_percent, date_started, date_finished, books (id, title, authors, cover_url, page_count, isbn_13)";

const formatDate = (d) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : null;

/**
 * "Your reading" on a book page: where the signed-in reader is with this
 * book — status, rating, progress and review — with the full editor
 * (BookReviewModal) one tap away. Renders nothing if the book isn't theirs.
 */
export default function YourReading({ book }) {
  const { profile } = useAuth();
  const library = useLibrary();
  const entry = library.entryForBook(book);
  const status = library.statusShelfFor(entry);
  const userId = library.userId;
  // The reader may own a different catalogue copy of this book.
  const ownedBookId = entry?.bookId || null;
  const key = entry ? `${entry.userBookId || ""}:${ownedBookId}` : null;

  // Keyed to the entry it was loaded for, so a stale row never shows after
  // the book is removed and added again.
  const [loaded, setLoaded] = useState({ key: null, row: null });
  const row = loaded.key === key ? loaded.row : null;
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!key || !userId) return;
    let cancelled = false;
    createClient()
      .from("user_books")
      .select(FIELDS)
      .eq("user_id", userId)
      .eq("book_id", ownedBookId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLoaded({ key, row: data || null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, userId, ownedBookId]);

  // Edits saved from the modal (or from anywhere else, e.g. the home page)
  // arrive as "updated" events; patch the panel in place.
  useEffect(
    () =>
      library.subscribe((ev) => {
        if (ev.type !== "updated") return;
        setLoaded((l) =>
          l.row && (l.row.id === ev.userBookId || l.row.book_id === ev.bookId)
            ? { ...l, row: { ...l.row, ...ev.fields } }
            : l
        );
      }),
    [library.subscribe]
  );

  if (!entry) return null;
  if (!row) {
    return <div className="card h-[172px] bg-paper-2 border-transparent animate-pulse" aria-hidden="true" />;
  }

  const modalBook = row.book_id === book.id || !row.books ? book : { ...book, ...row.books };
  const pageCount = modalBook.page_count || null;
  const slug = status?.slug;
  const reading = slug === "currently-reading";
  const dnf = slug === "did-not-finish";
  const want = slug === "want-to-read";
  const percent =
    row.progress_percent ??
    (pageCount && row.progress_pages ? Math.min(100, Math.round((row.progress_pages / pageCount) * 100)) : 0);
  const hasProgress = !!row.progress_pages || percent > 0;

  const showProgress = reading || (dnf && hasProgress);
  const showRating = !want || row.rating > 0;
  const showReview = !want || !!row.review;

  const dateLine = reading
    ? row.date_started && `Started ${formatDate(row.date_started)}`
    : slug === "read"
      ? row.date_finished && `Finished ${formatDate(row.date_finished)}`
      : dnf
        ? row.date_finished && `Stopped ${formatDate(row.date_finished)}`
        : null;

  const progressText =
    pageCount && row.progress_pages
      ? { main: `Page ${row.progress_pages}`, rest: ` of ${pageCount.toLocaleString()} · ${percent}%` }
      : hasProgress
        ? { main: `${percent}%`, rest: " read" }
        : null;

  const open = () => setEditing(true);

  return (
    <section aria-labelledby="your-reading-heading" className="card">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 pb-1">
        <h2 id="your-reading-heading" className="label text-textSecondary">
          Your reading
        </h2>
        <button type="button" onClick={open} className="btn btn-ghost btn-sm -mr-2">
          Edit details
        </button>
      </div>

      <div className="divide-y divide-line">
        {/* Status and rating */}
        <div className="px-4 sm:px-5 pb-4 pt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-full bg-shelved-bg border border-shelved-line text-shelved flex items-center justify-center">
              <StatusIcon slug={slug} size={17} />
            </span>
            <div className="min-w-0">
              <p className="font-ppMondwest text-[19px] leading-tight text-ink">
                {statusName(status) || "In your library"}
              </p>
              {dateLine && <p className="label text-textSecondary mt-1">{dateLine}</p>}
              {want && !row.rating && (
                <p className="font-ppMondwest text-[15px] text-textSecondary mt-0.5">
                  When you start it, your progress will show here.
                </p>
              )}
            </div>
          </div>
          {showRating && (
            <button
              type="button"
              onClick={open}
              aria-label={row.rating ? `Your rating: ${row.rating} out of 5. Change it` : "Rate this book"}
              className="flex flex-col items-start xs:items-end gap-1 -m-1.5 p-1.5 rounded-[8px] hover:bg-paper-2 transition-colors focus-ring"
            >
              <Stars rating={row.rating || 0} />
              <span className="label !text-[10px] text-textSecondary">
                {row.rating ? "Your rating" : "Tap to rate"}
              </span>
            </button>
          )}
        </div>

        {showProgress && (
          <div className="px-4 sm:px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-ppMondwest text-[17px] text-ink tabular-nums">
                {progressText ? (
                  <>
                    {progressText.main}
                    <span className="text-textSecondary">{progressText.rest}</span>
                  </>
                ) : (
                  <span className="text-textSecondary">No progress logged yet</span>
                )}
              </p>
              <button type="button" onClick={open} className="btn btn-secondary btn-sm shrink-0">
                Update
              </button>
            </div>
            <div
              className="mt-3 h-1.5 rounded-full bg-paper-3 overflow-hidden"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Reading progress"
            >
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {showReview && (
          <div className="px-4 sm:px-5 py-4">
            {row.review ? (
              <div className="flex flex-col gap-2">
                <p className="font-ppMondwest text-[16px] leading-snug text-textPrimary line-clamp-3 whitespace-pre-line">
                  “{row.review}”
                </p>
                <button
                  type="button"
                  onClick={open}
                  className="self-start label text-ink underline underline-offset-4 hover:no-underline focus-ring rounded-[4px]"
                >
                  Edit review
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={open}
                className="w-[calc(100%+16px)] -m-2 p-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-left rounded-[8px] hover:bg-paper-2 transition-colors focus-ring"
              >
                <span className="font-ppMondwest text-[16px] text-textSecondary">
                  {reading
                    ? "Jot down your thoughts as you go."
                    : dnf
                      ? "Why did you put it down?"
                      : "What did you think?"}
                </span>
                <span className="label text-ink shrink-0 underline underline-offset-4">
                  {dnf ? "Add a note" : "Write a review"}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <BookReviewModal
          book={modalBook}
          userBook={row}
          username={profile?.username}
          isOwner
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}

function Stars({ rating }) {
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={i <= rating ? "#e3a008" : "none"}
          stroke={i <= rating ? "#e3a008" : "#8a8a8a"}
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}
