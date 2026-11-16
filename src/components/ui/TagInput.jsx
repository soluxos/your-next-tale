"use client";
import { useState, useRef } from "react";

export default function TagInput({
  tags,
  onChange,
  placeholder = "Type and press Enter...",
  ariaLabel
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  function addTag(raw) {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setInput("");
      return;
    }
    onChange([...tags, tag]);
    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(tag) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="min-h-[40px] w-full border border-[#d6d6d6] rounded-[8px] px-2 py-1.5
                 flex flex-wrap items-center gap-1 cursor-text focus-within:border-ink
                 transition-colors bg-white"
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 bg-[#f4f4f4] text-textPrimary
                     label !text-[10px] pl-2 pr-1 h-[26px]
                     rounded-[6px]"
        >
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            aria-label={`Remove ${tag}`}
            className="w-5 h-5 rounded-[4px] flex items-center justify-center text-textSecondary hover:text-ink hover:bg-white leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) addTag(input);
        }}
        placeholder={tags.length ? "" : placeholder}
        aria-label={ariaLabel || placeholder}
        className="flex-1 min-w-[80px] h-7 font-departureMono text-[16px] sm:text-[13px]
                   text-textPrimary bg-transparent !border-0 outline-none placeholder:text-[#9a9a9a]"
      />
    </div>
  );
}
