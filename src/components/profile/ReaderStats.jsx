"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { tidyGenres } from "@/lib/genres";
import { cn } from "@/lib/utils";

const PAGE = 1000;
const CHART_YEARS = 8;
const fmt = (n) => n.toLocaleString("en-GB");

// Last rows per reader. The strip unmounts on Followers / Following; coming
// back it redraws from here at once (and refreshes) instead of re-skeletoning.
const statsCache = new Map();

/**
 * Reading stats under the profile header: this year, all time, average
 * rating, favourite genres, and books finished per year.
 *
 * Desktop: one row, chart at the end. Phones: a 2×2 grid of the headline
 * numbers, with the per-year chart folded into a "Reading history" disclosure.
 */
export default function ReaderStats({ userId, readCount, isOwner }) {
  const supabase = useMemo(() => createClient(), []);
  const library = useLibrary();
  const [rows, setRows] = useState(() => statsCache.get(userId) ?? null);
  const [version, setVersion] = useState(0);

  // Your own stats follow your edits (ratings, finish dates, shelf moves).
  useEffect(() => {
    if (!isOwner) return;
    return library.subscribe(() => setVersion((v) => v + 1));
  }, [isOwner, library.subscribe]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("user_books")
          .select("rating, date_finished, books (page_count, genres)")
          .eq("user_id", userId)
          .or("rating.not.is.null,date_finished.not.is.null")
          .range(from, from + PAGE - 1);
        if (error) {
          console.error("Error loading reading stats:", error);
          break;
        }
        all.push(...data);
        if (data.length < PAGE) break;
      }
      if (!cancelled) {
        statsCache.set(userId, all);
        setRows(all);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, version]);

  const stats = useMemo(() => (rows ? summarise(rows) : null), [rows]);

  if (!stats) {
    // Hold the space for readers who will have stats, so the shelf doesn't jump.
    if (!readCount) return null;
    return (
      <div className="page-x pb-6 sm:pb-8" aria-hidden="true">
        <div className="card h-[256px] md:h-[127px] bg-paper-2 border-transparent animate-pulse" />
      </div>
    );
  }
  if (!stats.finished && !stats.rated) return null;

  const { year } = stats;
  const total = Math.max(readCount || 0, stats.finished);
  const hasChart = stats.perYear.length >= 2;

  const cells = [
    <Stat key="year" label={`In ${year}`} value={fmt(stats.thisYear)} unit={stats.thisYear === 1 ? "book" : "books"}>
      {stats.pagesThisYear > 0 ? `${fmt(stats.pagesThisYear)} pages` : stats.thisYear ? "Pages not known" : "None finished yet"}
    </Stat>,
    <Stat key="read" label="Books read" value={fmt(total)}>
      {stats.firstYear ? `Since ${stats.firstYear}` : "All time"}
    </Stat>,
    stats.rated > 0 && (
      <Stat key="rating" label="Average rating" value={stats.average.toFixed(1)} unit={<Star />}>
        From {fmt(stats.rated)} {stats.rated === 1 ? "rating" : "ratings"}
      </Stat>
    ),
    stats.genres.length > 0 && (
      <Stat key="genres" label={stats.genresFromRatings ? "Most loved" : "Reads most"}>
        <span className="block font-ppMondwest text-[17px] leading-snug text-ink line-clamp-2 mt-0.5">
          {stats.genres.join(", ")}
        </span>
      </Stat>
    )
  ].filter(Boolean);

  return (
    <section aria-label="Reading stats" className="page-x pb-6 sm:pb-8">
      <div className="card">
        <div className="grid grid-cols-2 md:flex">
          {cells.map((cell, i) => (
            <div
              key={cell.key}
              className={cn(cellBorders(i, cells.length, hasChart), cell.key === "genres" && "md:min-w-[170px] md:flex-[1.3]")}
            >
              {cell}
            </div>
          ))}
          {hasChart && (
            <div className="hidden md:block md:min-w-[210px] md:flex-[1.6]">
              <YearChart years={stats.perYear} current={year} />
            </div>
          )}
        </div>

        {hasChart && (
          <details className="group/history md:hidden border-t border-line">
            <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 h-11 px-4 cursor-pointer select-none label text-textPrimary rounded-b-[12px]">
              Reading history
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-textSecondary transition-transform group-open/history:rotate-180" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="-mt-2">
              <YearChart years={stats.perYear} current={year} />
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

/**
 * Hairlines between the stats: a 2-column grid on phones (the odd one out
 * spans the row), a single divided row from md up.
 */
function cellBorders(i, n, hasChart) {
  const spans = n % 2 === 1 && i === n - 1;
  const lastRow = Math.floor(i / 2) === Math.floor((n - 1) / 2);
  return cn(
    "min-w-0 border-line md:flex md:flex-1 md:min-w-0 md:border-b-0",
    spans ? "col-span-2" : i % 2 === 0 && "border-r",
    !lastRow && "border-b",
    hasChart || i < n - 1 ? "md:border-r" : "md:border-r-0"
  );
}

function summarise(rows) {
  const year = new Date().getFullYear();
  const perYearMap = new Map();
  const genreCounts = new Map();
  const lovedCounts = new Map();
  let finished = 0;
  let thisYear = 0;
  let pagesThisYear = 0;
  let firstYear = null;
  let rated = 0;
  let ratingSum = 0;

  for (const r of rows) {
    const y = r.date_finished ? Number(String(r.date_finished).slice(0, 4)) : null;
    if (y) {
      finished++;
      perYearMap.set(y, (perYearMap.get(y) || 0) + 1);
      if (!firstYear || y < firstYear) firstYear = y;
      if (y === year) {
        thisYear++;
        pagesThisYear += r.books?.page_count || 0;
      }
    }
    if (r.rating) {
      rated++;
      ratingSum += r.rating;
    }
    for (const g of tidyGenres(r.books?.genres)) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      if (r.rating >= 4) lovedCounts.set(g, (lovedCounts.get(g) || 0) + 1);
    }
  }

  // Genres from books rated 4★ or more when there are enough of them,
  // otherwise from everything finished or rated.
  const genresFromRatings = [...lovedCounts.values()].reduce((a, b) => a + b, 0) >= 5;
  const genres = [...(genresFromRatings ? lovedCounts : genreCounts).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  const start = firstYear ? Math.max(firstYear, year - CHART_YEARS + 1) : year;
  const perYear = [];
  for (let y = start; y <= year; y++) perYear.push({ year: y, count: perYearMap.get(y) || 0 });

  return {
    year,
    finished,
    thisYear,
    pagesThisYear,
    firstYear,
    rated,
    average: rated ? ratingSum / rated : 0,
    genres,
    genresFromRatings,
    perYear
  };
}

function Stat({ label, value, unit, children, className }) {
  return (
    <div className={cn("w-full px-4 lg:px-5 py-4 md:min-w-0 md:flex-1", className)}>
      <p className="label !text-[10px] text-textSecondary">{label}</p>
      {value !== undefined ? (
        <>
          <p className="mt-1 flex items-baseline gap-1.5 text-ink">
            <span className="font-ppMondwest text-[30px] leading-none tabular-nums">{value}</span>
            {unit && <span className="label !text-[10px] text-textSecondary">{unit}</span>}
          </p>
          <p className="mt-1.5 text-[12.5px] text-textSecondary whitespace-nowrap">{children}</p>
        </>
      ) : (
        children
      )}
    </div>
  );
}

function YearChart({ years, current }) {
  const labelId = useId();
  const max = Math.max(1, ...years.map((y) => y.count));
  const best = years.reduce((a, b) => (b.count > a.count ? b : a), years[0]);
  // Leave headroom above the tallest bar for its value label.
  const pct = (count) => (count ? Math.max(8, (count / max) * 76) : 0);
  return (
    <div className="px-4 lg:px-5 py-4">
      <p className="label !text-[10px] text-textSecondary" id={labelId}>
        Finished per year
      </p>
      <ol aria-labelledby={labelId} className="mt-2 flex items-end gap-[3px] h-[52px] border-b border-line">
        {years.map(({ year, count }, i) => {
          const isCurrent = year === current;
          const label = `${year}: ${count} ${count === 1 ? "book" : "books"}${isCurrent ? " so far" : ""}`;
          return (
            <li
              key={year}
              tabIndex={0}
              aria-label={label}
              className="group relative flex-1 h-full flex items-end justify-center outline-none"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block w-full max-w-[18px] rounded-t-[4px] transition-opacity group-hover:opacity-80",
                  isCurrent ? "bg-shelved" : "bg-textSecondary/55"
                )}
                style={{ height: `${pct(count)}%` }}
              />
              {(year === best.year || isCurrent) && count > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 -translate-x-1/2 text-[10.5px] tabular-nums text-textPrimary group-hover:opacity-0 group-focus-visible:opacity-0"
                  style={{ bottom: `calc(${pct(count)}% + 2px)` }}
                >
                  {count}
                </span>
              )}
              <span
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute bottom-full mb-1 z-10 whitespace-nowrap rounded-md bg-ink text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity",
                  // Keep the end tooltips inside the card so they never make it scroll.
                  i === 0 ? "left-0" : i === years.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" className="mt-1 flex gap-[3px]">
        {years.map(({ year }) => (
          <span
            key={year}
            className={cn(
              "flex-1 text-center text-[10px] tabular-nums",
              year === current ? "text-ink font-semibold" : "text-textSecondary"
            )}
          >
            ’{String(year).slice(2)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Star() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-ink -translate-y-[1px]" role="img" aria-label="stars">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}
