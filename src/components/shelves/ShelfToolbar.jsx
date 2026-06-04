"use client";
import { useState } from "react";
import SortControl from "./SortControl";
import ViewModeToggle from "./ViewModeToggle";
import FilterPopover from "./FilterPopover";
import { hasActiveFilters } from "@/lib/shelfFilter";

export default function ShelfToolbar({
  sortKey,
  onSortChange,
  viewMode,
  onViewModeChange,
  filters,
  onFiltersChange
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      {/* Left — sort control */}
      <SortControl value={sortKey} onChange={onSortChange} />

      {/* Right — filter button + view toggle */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Filter button + popover */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className={`
              flex items-center gap-1.5 h-[32px] px-3 rounded-[8px] border
              transition-colors font-departureMono uppercase text-[9px]
              ${
                filtersActive
                  ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                  : "border-border bg-white text-textPrimary hover:border-[#1f1f1f]"
              }
            `}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
            {filtersActive && (
              <span
                className="bg-white text-[#1f1f1f] rounded-full w-4 h-4
                               flex items-center justify-center text-[7px] ml-0.5"
              >
                {
                  [
                    filters.genres?.length > 0,
                    filters.minPages !== "",
                    filters.maxPages !== "",
                    filters.minRating > 0,
                    filters.hasReview
                  ].filter(Boolean).length
                }
              </span>
            )}
          </button>

          {filterOpen && (
            <FilterPopover
              filters={filters}
              onChange={onFiltersChange}
              onClose={() => setFilterOpen(false)}
            />
          )}
        </div>

        {/* View mode toggle (Books / Reviews) */}
        <ViewModeToggle mode={viewMode} onChange={onViewModeChange} />
      </div>
    </div>
  );
}
