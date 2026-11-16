"use client";

import { cn } from "@/lib/utils";

/**
 * How far through a book the reader is, from whichever they track: a page
 * number (against the book's page count) or a percentage. Null when there's
 * nothing to show.
 */
export function readingProgress(userBook, pageCount) {
  const pages = Number(userBook?.progress_pages) || 0;
  let pct = Number(userBook?.progress_percent) || 0;
  if (!pct && pages && pageCount) pct = (pages / pageCount) * 100;
  pct = Math.round(Math.max(0, Math.min(100, pct)));
  if (!pct && !pages) return null;
  return {
    // A page number with no page count can't fill a bar; it's shown as a label
    pct: pct || null,
    label: pages ? (pageCount ? `p. ${pages} / ${pageCount}` : `p. ${pages}`) : `${pct}%`,
    spoken: pages
      ? `Reading progress: page ${pages}${pageCount ? ` of ${pageCount}` : ""}`
      : `Reading progress: ${pct}%`
  };
}

/**
 * A slim progress bar laid over the foot of a cover on Currently Reading,
 * with the page / percentage shown on hover or keyboard focus (always on
 * touch screens, which have no hover). Place it inside the cover's `group`
 * wrapper; it lifts with the cover like the cover's own hover.
 *
 * `showEmpty` (the owner's own shelf) keeps an empty track on books with no
 * progress yet, hinting that clicking the cover is where to log it. "hint"
 * drops the track and just says "Log progress" on hover.
 */
export default function CoverProgress({ userBook, pageCount, showEmpty = false }) {
  const progress =
    readingProgress(userBook, pageCount) ||
    (showEmpty ? { pct: showEmpty === "hint" ? null : 0, label: "Log progress", spoken: null, empty: true } : null);
  if (!progress) return null;
  return (
    <>
      {progress.spoken && <span className="sr-only">{progress.spoken}</span>}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-start gap-1 p-1.5 transition-transform duration-200 ease-out group-hover:-translate-y-1.5 group-focus-within:-translate-y-1.5"
      >
        <span
          className={cn(
            "label !text-[10px] leading-none tabular-nums rounded-[4px] bg-ink/85 text-white px-1.5 py-1 transition-opacity duration-150",
            progress.pct === null && !progress.empty
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            !progress.empty && "[@media(hover:none)]:opacity-100"
          )}
        >
          {progress.label}
        </span>
        {progress.pct !== null && (
          <span className="block w-full h-[5px] rounded-full bg-black/55 ring-1 ring-white/30 overflow-hidden">
            {progress.pct > 0 && (
              <span className="block h-full rounded-full bg-white" style={{ width: `${Math.max(progress.pct, 4)}%` }} />
            )}
          </span>
        )}
      </div>
    </>
  );
}
