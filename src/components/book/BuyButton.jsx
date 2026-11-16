"use client";

import { getBookshopLink, getBookshopSearchLink } from "@/lib/bookshop";

export default function BuyButton({
  isbn_13,
  title,
  authors,
  size = "default",
  variant = "secondary",
  preorder = false,
  className = ""
}) {
  const link =
    getBookshopLink(isbn_13) || getBookshopSearchLink(title, authors?.[0]);

  if (!link) return null;

  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn btn-${variant} ${sizeClass} ${className}`}
    >
      <BookshopIcon size={size} />
      {preorder ? (size === "sm" ? "Pre-order" : "Pre-order on Bookshop.org") : size === "sm" ? "Buy" : "Buy on Bookshop.org"}
      <span className="sr-only">(opens in a new tab)</span>
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
      aria-hidden="true"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
