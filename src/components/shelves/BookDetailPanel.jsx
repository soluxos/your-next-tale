"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateUserBook } from "@/lib/userBooks";
import { addBookToShelf } from "@/lib/shelfBooks";
import BuyButton from "@/components/book/BuyButton";
import { TABLES } from "@/lib/supabase/types";

function StarIcon({ filled, half }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "#F59E0B" : "none"}
      stroke="#F59E0B"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function BookDetailPanel({
  book,
  userBook,
  userId,
  shelves = [],
  currentShelfId = null,
  onClose,
  onUpdate,
  onShelfMove,
  onRemove,
  readOnly = false
}) {
  const supabase = createClient();
  const [fullBook, setFullBook] = useState(book);

  // Safety net: if book is missing description but has isbn, re-fetch from DB
  useEffect(() => {
    if (!book.description && (book.isbn_13 || book.id)) {
      const col = book.isbn_13 ? "isbn_13" : "id";
      const val = book.isbn_13 || book.id;
      supabase
        .from(TABLES.BOOKS)
        .select("*")
        .eq(col, val)
        .single()
        .then(({ data }) => {
          if (data) setFullBook(data);
        });
    } else {
      setFullBook(book);
    }
  }, [book.id, book.isbn_13]);

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

  const coverSrc = fullBook.cover_url
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${fullBook.cover_url}`
    : null;

  const save = useCallback(
    async (fields) => {
      if (readOnly || !userBook?.id) return;
      try {
        await updateUserBook(
          supabase,
          userBook.id,
          fields,
          fullBook.page_count || null
        );
        const fieldName = Object.keys(fields)[0];
        setSavedField(fieldName);
        setTimeout(() => setSavedField(null), 2000);
      } catch (e) {
        console.error("Error saving:", e);
      }
    },
    [userBook?.id, fullBook.page_count, readOnly]
  );

  const handleRating = async (value) => {
    const newRating = value === rating ? 0 : value;
    setRating(newRating);
    await save({ rating: newRating });
    onUpdate?.(userBook.id, { rating: newRating });
  };

  const handleReviewBlur = async () => {
    await save({ review });
    onUpdate?.(userBook.id, { review });
  };

  const handlePagesChange = async (value) => {
    const pages = parseInt(value, 10) || 0;
    setProgressPages(pages);
    const percent =
      fullBook.page_count > 0
        ? Math.round((pages / fullBook.page_count) * 100)
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
      fullBook.page_count > 0
        ? Math.round((percent / 100) * fullBook.page_count)
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
      await addBookToShelf(supabase, userId, fullBook.id, newShelfId);
      setSavedField("shelf");
      setTimeout(() => setSavedField(null), 2000);
      onShelfMove?.(userBook.id, newShelfId, newShelf?.name);
    } catch (e) {
      console.error("Error moving to shelf:", e);
    }
  };

  const handleRemove = () => {
    setConfirmRemove(false);
    onRemove?.(userBook.id);
    onClose();
  };

  const progressPct = parseInt(progressPercent, 10) || 0;

  function SavedIndicator({ field }) {
    return (
      <span
        className={`font-departureMono text-[9px] text-green-600 transition-opacity duration-300 ml-2 ${
          savedField === field ? "opacity-100" : "opacity-0"
        }`}
      >
        Saved ✓
      </span>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-ppMondwest text-xl">
            {fullBook.title}
          </SheetTitle>
          <SheetDescription className="font-departureMono uppercase text-[10px] text-textSecondary">
            {fullBook.authors?.join(", ")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Cover */}
          {coverSrc && (
            <div className="flex justify-center">
              <img
                src={coverSrc}
                alt={fullBook.title}
                className="w-32 h-auto rounded-sm shadow-md"
              />
            </div>
          )}

          {/* Buy button */}
          <BuyButton
            isbn_13={fullBook.isbn_13}
            title={fullBook.title}
            authors={fullBook.authors}
            className="w-full"
          />

          {/* Genres */}
          {Array.isArray(fullBook.genres) && fullBook.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {fullBook.genres.map((genre, i) => (
                <span
                  key={i}
                  className="font-departureMono uppercase text-[9px] px-2 py-1 rounded-full bg-[#f4f4f4] text-textSecondary"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {!readOnly && (
            <>
              {/* Shelf selector */}
              {shelves.length > 0 && (
                <div className="space-y-1">
                  <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                    Shelf
                    <SavedIndicator field="shelf" />
                  </label>
                  <select
                    className="w-full border border-border rounded-[8px] p-2 text-sm font-departureMono"
                    value={selectedShelfId}
                    onChange={(e) => handleShelfChange(e.target.value)}
                  >
                    <option value="">Select a shelf...</option>
                    {shelves.map((shelf) => (
                      <option key={shelf.id} value={shelf.id}>
                        {shelf.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rating */}
              <div className="space-y-1">
                <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                  Rating
                  <SavedIndicator field="rating" />
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRating(star)}
                      className="transition-opacity hover:opacity-75"
                    >
                      <StarIcon filled={star <= rating} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Review */}
              <div className="space-y-1">
                <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                  Review
                  <SavedIndicator field="review" />
                </label>
                <textarea
                  className="w-full border border-border rounded-[8px] p-2 text-sm font-departureMono min-h-[80px]"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  onBlur={handleReviewBlur}
                  placeholder="Write your thoughts..."
                />
              </div>

              {/* Reading progress */}
              <div className="space-y-1">
                <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                  Reading Progress
                  <SavedIndicator field="progress_pages" />
                  <SavedIndicator field="progress_percent" />
                </label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min={0}
                    max={fullBook.page_count || undefined}
                    value={progressPages}
                    onChange={(e) => handlePagesChange(e.target.value)}
                    placeholder="Pages"
                    className="w-24 font-departureMono text-[12px]"
                  />
                  <span className="font-departureMono uppercase text-[10px] text-textSecondary">
                    / {fullBook.page_count || "?"} pages
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={progressPercent}
                    onChange={(e) => handlePercentChange(e.target.value)}
                    placeholder="%"
                    className="w-20 font-departureMono text-[12px]"
                  />
                  <span className="font-departureMono uppercase text-[10px] text-textSecondary">
                    %
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                    Date Started
                    <SavedIndicator field="date_started" />
                  </label>
                  <Input
                    type="date"
                    value={dateStarted}
                    onChange={(e) => {
                      setDateStarted(e.target.value);
                      save({ date_started: e.target.value || null });
                      onUpdate?.(userBook.id, {
                        date_started: e.target.value || null
                      });
                    }}
                    className="font-departureMono text-[12px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                    Date Finished
                    <SavedIndicator field="date_finished" />
                  </label>
                  <Input
                    type="date"
                    value={dateFinished}
                    onChange={(e) => {
                      setDateFinished(e.target.value);
                      save({ date_finished: e.target.value || null });
                      onUpdate?.(userBook.id, {
                        date_finished: e.target.value || null
                      });
                    }}
                    className="font-departureMono text-[12px]"
                  />
                </div>
              </div>

              {/* Remove from shelf */}
              {onRemove && (
                <div className="pt-2 border-t border-border">
                  {confirmRemove ? (
                    <div className="flex items-center gap-2">
                      <p className="font-departureMono uppercase text-[10px] text-red-600 flex-1">
                        Remove this book?
                      </p>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleRemove}
                        className="font-departureMono uppercase text-[10px] rounded-[8px]"
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmRemove(false)}
                        className="font-departureMono uppercase text-[10px] rounded-[8px]"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmRemove(true)}
                      className="font-departureMono uppercase text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50 rounded-[8px] w-full"
                    >
                      Remove from shelf
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Read-only display */}
          {readOnly && userBook && (
            <div className="space-y-4">
              {userBook.rating > 0 && (
                <div className="space-y-1">
                  <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                    Rating
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <StarIcon key={star} filled={star <= userBook.rating} />
                    ))}
                  </div>
                </div>
              )}
              {userBook.review && (
                <div className="space-y-1">
                  <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                    Review
                  </label>
                  <p className="text-sm text-textPrimary">{userBook.review}</p>
                </div>
              )}
              {(userBook.progress_percent > 0 ||
                userBook.progress_pages > 0) && (
                <div className="space-y-1">
                  <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                    Progress
                  </label>
                  <div className="w-full h-2 bg-[#e0e0e0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-textPrimary rounded-full transition-all"
                      style={{
                        width: `${Math.min(userBook.progress_percent || 0, 100)}%`
                      }}
                    />
                  </div>
                  <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                    {userBook.progress_percent}%
                    {userBook.progress_pages > 0 &&
                      ` · ${userBook.progress_pages} pages`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
