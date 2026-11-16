"use client";
import { useState } from "react";
import { DEFAULT_FILTERS } from "@/lib/shelfFilter";
import { cn } from "@/lib/utils";

// The most common genres show as chips; the long tail (catalogue genres run
// to hundreds) is a search away rather than a wall of chips.
const GENRES_SHOWN = 12;
const GENRE_MATCHES_SHOWN = 24;

/** Filters set in this panel (the search box has its own clear button). */
export function activeFilterCount(filters) {
  return [
    filters.genres?.length > 0,
    filters.minPages !== "",
    filters.maxPages !== "",
    filters.minRating > 0,
    filters.hasReview
  ].filter(Boolean).length;
}

/** Everything but the search query back to its default. */
export const clearPanelFilters = (filters) => ({ ...DEFAULT_FILTERS, query: filters.query || "" });

const sameGenre = (a, b) => a.toLowerCase() === b.toLowerCase();

// 40px tall on phones. The `!` keeps a selected chip's text white while
// hovered (globals.css's `button.chip:hover` otherwise turns it dark-on-dark).
const CHIP = "chip h-10 sm:h-8 px-3 aria-pressed:!text-white aria-pressed:!border-ink data-[active=true]:!text-white data-[active=true]:!border-ink";

/**
 * Filter controls for a shelf — in a popover (desktop) or bottom sheet
 * (phone, where `sort` adds the sort options on top). The body scrolls and
 * the Clear / Done footer stays put, so it never runs off the screen.
 *
 * `genreOptions` comes from the books actually on the shelf:
 * [{ genre, total, count }] — total on the shelf, count in the current results.
 */
export default function FilterPanel({ filters, onChange, onDone, genreOptions = [], sort = null, title = "Filter books" }) {
  const [genreQuery, setGenreQuery] = useState("");
  const active = activeFilterCount(filters) > 0;
  const update = (key, value) => onChange({ ...filters, [key]: value });
  const isOn = (g) => filters.genres.some((x) => sameGenre(x, g));
  const toggleGenre = (g) =>
    update("genres", isOn(g) ? filters.genres.filter((x) => !sameGenre(x, g)) : [...filters.genres, g]);

  // Picked genres stay visible even when they're past the cut-off (or came
  // from another shelf and aren't on this one at all).
  const q = genreQuery.trim().toLowerCase();
  const shown = q
    ? genreOptions.filter((o) => o.genre.toLowerCase().includes(q)).slice(0, GENRE_MATCHES_SHOWN)
    : genreOptions.slice(0, GENRES_SHOWN);
  const extraPicked = filters.genres
    .filter((g) => !shown.some((o) => sameGenre(o.genre, g)))
    .map((g) => genreOptions.find((o) => sameGenre(o.genre, g)) || { genre: g, total: 0, count: 0 });
  const genreChips = [...extraPicked, ...shown];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 flex items-center px-4 pt-4 pb-3 pr-14 border-b border-line">
        <p className="font-ppMondwest text-[20px] leading-none text-ink">{title}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-6">
        {sort && (
          <fieldset>
            <legend className="label text-textSecondary mb-2">Sort by</legend>
            <div role="radiogroup" aria-label="Sort by" className="flex flex-wrap gap-1.5">
              {sort.options.map((opt) => {
                const on = sort.value === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-active={on}
                    onClick={() => sort.onChange(opt.key)}
                    className={CHIP}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="label text-textSecondary mb-2">Genre</legend>
          {genreOptions.length > GENRES_SHOWN && (
            <div className="relative mb-2.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={genreQuery}
                onChange={(e) => setGenreQuery(e.target.value)}
                placeholder={`Search ${genreOptions.length} genres`}
                aria-label="Search genres"
                className="field sm:h-9 !pl-8"
              />
            </div>
          )}
          {genreChips.length ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {genreChips.map(({ genre, count }) => {
                  const on = isOn(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      aria-pressed={on}
                      disabled={!on && count === 0}
                      onClick={() => toggleGenre(genre)}
                      className={cn(CHIP, "disabled:opacity-40")}
                    >
                      {genre}
                      <span className={cn("tabular-nums", on ? "text-white/70" : "text-textSecondary")}>
                        <span className="sr-only">, </span>
                        {count}
                        <span className="sr-only"> books</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {filters.genres.length > 1 && (
                <p className="mt-2 text-[12.5px] text-textSecondary">Showing books that match every genre you pick.</p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-textSecondary">
              {q ? `No genre matches “${genreQuery.trim()}”` : "No genres on these books yet."}
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="label text-textSecondary mb-2">Minimum rating</legend>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={filters.minRating === n}
                aria-label={n === 0 ? "Any rating" : `${n} stars and up`}
                onClick={() => update("minRating", n)}
                className={cn(CHIP, "min-w-11 justify-center")}
              >
                {n === 0 ? "Any" : `${n}★+`}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label text-textSecondary mb-2">Length (pages)</legend>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" min="0" placeholder="Min" aria-label="Minimum pages" value={filters.minPages} onChange={(e) => update("minPages", e.target.value)} className="field" />
            <span className="label text-textSecondary shrink-0">to</span>
            <input type="number" inputMode="numeric" min="0" placeholder="Max" aria-label="Maximum pages" value={filters.maxPages} onChange={(e) => update("maxPages", e.target.value)} className="field" />
          </div>
        </fieldset>

        <label className="flex items-center gap-3 min-h-10 cursor-pointer select-none">
          <input type="checkbox" checked={!!filters.hasReview} onChange={(e) => update("hasReview", e.target.checked)} className="w-5 h-5 accent-[#1f1f1f] cursor-pointer" />
          <span className="label text-textPrimary">Has a written review</span>
        </label>
      </div>

      <div className="shrink-0 flex gap-2 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-line bg-white">
        <button type="button" onClick={() => onChange(clearPanelFilters(filters))} disabled={!active} className="btn btn-secondary flex-1">
          Clear
        </button>
        <button type="button" onClick={onDone} className="btn btn-primary flex-[2]">
          Done
        </button>
      </div>
    </div>
  );
}
