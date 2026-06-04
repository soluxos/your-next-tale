"use client";
import { useRef, useEffect } from "react";
import TagInput from "@/components/ui/TagInput";
import { DEFAULT_FILTERS, hasActiveFilters } from "@/lib/shelfFilter";

export default function FilterPopover({ filters, onChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    // Delay so the button click that opens it doesn't also close it
    const id = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const active = hasActiveFilters(filters);

  function update(key, value) {
    onChange({ ...filters, [key]: value });
  }

  function clearAll() {
    onChange({ ...DEFAULT_FILTERS });
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[calc(100%+6px)] z-40 bg-white border border-border
                 rounded-[10px] shadow-xl w-[300px] p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="font-departureMono uppercase text-[10px] text-textPrimary">
          Filter Books
        </p>
        {active && (
          <button
            onClick={clearAll}
            className="font-departureMono uppercase text-[8px] text-textSecondary
                       hover:text-textPrimary transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Genres */}
      <div className="mb-4">
        <label
          className="font-departureMono uppercase text-[9px] text-textSecondary
                           block mb-1.5"
        >
          Genre
        </label>
        <TagInput
          tags={filters.genres}
          onChange={(v) => update("genres", v)}
          placeholder="fantasy, sci-fi..."
        />
        <p className="font-departureMono text-[8px] text-textSecondary mt-1">
          Press Enter or comma to add. Books must match all genres.
        </p>
      </div>

      {/* Minimum rating */}
      <div className="mb-4">
        <label
          className="font-departureMono uppercase text-[9px] text-textSecondary
                           block mb-2"
        >
          Minimum Rating
        </label>
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => update("minRating", n)}
              className={`
                font-departureMono uppercase text-[8px] h-[26px] px-2 rounded-[4px]
                transition-colors border
                ${
                  filters.minRating === n
                    ? "bg-[#1f1f1f] text-white border-[#1f1f1f]"
                    : "border-border text-textSecondary hover:border-[#1f1f1f]"
                }
              `}
            >
              {n === 0 ? "Any" : `${n}★`}
            </button>
          ))}
        </div>
      </div>

      {/* Page count range */}
      <div className="mb-4">
        <label
          className="font-departureMono uppercase text-[9px] text-textSecondary
                           block mb-1.5"
        >
          Page Count
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            placeholder="Min"
            value={filters.minPages}
            onChange={(e) => update("minPages", e.target.value)}
            className="w-full h-[32px] border border-border rounded-[6px] px-2
                       font-departureMono text-[10px] text-textPrimary
                       focus:outline-none focus:border-[#1f1f1f] bg-white"
          />
          <span className="font-departureMono text-[9px] text-textSecondary shrink-0">
            to
          </span>
          <input
            type="number"
            min="0"
            placeholder="Max"
            value={filters.maxPages}
            onChange={(e) => update("maxPages", e.target.value)}
            className="w-full h-[32px] border border-border rounded-[6px] px-2
                       font-departureMono text-[10px] text-textPrimary
                       focus:outline-none focus:border-[#1f1f1f] bg-white"
          />
        </div>
      </div>

      {/* Has review */}
      <div className="mb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => update("hasReview", !filters.hasReview)}
            className={`
              w-4 h-4 rounded-[3px] border flex items-center justify-center
              transition-colors cursor-pointer
              ${
                filters.hasReview
                  ? "bg-[#1f1f1f] border-[#1f1f1f]"
                  : "border-border bg-white"
              }
            `}
          >
            {filters.hasReview && (
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
          <span
            className="font-departureMono uppercase text-[9px] text-textPrimary
                           select-none"
          >
            Has a written review
          </span>
        </label>
      </div>

      {/* Active filter summary */}
      {active && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="font-departureMono uppercase text-[8px] text-textSecondary">
            Filters active — some books may be hidden
          </p>
        </div>
      )}
    </div>
  );
}
