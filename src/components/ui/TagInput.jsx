"use client";
import { useState, useRef } from "react";

export default function TagInput({
  tags,
  onChange,
  placeholder = "Type and press Enter..."
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
      className="min-h-[36px] w-full border border-border rounded-[6px] px-2 py-1.5
                 flex flex-wrap gap-1 cursor-text focus-within:border-[#1f1f1f]
                 transition-colors bg-white"
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 bg-[#f4f4f4] text-textPrimary
                     font-departureMono uppercase text-[8px] px-2 h-[20px]
                     rounded-[4px]"
        >
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="text-textSecondary hover:text-textPrimary leading-none"
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
        className="flex-1 min-w-[80px] font-departureMono text-[10px]
                   text-textPrimary bg-transparent outline-none placeholder:text-textSecondary"
      />
    </div>
  );
}
