"use client";

export default function ViewModeToggle({ mode, onChange }) {
  return (
    <div className="flex items-center gap-[2px] bg-[#f4f4f4] rounded-[8px] p-[3px]">
      {["books", "reviews"].map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`
            font-departureMono uppercase text-[9px] tracking-wide
            px-3 h-[26px] rounded-[6px] transition-all duration-150
            ${
              mode === m
                ? "bg-white text-textPrimary shadow-sm"
                : "text-textSecondary hover:text-textPrimary"
            }
          `}
        >
          {m === "books" ? "Books" : "Reviews"}
        </button>
      ))}
    </div>
  );
}
