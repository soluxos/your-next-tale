"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { updateUserBook } from "@/lib/userBooks";
import { generateBookSlug } from "@/lib/slugify";
import { cn } from "@/lib/utils";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import AddToShelfButton from "@/components/book/AddToShelfButton";
import BookCover from "@/components/book/BookCover";
import { Spinner } from "@/components/ui/spinner";
import { useLibrary } from "@/components/providers/LibraryProvider";
import StatusIcon, { statusName } from "@/components/book/StatusIcon";

const today = () => new Date().toISOString().slice(0, 10);

// ── Stars ────────────────────────────────────────────────────────────────
function StarIcon({ filled, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#e3a008" : "none"} stroke={filled ? "#e3a008" : "#8a8a8a"} strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function StarInput({ rating, onRate }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || rating;
  return (
    <div className="flex items-center gap-1">
      <div role="radiogroup" aria-label="Your rating" className="flex" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} ${i === 1 ? "star" : "stars"}`}
            onClick={() => onRate(i === rating ? 0 : i)}
            onMouseEnter={() => setHovered(i)}
            className="w-10 h-10 -mx-0.5 flex items-center justify-center rounded-[8px] transition-transform hover:scale-110 active:scale-95"
          >
            <StarIcon filled={i <= display} />
          </button>
        ))}
      </div>
      {rating > 0 ? (
        <button type="button" onClick={() => onRate(0)} className="btn btn-ghost btn-sm ml-1">
          Clear
        </button>
      ) : (
        <span className="label !text-[10px] text-textSecondary ml-2">Tap to rate</span>
      )}
    </div>
  );
}

function StarDisplay({ rating }) {
  if (!rating) return null;
  return (
    <div className="flex gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} filled={i <= rating} size={16} />
      ))}
    </div>
  );
}

// ── Save state ("Saving…" / "Saved") ────────────────────────────────────
function SaveState({ state }) {
  return (
    <span aria-live="polite" className={cn("label !text-[10px] transition-opacity duration-300", state ? "opacity-100" : "opacity-0", state === "error" ? "text-[#b42318]" : "text-shelved")}>
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : state === "error" ? "Couldn’t save" : " "}
    </span>
  );
}

function Section({ title, aside, children }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 min-h-5">
        <h3 className="label text-textSecondary">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Your reading details for one book — status, shelves, rating, progress,
 * dates and review. Everything saves as you go; the review autosaves while
 * you type and is flushed when the dialog closes, so nothing is lost.
 * Visitors see the owner's rating and review instead.
 */
export default function BookReviewModal({
  book,
  userBook,
  profile,
  username,
  isOwner,
  onClose,
  onUpdate,
  removeOptions = []
}) {
  const supabase = useMemo(() => createClient(), []);
  const library = useLibrary();
  const entry = isOwner ? library.getEntry(book.id) : null;
  const bookPageUrl = `/books/${generateBookSlug(book.title, book.authors?.[0])}`;
  const pageCount = book.page_count || null;

  const [rating, setRating] = useState(userBook?.rating || 0);
  const [review, setReview] = useState(userBook?.review || "");
  const [pages, setPages] = useState(userBook?.progress_pages ? String(userBook.progress_pages) : "");
  const [percent, setPercent] = useState(userBook?.progress_percent || 0);
  const [dateStarted, setDateStarted] = useState(userBook?.date_started || "");
  const [dateFinished, setDateFinished] = useState(userBook?.date_finished || "");
  const [saveState, setSaveState] = useState({});
  const [shelfBusy, setShelfBusy] = useState(null);
  const [shelfError, setShelfError] = useState(null);
  const [confirming, setConfirming] = useState(null);

  // Pending debounced saves, flushed on close
  const pending = useRef({});
  const timers = useRef({});
  const reviewAtOpen = useRef(userBook?.review || "");
  const savedTimer = useRef({});

  const markSave = (key, state) => {
    setSaveState((s) => ({ ...s, [key]: state }));
    clearTimeout(savedTimer.current[key]);
    if (state === "saved") {
      savedTimer.current[key] = setTimeout(() => setSaveState((s) => ({ ...s, [key]: null })), 1800);
    }
  };

  const persist = useCallback(
    async (key, fields, { silent = true } = {}) => {
      if (!userBook?.id) return;
      markSave(key, "saving");
      try {
        const saved = await updateUserBook(supabase, userBook.id, fields, pageCount, { silent });
        // Pass on what was actually stored (pages and percent are derived
        // from each other), so every shelf and the home page agree.
        const stored = Object.fromEntries(
          [...Object.keys(fields), "progress_pages", "progress_percent"]
            .filter((k) => saved && k in saved)
            .map((k) => [k, saved[k]])
        );
        onUpdate?.(userBook.id, stored);
        library.notifyUpdated?.(userBook.id, book.id, stored);
        markSave(key, "saved");
      } catch (e) {
        console.error("Error saving:", e);
        markSave(key, "error");
        toast.error("Couldn’t save your changes", { description: e.message });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userBook?.id, book.id, pageCount, supabase, library.notifyUpdated]
  );

  const schedule = (key, fields, delay = 700) => {
    pending.current[key] = fields;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      const f = pending.current[key];
      delete pending.current[key];
      if (f) persist(key, f);
    }, delay);
  };

  const flush = useCallback(() => {
    for (const [key, fields] of Object.entries(pending.current)) {
      clearTimeout(timers.current[key]);
      // The final review save is the one friends see in their feed
      const silent = !(key === "review" && fields.review?.trim() && fields.review !== reviewAtOpen.current);
      persist(key, fields, { silent });
    }
    pending.current = {};
  }, [persist]);

  useEffect(() => () => flush(), [flush]);

  const close = () => {
    flush();
    onClose?.();
  };

  // ── Handlers ──
  const handleRating = (value) => {
    setRating(value);
    persist("rating", { rating: value || null }, { silent: !value });
  };

  const handleReview = (value) => {
    setReview(value);
    schedule("review", { review: value });
  };

  // Books with no page count are tracked by percent instead.
  const handlePercent = (value) => {
    const clean = value.replace(/[^\d]/g, "");
    const n = clean === "" ? 0 : Math.min(100, parseInt(clean, 10));
    setPercent(n);
    schedule("progress", { progress_percent: clean === "" ? null : n, progress_pages: null });
  };

  const handlePages = (value) => {
    const clean = value.replace(/[^\d]/g, "");
    setPages(clean);
    const n = clean === "" ? null : parseInt(clean, 10);
    const pct = n == null ? 0 : pageCount ? Math.min(100, Math.round((n / pageCount) * 100)) : percent;
    setPercent(pct);
    schedule("progress", { progress_pages: n, progress_percent: n == null ? null : pct });
  };

  const handleDate = (key, value) => {
    if (key === "date_started") setDateStarted(value);
    else setDateFinished(value);
    persist(key, { [key]: value || null });
  };

  // Status shelves are exclusive (Read / Reading / Want to Read / DNF) —
  // picking one moves the book. Starting or finishing fills in today's date.
  const handleStatus = async (shelf) => {
    if (entry?.shelfIds.includes(shelf.id)) return;
    setShelfBusy(shelf.id);
    setShelfError(null);
    try {
      await library.addBook({ book }, shelf.id);
      // A progress edit still waiting on its debounce goes out with this save,
      // so it can't land afterwards and undo "finished".
      clearTimeout(timers.current.progress);
      const auto = { ...(pending.current.progress || {}) };
      delete pending.current.progress;
      if (shelf.slug === "currently-reading" && !dateStarted) auto.date_started = today();
      if (shelf.slug === "read") {
        if (!dateFinished) auto.date_finished = today();
        auto.progress_percent = 100;
        auto.progress_pages = pageCount || null;
      }
      if (Object.keys(auto).length) {
        if (auto.date_started) setDateStarted(auto.date_started);
        if (auto.date_finished) setDateFinished(auto.date_finished);
        if (shelf.slug === "read") {
          setPercent(100);
          setPages(pageCount ? String(pageCount) : "");
        }
        await persist("dates", auto);
      }
      toast.success(`Moved to ${shelf.name}`, { description: book.title });
    } catch (e) {
      console.error("Error moving shelf:", e);
      setShelfError("Couldn’t move this book. Try again.");
    } finally {
      setShelfBusy(null);
    }
  };

  // Custom shelves are tags — a book can be on any number of them.
  const handleToggleCustom = async (shelf) => {
    const on = entry?.shelfIds.includes(shelf.id);
    setShelfBusy(shelf.id);
    setShelfError(null);
    try {
      if (on) {
        if (entry.shelfIds.length === 1) {
          setShelfError("Give this book a status first — it’s the only shelf it’s on.");
          return;
        }
        await library.removeFromShelf(entry, shelf.id);
      } else {
        await library.addBook({ book }, shelf.id);
      }
    } catch (e) {
      console.error("Error updating shelves:", e);
      setShelfError("Couldn’t update shelves. Try again.");
    } finally {
      setShelfBusy(null);
    }
  };

  const runRemove = async (opt) => {
    setConfirming(null);
    pending.current = {};
    onClose?.();
    await opt.action();
  };

  const currentStatus = library.statusShelves.find((s) => entry?.shelfIds.includes(s.id));
  const showProgress = isOwner && (currentStatus?.slug === "currently-reading" || pages || percent > 0);
  // A finish date only means something once you've finished (or stopped);
  // a start date once you've started, or if one was already logged.
  const showFinished = currentStatus?.slug === "read" || currentStatus?.slug === "did-not-finish";
  const showStarted = currentStatus?.slug !== "want-to-read" || !!dateStarted;

  // On phones the keyboard covers the lower half of the sheet; once it has
  // opened, bring the review box back into view.
  const revealOnFocus = (e) => {
    const el = e.currentTarget;
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            // Toasts sit outside the dialog — clicking one shouldn't close it
            if (e.target?.closest?.("[data-sonner-toaster]")) e.preventDefault();
          }}
          className={cn(
            "fixed z-[101] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] outline-none flex flex-col",
            // dvh, not vh: on phones vh includes the area behind the browser toolbars
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[18px]",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[min(600px,calc(100vw-32px))] sm:max-h-[88dvh] sm:rounded-[16px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-2"
          )}
        >
          {/* Grab handle (phones) */}
          <div className="sm:hidden flex justify-center pt-2.5" aria-hidden="true">
            <span className="w-10 h-1 rounded-full bg-black/15" />
          </div>

          {/* Header */}
          <div className="flex gap-4 px-5 sm:px-6 pt-4 sm:pt-6 pb-5 border-b border-line">
            <div className="w-[72px] sm:w-[84px] shrink-0">
              <BookCover book={book} eager />
            </div>
            <div className="flex-1 min-w-0 pr-10 flex flex-col">
              <DialogPrimitive.Title className="font-ppMondwest text-[22px] sm:text-[26px] leading-[1.1] text-ink">
                {book.title}
              </DialogPrimitive.Title>
              <p className="font-ppMondwest text-[16px] text-textSecondary mt-1 truncate">
                {book.authors?.join(", ")}
              </p>
              <div className="mt-auto pt-3 flex items-center gap-3 flex-wrap">
                {!isOwner && <StarDisplay rating={userBook?.rating} />}
                <Link href={bookPageUrl} className="label text-textSecondary hover:text-ink underline underline-offset-4">
                  Book page →
                </Link>
              </div>
            </div>
            <DialogPrimitive.Close className="absolute top-3 right-3 sm:top-4 sm:right-4 btn btn-ghost btn-icon" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 flex flex-col gap-6 pb-[max(20px,env(safe-area-inset-bottom))]">
            {isOwner ? (
              <>
                <Section title="Status" aside={shelfBusy ? <Spinner /> : null}>
                  <div className="grid grid-cols-2 xs:grid-cols-4 gap-1.5" role="group" aria-label="Reading status">
                    {library.statusShelves.map((shelf) => {
                      const on = !!entry?.shelfIds.includes(shelf.id);
                      return (
                        <button
                          key={shelf.id}
                          type="button"
                          aria-pressed={on}
                          disabled={!!shelfBusy}
                          onClick={() => handleStatus(shelf)}
                          className={cn(
                            "h-11 px-2 rounded-[10px] border label transition-colors flex items-center justify-center gap-1.5 text-center leading-tight",
                            on ? "bg-ink border-ink text-white" : "bg-white border-[#d6d6d6] text-textPrimary hover:border-ink"
                          )}
                        >
                          <StatusIcon slug={shelf.slug} size={13} className="shrink-0" />
                          {statusName(shelf)}
                        </button>
                      );
                    })}
                  </div>
                  {!currentStatus && entry && (
                    <p className="label !normal-case !text-[12px] text-[#9a6700]">
                      This book has no reading status yet — pick one above.
                    </p>
                  )}
                  {library.customShelves.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Your shelves">
                      {library.customShelves.map((shelf) => {
                        const on = !!entry?.shelfIds.includes(shelf.id);
                        return (
                          <button key={shelf.id} type="button" aria-pressed={on} disabled={!!shelfBusy} onClick={() => handleToggleCustom(shelf)} className="chip chip-lg">
                            <span aria-hidden="true">{on ? "✓" : "+"}</span>
                            {shelf.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {shelfError && <p className="label !normal-case !text-[12px] text-[#b42318]">{shelfError}</p>}
                </Section>

                <Section title="Your rating" aside={<SaveState state={saveState.rating} />}>
                  <StarInput rating={rating} onRate={handleRating} />
                </Section>

                {showProgress && (
                  <Section title="Progress" aside={<SaveState state={saveState.progress} />}>
                    <div className="flex items-center gap-3">
                      {pageCount ? (
                        <>
                          <label className="flex items-center gap-2 label text-textSecondary">
                            Page
                            <input
                              type="text"
                              inputMode="numeric"
                              value={pages}
                              onChange={(e) => handlePages(e.target.value)}
                              placeholder="0"
                              aria-label="Current page"
                              className="field !w-24 text-center tabular-nums"
                            />
                          </label>
                          <span className="label text-textSecondary">of {pageCount}</span>
                          <span className="ml-auto font-ppMondwest text-[20px] text-ink tabular-nums">{percent}%</span>
                        </>
                      ) : (
                        // No page count for this book, so progress is a percentage
                        <label className="flex items-center gap-3">
                          <span className="label text-textSecondary">Percent read</span>
                          <span className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={percent ? String(percent) : ""}
                              onChange={(e) => handlePercent(e.target.value)}
                              placeholder="0"
                              className="field !w-24 !pr-8 text-right tabular-nums"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 label text-textSecondary pointer-events-none" aria-hidden="true">
                              %
                            </span>
                          </span>
                        </label>
                      )}
                    </div>
                    <div className="h-2 rounded-full bg-paper-3 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress">
                      <div className="h-full bg-ink rounded-full transition-[width] duration-300" style={{ width: `${percent}%` }} />
                    </div>
                  </Section>
                )}

                {(showStarted || showFinished) && (
                  <Section title="Dates" aside={<SaveState state={saveState.date_started || saveState.date_finished || saveState.dates} />}>
                    <div className="grid grid-cols-2 gap-3">
                      {showStarted && (
                        <label className="flex flex-col gap-1.5">
                          <span className="label !text-[10px] text-textSecondary">Started</span>
                          <input type="date" value={dateStarted || ""} onChange={(e) => handleDate("date_started", e.target.value)} className="field" />
                        </label>
                      )}
                      {showFinished && (
                        <label className="flex flex-col gap-1.5">
                          <span className="label !text-[10px] text-textSecondary">
                            {currentStatus?.slug === "did-not-finish" ? "Stopped" : "Finished"}
                          </span>
                          <input type="date" value={dateFinished || ""} onChange={(e) => handleDate("date_finished", e.target.value)} className="field" />
                        </label>
                      )}
                    </div>
                  </Section>
                )}

                <Section title="Your review" aside={<SaveState state={saveState.review} />}>
                  <textarea
                    value={review}
                    onChange={(e) => handleReview(e.target.value)}
                    onBlur={flush}
                    onFocus={revealOnFocus}
                    placeholder="What did you think? Saved as you type."
                    rows={4}
                    aria-label="Your review"
                    className="w-full rounded-[10px] border border-[#d6d6d6] px-3 py-2.5 font-ppMondwest text-[16px] leading-relaxed text-ink placeholder:text-[#9a9a9a] resize-y min-h-[110px] focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(31,31,31,0.08)]"
                  />
                </Section>

                {removeOptions.length > 0 && (
                  <section className="pt-4 border-t border-line flex flex-col gap-2">
                    {confirming ? (
                      <div className="rounded-[10px] border border-[#f1c7c2] bg-[#fef3f2] p-3 flex flex-col xs:flex-row xs:items-center gap-3">
                        <p className="font-ppMondwest text-[15px] text-[#7a271a] flex-1">{confirming.confirm}</p>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => setConfirming(null)} className="btn btn-secondary btn-sm">
                            Cancel
                          </button>
                          <button type="button" autoFocus onClick={() => runRemove(confirming)} className="btn btn-danger-solid btn-sm">
                            {confirming.label}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {removeOptions.map((opt) => (
                          <button key={opt.label} type="button" onClick={() => setConfirming(opt)} className={cn("btn btn-sm", opt.kind === "library" ? "btn-danger" : "btn-secondary")}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            ) : (
              <>
                {profile && (
                  <div className="flex items-center gap-3">
                    <FacehashAvatar name={profile.full_name || username} color={profile.facehash_color} size={36} />
                    <div className="min-w-0">
                      <Link href={`/u/${encodeURIComponent(username)}`} className="font-ppMondwest text-[16px] text-ink hover:underline">
                        {profile.full_name || username}
                      </Link>
                      <p className="label !text-[10px] text-textSecondary">@{username}</p>
                    </div>
                  </div>
                )}
                {userBook?.review ? (
                  <p className="prose-book whitespace-pre-wrap">{userBook.review}</p>
                ) : (
                  <p className="label text-textSecondary">
                    {(userBook?.rating || 0) > 0 ? "Rating only — no written review" : "No review yet"}
                  </p>
                )}
                <AddToShelfButton book={book} className="w-full" />
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
