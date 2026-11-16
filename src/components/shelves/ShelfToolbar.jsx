"use client";
import { useEffect, useRef, useState } from "react";
import SortControl, { sortOptionsFor } from "./SortControl";
import FilterPanel, { activeFilterCount, clearPanelFilters } from "./FilterPopover";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export { activeFilterCount };

/**
 * Search, sort, filter and the Books / Reviews switch for a shelf.
 *
 * Desktop (md+): search · sort menu · filter popover · view toggle, in one row.
 * Phones: search and a single 40px "Sort & filter" button that opens a bottom
 * sheet; the view toggle sits beside the shelf heading instead (ShelfView).
 * Layout is CSS-only so the server render already matches the screen.
 */
export default function ShelfToolbar({
  sortKey,
  onSortChange,
  viewMode,
  onViewModeChange,
  filters,
  onFiltersChange,
  genreOptions = [],
  allowCustomOrder = true,
  searchLabel = "Search this shelf"
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const count = activeFilterCount(filters);
  const active = count > 0;
  const searchRef = useRef(null);
  const query = filters.query || "";
  const setQuery = (value) => onFiltersChange({ ...filters, query: value });

  // "/" jumps to search, as on most sites with one.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t.closest?.("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filterIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );

  return (
    <div className="flex items-center gap-2 w-full md:w-auto">
      <div className="relative flex-1 min-w-0 md:flex-none md:w-56 lg:w-64" role="search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.stopPropagation();
              setQuery("");
            }
          }}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className="field md:h-9 !pl-9 !pr-9 w-full md:text-[14px] [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              searchRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-0.5 md:right-1 top-1/2 -translate-y-1/2 w-9 h-9 md:w-7 md:h-7 rounded-full flex items-center justify-center text-textSecondary hover:text-ink hover:bg-paper-3"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <kbd className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-5 px-1.5 items-center rounded-[4px] border border-line label !text-[10px] text-textSecondary pointer-events-none">/</kbd>
        )}
      </div>

      {/* Phones: sort and filter share one sheet */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={active ? `Sort and filter (${count} ${count === 1 ? "filter" : "filters"} on)` : "Sort and filter"}
        className="md:hidden btn btn-secondary btn-icon relative shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
        {active && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-white text-[10px] leading-none tabular-nums flex items-center justify-center" aria-hidden="true">
            {count}
          </span>
        )}
      </button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-[16px] p-0 gap-0 max-h-[88dvh] flex flex-col overflow-hidden">
          <SheetTitle className="sr-only">Sort and filter</SheetTitle>
          <SheetDescription className="sr-only">Sort this shelf, or narrow it by genre, rating, length or review.</SheetDescription>
          <FilterPanel
            title="Sort & filter"
            sort={{ value: sortKey, onChange: onSortChange, options: sortOptionsFor(allowCustomOrder) }}
            filters={filters}
            onChange={onFiltersChange}
            genreOptions={genreOptions}
            onDone={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop */}
      <SortControl
        value={sortKey}
        onChange={onSortChange}
        allowCustomOrder={allowCustomOrder}
        className="hidden md:inline-flex"
      />
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={active ? `Filter (${count} on)` : "Filter"}
            className={cn("hidden md:inline-flex btn btn-sm h-9", active ? "btn-primary" : "btn-secondary data-[state=open]:border-ink")}
          >
            {filterIcon}
            Filter
            {active && (
              <span className="bg-white text-ink rounded-full min-w-4 h-4 px-1 flex items-center justify-center text-[10px]" aria-hidden="true">
                {count}
              </span>
            )}
          </button>
        </PopoverTrigger>
        {/* Below the button, never above it; tall content scrolls inside a
            panel capped to the space left in the viewport. */}
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={{ top: 80, right: 16, bottom: 16, left: 16 }}
          className="w-[340px] p-0 rounded-[12px] z-[60] flex flex-col overflow-hidden max-h-[min(640px,var(--radix-popover-content-available-height))]"
        >
          <FilterPanel
            filters={filters}
            onChange={onFiltersChange}
            genreOptions={genreOptions}
            onDone={() => setPopoverOpen(false)}
          />
        </PopoverContent>
      </Popover>

      <ViewToggle mode={viewMode} onChange={onViewModeChange} className="hidden md:flex" />
    </div>
  );
}

/** Books ↔ Reviews — a two-option segmented control (40px tall on phones). */
export function ViewToggle({ mode, onChange, className }) {
  return (
    <div role="group" aria-label="View" className={cn("flex items-center gap-[2px] bg-paper-3 rounded-[8px] p-[3px] h-10 md:h-9 shrink-0", className)}>
      {["books", "reviews"].map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          className={cn(
            "label h-full px-3 rounded-[6px] transition-all duration-150",
            mode === m ? "bg-white text-ink shadow-sm" : "text-textSecondary hover:text-ink"
          )}
        >
          {m === "books" ? "Books" : "Reviews"}
        </button>
      ))}
    </div>
  );
}

/** What's filtering the shelf right now, each removable in one tap. */
export function ActiveFilterChips({ filters, onChange, className }) {
  const chips = [];
  for (const g of filters.genres || []) {
    chips.push({ key: `genre:${g}`, label: g, remove: () => onChange({ ...filters, genres: filters.genres.filter((x) => x !== g) }) });
  }
  if (filters.minRating > 0) {
    chips.push({ key: "rating", label: `${filters.minRating}★ and up`, remove: () => onChange({ ...filters, minRating: 0 }) });
  }
  const min = filters.minPages !== "" ? filters.minPages : null;
  const max = filters.maxPages !== "" ? filters.maxPages : null;
  if (min !== null || max !== null) {
    chips.push({
      key: "pages",
      label: min !== null && max !== null ? `${min}–${max} pages` : min !== null ? `${min}+ pages` : `Up to ${max} pages`,
      remove: () => onChange({ ...filters, minPages: "", maxPages: "" })
    });
  }
  if (filters.hasReview) {
    chips.push({ key: "review", label: "Has a review", remove: () => onChange({ ...filters, hasReview: false }) });
  }
  if (!chips.length) return null;

  return (
    <div role="group" aria-label="Active filters" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          aria-label={`Remove filter: ${chip.label}`}
          className="chip h-10 sm:h-8 pl-3 pr-2 border-ink text-ink"
        >
          {chip.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={() => onChange(clearPanelFilters(filters))} className="btn btn-ghost btn-sm h-10 sm:h-8">
          Clear all
        </button>
      )}
    </div>
  );
}
