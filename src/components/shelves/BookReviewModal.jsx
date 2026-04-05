"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/utils/supabase/client";
import { updateUserBook } from "@/lib/userBooks";
import { addBookToShelf } from "@/lib/shelfBooks";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import Link from "next/link";

// Interactive star — looks identical to display stars; owner-only makes it clickable
function Star({ index, filled, interactive, onRate, onHover, onLeave }) {
  return (
    <button
      onClick={interactive ? () => onRate(index) : undefined}
      onMouseEnter={interactive ? () => onHover(index) : undefined}
      onMouseLeave={interactive ? onLeave : undefined}
      disabled={!interactive}
      className={
        interactive
          ? "transition-transform hover:scale-110 active:scale-95"
          : "cursor-default"
      }
      aria-label={interactive ? `Rate ${index} stars` : undefined}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={filled ? "#f59e0b" : "none"}
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}

function StarRow({ rating, interactive, onRate }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || rating;
  return (
    <div className="flex gap-[3px] items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          index={i}
          filled={i <= display}
          interactive={interactive}
          onRate={onRate}
          onHover={setHovered}
          onLeave={() => setHovered(0)}
        />
      ))}
      {interactive && rating > 0 && (
        <button
          onClick={() => onRate(0)}
          className="ml-2 font-departureMono uppercase text-[8px] text-textSecondary hover:text-red-500 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function SavedPulse({ visible }) {
  return (
    <span
      className={`font-departureMono text-[9px] text-green-600 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      Saved ✓
    </span>
  );
}

export default function BookReviewModal({
  book,
  userBook,
  profile, // shelf-owner profile (for visitor's reviewer row)
  username,
  isOwner,
  userId,
  shelves = [],
  currentShelfId,
  onClose,
  onUpdate,
  onShelfMove,
  onRemove
}) {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const coverUrl = book.cover_url
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${book.cover_url}`
    : null;

  // Owner editable state
  const [rating, setRating] = useState(userBook?.rating || 0);
  const [review, setReview] = useState(userBook?.review || "");
  const [progressPages, setProgressPages] = useState(
    userBook?.progress_pages || ""
  );
  const [progressPercent, setProgressPercent] = useState(
    userBook?.progress_percent || ""
  );
  const [dateStarted, setDateStarted] = useState(userBook?.date_started || "");
  const [dateFinished, setDateFinished] = useState(
    userBook?.date_finished || ""
  );
  const [selectedShelfId, setSelectedShelfId] = useState(currentShelfId || "");
  const [savedField, setSavedField] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const saved = (field) => savedField === field;

  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") close();
    },
    [close]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const save = useCallback(
    async (fields) => {
      if (!userBook?.id) return;
      try {
        await updateUserBook(
          supabase,
          userBook.id,
          fields,
          book.page_count || null
        );
        const fieldName = Object.keys(fields)[0];
        setSavedField(fieldName);
        setTimeout(() => setSavedField(null), 2000);
      } catch (e) {
        console.error("Error saving:", e);
      }
    },
    [userBook?.id, book.page_count]
  );

  const handleRating = async (value) => {
    setRating(value);
    await save({ rating: value || null });
    onUpdate?.(userBook.id, { rating: value || null });
  };

  const handleReviewBlur = async () => {
    await save({ review });
    onUpdate?.(userBook.id, { review });
  };

  const handlePagesChange = async (value) => {
    const pages = parseInt(value, 10) || 0;
    setProgressPages(pages);
    const percent =
      book.page_count > 0
        ? Math.round((pages / book.page_count) * 100)
        : parseInt(progressPercent, 10) || 0;
    setProgressPercent(percent);
    await save({ progress_pages: pages, progress_percent: percent });
    onUpdate?.(userBook.id, {
      progress_pages: pages,
      progress_percent: percent
    });
  };

  const handlePercentChange = async (value) => {
    const percent = parseInt(value, 10) || 0;
    setProgressPercent(percent);
    const pages =
      book.page_count > 0
        ? Math.round((percent / 100) * book.page_count)
        : parseInt(progressPages, 10) || 0;
    setProgressPages(pages);
    await save({ progress_percent: percent, progress_pages: pages });
    onUpdate?.(userBook.id, {
      progress_percent: percent,
      progress_pages: pages
    });
  };

  const handleShelfChange = async (newShelfId) => {
    const newShelf = shelves.find((s) => s.id === newShelfId);
    setSelectedShelfId(newShelfId);
    try {
      await addBookToShelf(supabase, userId, book.id, newShelfId);
      setSavedField("shelf");
      setTimeout(() => setSavedField(null), 2000);
      onShelfMove?.(userBook.id, newShelfId, newShelf?.name);
    } catch (e) {
      console.error("Error moving shelf:", e);
    }
  };

  const handleRemove = () => {
    setConfirmRemove(false);
    onRemove?.(userBook?.id);
    close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={close}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal panel */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 bg-white rounded-[12px] shadow-2xl
                       w-full max-w-lg max-h-[85vh] overflow-y-auto"
          >
            {/* Close */}
            <button
              onClick={close}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f4f4f4]
                         flex items-center justify-center hover:bg-[#e8e8e8]
                         transition-colors z-10"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="p-6">
              {/* Book header — identical for owner and visitor */}
              <div className="flex gap-4 mb-5">
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt={book.title}
                    className="w-16 h-24 object-cover rounded-[6px] shrink-0 shadow-sm"
                  />
                )}
                <div className="flex-1 min-w-0 pt-1">
                  <h2 className="font-ppMondwest text-[22px] leading-tight mb-1">
                    {book.title}
                  </h2>
                  <p className="font-departureMono uppercase text-[9px] text-textSecondary mb-3">
                    {book.authors?.join(", ")}
                  </p>
                  {/* Stars: interactive for owner, display-only for visitor */}
                  {(rating > 0 || isOwner) && (
                    <StarRow
                      rating={rating}
                      interactive={isOwner}
                      onRate={handleRating}
                    />
                  )}
                  {isOwner && (
                    <p className="font-departureMono text-[8px] text-textSecondary mt-1">
                      {rating === 0 ? (
                        "Click to rate"
                      ) : (
                        <SavedPulse visible={saved("rating")} />
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border mb-5" />

              {/* Visitor: reviewer row */}
              {!isOwner && profile && (
                <div className="flex items-center gap-2 mb-4">
                  <FacehashAvatar
                    name={profile.full_name || username}
                    color={profile.facehash_color}
                    size={28}
                  />
                  <div>
                    <Link
                      href={`/u/${username}`}
                      className="font-ppMondwest text-[14px] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {profile.full_name || username}
                    </Link>
                    <span className="font-departureMono uppercase text-[9px] text-textSecondary ml-2">
                      @{username}
                    </span>
                  </div>
                </div>
              )}

              {/* Review content */}
              {isOwner ? (
                /* Owner: inline editable textarea styled like plain text */
                <div className="relative">
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    onBlur={handleReviewBlur}
                    placeholder="Write your thoughts about this book..."
                    rows={4}
                    className="w-full bg-transparent font-departureMono text-[12px]
                               text-textPrimary leading-relaxed placeholder:text-[#bbb]
                               resize-none outline-none border border-transparent
                               rounded-[6px] p-2 -ml-2
                               hover:border-border focus:border-border
                               transition-colors"
                  />
                  <div className="flex justify-end mt-1 h-4">
                    <SavedPulse visible={saved("review")} />
                  </div>
                </div>
              ) : (
                /* Visitor: read-only review */
                <>
                  {userBook?.review ? (
                    <p className="font-departureMono text-[12px] text-textPrimary leading-relaxed whitespace-pre-wrap">
                      {userBook.review}
                    </p>
                  ) : (
                    <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                      {(userBook?.rating || 0) > 0
                        ? "Rating only — no written review"
                        : "No review yet"}
                    </p>
                  )}
                </>
              )}

              {/* ── Owner: expandable reading details ── */}
              {isOwner && (
                <div className="mt-5 border-t border-border pt-4">
                  <button
                    onClick={() => setDetailsOpen((o) => !o)}
                    className="flex items-center gap-1.5 font-departureMono uppercase text-[10px]
                               text-textSecondary hover:text-textPrimary transition-colors w-full text-left"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform duration-200 ${detailsOpen ? "rotate-90" : ""}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Reading details
                  </button>

                  <AnimatePresence>
                    {detailsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 space-y-4">
                          {/* Shelf */}
                          {shelves.length > 0 && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                                  Shelf
                                </label>
                                <SavedPulse visible={saved("shelf")} />
                              </div>
                              <select
                                className="w-full border border-border rounded-[8px] px-3 h-9
                                           font-departureMono text-[12px] bg-transparent
                                           focus:outline-none focus:ring-1 focus:ring-textPrimary"
                                value={selectedShelfId}
                                onChange={(e) =>
                                  handleShelfChange(e.target.value)
                                }
                              >
                                <option value="">Select a shelf...</option>
                                {shelves.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Progress */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                                Progress
                              </label>
                              <SavedPulse
                                visible={
                                  saved("progress_pages") ||
                                  saved("progress_percent")
                                }
                              />
                            </div>
                            <div className="flex gap-2 items-center">
                              <input
                                type="number"
                                min={0}
                                max={book.page_count || undefined}
                                value={progressPages}
                                onChange={(e) =>
                                  handlePagesChange(e.target.value)
                                }
                                placeholder="Pages"
                                className="w-24 border border-border rounded-[8px] px-3 h-9
                                           font-departureMono text-[12px] bg-transparent
                                           focus:outline-none focus:ring-1 focus:ring-textPrimary"
                              />
                              <span className="font-departureMono uppercase text-[10px] text-textSecondary">
                                / {book.page_count || "?"} pages
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={progressPercent}
                                onChange={(e) =>
                                  handlePercentChange(e.target.value)
                                }
                                placeholder="%"
                                className="w-20 border border-border rounded-[8px] px-3 h-9
                                           font-departureMono text-[12px] bg-transparent
                                           focus:outline-none focus:ring-1 focus:ring-textPrimary"
                              />
                              <span className="font-departureMono uppercase text-[10px] text-textSecondary">
                                %
                              </span>
                            </div>
                          </div>

                          {/* Dates */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                                  Started
                                </label>
                                <SavedPulse visible={saved("date_started")} />
                              </div>
                              <input
                                type="date"
                                value={dateStarted}
                                onChange={(e) => {
                                  setDateStarted(e.target.value);
                                  save({
                                    date_started: e.target.value || null
                                  });
                                  onUpdate?.(userBook.id, {
                                    date_started: e.target.value || null
                                  });
                                }}
                                className="w-full border border-border rounded-[8px] px-3 h-9
                                           font-departureMono text-[12px] bg-transparent
                                           focus:outline-none focus:ring-1 focus:ring-textPrimary"
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                                  Finished
                                </label>
                                <SavedPulse visible={saved("date_finished")} />
                              </div>
                              <input
                                type="date"
                                value={dateFinished}
                                onChange={(e) => {
                                  setDateFinished(e.target.value);
                                  save({
                                    date_finished: e.target.value || null
                                  });
                                  onUpdate?.(userBook.id, {
                                    date_finished: e.target.value || null
                                  });
                                }}
                                className="w-full border border-border rounded-[8px] px-3 h-9
                                           font-departureMono text-[12px] bg-transparent
                                           focus:outline-none focus:ring-1 focus:ring-textPrimary"
                              />
                            </div>
                          </div>

                          {/* Remove */}
                          {onRemove && (
                            <div className="pt-2 border-t border-border">
                              {confirmRemove ? (
                                <div className="flex items-center gap-2">
                                  <p className="font-departureMono uppercase text-[10px] text-red-600 flex-1">
                                    Remove this book?
                                  </p>
                                  <button
                                    onClick={handleRemove}
                                    className="h-7 px-3 font-departureMono uppercase text-[10px]
                                               bg-red-500 text-white rounded-[6px] hover:bg-red-600
                                               transition-colors"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setConfirmRemove(false)}
                                    className="h-7 px-3 font-departureMono uppercase text-[10px]
                                               border border-border rounded-[6px] hover:bg-[#f4f4f4]
                                               transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmRemove(true)}
                                  className="w-full font-departureMono uppercase text-[10px]
                                             text-red-500 hover:text-red-600 py-2
                                             hover:bg-red-50 rounded-[8px] transition-colors"
                                >
                                  Remove from shelf
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
