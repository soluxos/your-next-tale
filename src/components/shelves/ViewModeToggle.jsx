"use client";

/** Books ↔ Reviews — a two-option segmented control. */
export default function ViewModeToggle({ mode, onChange }) {
  return (
    <div role="group" aria-label="View" className="flex items-center gap-[2px] bg-paper-3 rounded-[8px] p-[3px] h-8">
      {["books", "reviews"].map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          className={`label h-[26px] px-3 rounded-[6px] transition-all duration-150 ${
            mode === m ? "bg-white text-ink shadow-sm" : "text-textSecondary hover:text-ink"
          }`}
        >
          {m === "books" ? "Books" : "Reviews"}
        </button>
      ))}
    </div>
  );
}
