"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateUserBook } from "@/lib/userBooks";
import { getUserShelves } from "@/lib/bookshelves";
import { addBookToShelf } from "@/lib/shelfBooks";

export default function BookDetailPanel({
  book,
  userBook,
  userId,
  onClose,
  onUpdate,
  readOnly = false,
}) {
  const supabase = createClient();

  const [rating, setRating] = useState(userBook?.rating || 0);
  const [review, setReview] = useState(userBook?.review || "");
  const [progressPages, setProgressPages] = useState(
    userBook?.progress_pages || ""
  );
  const [progressPercent, setProgressPercent] = useState(
    userBook?.progress_percent || ""
  );
  const [dateStarted, setDateStarted] = useState(
    userBook?.date_started || ""
  );
  const [dateFinished, setDateFinished] = useState(
    userBook?.date_finished || ""
  );
  const [shelves, setShelves] = useState([]);
  const [currentShelfId, setCurrentShelfId] = useState(null);

  useEffect(() => {
    if (readOnly || !userId) return;
    getUserShelves(supabase, userId).then((data) => {
      setShelves(data.filter((s) => s.is_exclusive));
    });
  }, [userId, readOnly]);

  const coverSrc = book.cover_url
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${book.cover_url}`
    : null;

  const save = useCallback(
    async (fields) => {
      if (readOnly || !userBook?.id) return;
      try {
        const updated = await updateUserBook(
          supabase,
          userBook.id,
          fields,
          book.page_count || null
        );
        onUpdate?.(userBook.id, updated);
      } catch (e) {
        console.error("Error saving:", e);
      }
    },
    [userBook?.id, book.page_count, readOnly]
  );

  const handleRating = (value) => {
    setRating(value);
    save({ rating: value });
  };

  const handleReviewBlur = () => {
    save({ review });
  };

  const handlePagesChange = (value) => {
    const pages = parseInt(value, 10) || 0;
    setProgressPages(pages);
    const percent =
      book.page_count > 0
        ? Math.round((pages / book.page_count) * 100)
        : progressPercent;
    setProgressPercent(percent);
    save({ progress_pages: pages, progress_percent: percent });
  };

  const handlePercentChange = (value) => {
    const percent = parseInt(value, 10) || 0;
    setProgressPercent(percent);
    const pages =
      book.page_count > 0
        ? Math.round((percent / 100) * book.page_count)
        : progressPages;
    setProgressPages(pages);
    save({ progress_percent: percent, progress_pages: pages });
  };

  const handleShelfChange = async (shelfId) => {
    setCurrentShelfId(shelfId);
    try {
      await addBookToShelf(supabase, userId, book.id, shelfId);
    } catch (e) {
      console.error("Error moving to shelf:", e);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-ppMondwest text-xl">
            {book.title}
          </SheetTitle>
          <SheetDescription className="font-ppMondwest text-textSecondary">
            {book.authors?.[0]}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Cover */}
          {coverSrc && (
            <div className="flex justify-center">
              <img
                src={coverSrc}
                alt={book.title}
                className="w-32 h-auto rounded-sm shadow-md"
              />
            </div>
          )}

          {!readOnly && (
            <>
              {/* Shelf selector */}
              {shelves.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Shelf</label>
                  <select
                    className="w-full border rounded-md p-2 text-sm"
                    value={currentShelfId || ""}
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRating(star)}
                      className={`text-2xl transition-colors ${
                        star <= rating
                          ? "text-yellow-500"
                          : "text-gray-300 hover:text-yellow-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Review */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Review</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[80px]"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  onBlur={handleReviewBlur}
                  placeholder="Write your thoughts..."
                />
              </div>

              {/* Reading progress */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Reading Progress</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min={0}
                    max={book.page_count || undefined}
                    value={progressPages}
                    onChange={(e) => handlePagesChange(e.target.value)}
                    placeholder="Pages"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    / {book.page_count || "?"} pages
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={progressPercent}
                    onChange={(e) => handlePercentChange(e.target.value)}
                    placeholder="%"
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Started</label>
                  <Input
                    type="date"
                    value={dateStarted}
                    onChange={(e) => {
                      setDateStarted(e.target.value);
                      save({ date_started: e.target.value || null });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Finished</label>
                  <Input
                    type="date"
                    value={dateFinished}
                    onChange={(e) => {
                      setDateFinished(e.target.value);
                      save({ date_finished: e.target.value || null });
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Read-only display */}
          {readOnly && userBook && (
            <div className="space-y-3 text-sm">
              {userBook.rating > 0 && (
                <div>
                  <span className="font-medium">Rating: </span>
                  {"★".repeat(userBook.rating)}
                  {"☆".repeat(5 - userBook.rating)}
                </div>
              )}
              {userBook.review && (
                <div>
                  <span className="font-medium">Review: </span>
                  <p className="text-muted-foreground mt-1">
                    {userBook.review}
                  </p>
                </div>
              )}
              {(userBook.progress_percent > 0 ||
                userBook.progress_pages > 0) && (
                <div>
                  <span className="font-medium">Progress: </span>
                  {userBook.progress_percent}%
                  {userBook.progress_pages > 0 &&
                    ` (${userBook.progress_pages} pages)`}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
