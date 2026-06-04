"use client";
import { useState, useRef, useEffect } from "react";

const SORT_OPTIONS = [
  { key: "user", label: "Custom Order" },
  { key: "date_added", label: "Date Added" },
  { key: "rating", label: "Rating" },
  { key: "az", label: "A → Z" },
  { key: "za", label: "Z → A" }
];

export default function SortControl({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = SORT_OPTIONS.find((o) => o.key === value) || SORT_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-[32px] px-3 rounded-[8px]
                   border border-border bg-white hover:border-[#1f1f1f]
                   transition-colors font-departureMono uppercase text-[9px]
                   text-textPrimary"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-textSecondary"
        >
          <path d="M3 6h18M7 12h10M11 18h2" />
        </svg>
        {current.label}
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`text-textSecondary transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-30 bg-white
                        border border-border rounded-[8px] shadow-lg py-1 min-w-[140px]"
        >
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              className={`
                w-full text-left px-3 py-2 font-departureMono uppercase text-[9px]
                transition-colors flex items-center justify-between
                ${
                  value === opt.key
                    ? "text-textPrimary bg-[#f4f4f4]"
                    : "text-textSecondary hover:text-textPrimary hover:bg-[#fafafa]"
                }
              `}
            >
              {opt.label}
              {value === opt.key && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
