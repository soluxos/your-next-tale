"use client";

import { getBookshopLink, getBookshopSearchLink } from "@/lib/bookshop";

export default function BuyButton({
  isbn_13,
  title,
  authors,
  size = "default",
  className = ""
}) {
  const link =
    getBookshopLink(isbn_13) || getBookshopSearchLink(title, authors?.[0]);

  if (!link) return null;

  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-3 h-[36px] gap-1.5"
      : "text-[11px] px-4 h-[44px] gap-2";

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center
                  font-departureMono uppercase
                  bg-[#1a1a1a] text-white hover:bg-[#333]
                  transition-colors rounded-[8px]
                  ${sizeClasses} ${className}`}
    >
      <BookshopIcon size={size} />
      {size === "sm" ? "Buy" : "Buy on Bookshop.org"}
    </a>
  );
}

function BookshopIcon({ size = "default" }) {
  const s = size === "sm" ? 12 : 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
