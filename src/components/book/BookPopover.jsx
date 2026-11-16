import React from "react";
import AddToShelfButton from "@/components/book/AddToShelfButton";
import { tidyGenres } from "@/lib/genres";
import { useBookDescription } from "@/lib/useBookDescription";

const truncate = (text, limit) => {
  if (!text) return "";
  if (text.length <= limit) return text;
  return text.slice(0, text.lastIndexOf(" ", limit)) + "…";
};

export function bookMeta(book) {
  return [
    tidyGenres(book.genres)[0],
    book.published_date?.slice(0, 4),
    book.page_count ? `${book.page_count} pages` : null
  ].filter(Boolean);
}

/** The card that appears when you hover a cover (mouse only). */
const BookPopover = ({ book, onOpenDrawer }) => {
  const { title, authors } = book;
  const description = useBookDescription(book);
  const meta = bookMeta(book);

  return (
    <div className="flex flex-col">
      <div className="p-4 pb-3 flex flex-col gap-2">
        {meta.length > 0 && (
          <p className="label !text-[10px] text-textSecondary">{meta.join(" · ")}</p>
        )}
        <div>
          <h4 className="font-ppMondwest text-[20px] leading-tight text-ink">{title}</h4>
          {authors?.[0] && (
            <p className="font-ppMondwest text-[16px] text-textSecondary mt-0.5">
              by <span className="text-textPrimary">{authors[0]}</span>
            </p>
          )}
        </div>
        {description && (
          <p className="font-ppMondwest text-[15px] leading-[1.45] text-textPrimary">
            {truncate(description, 220)}
          </p>
        )}
      </div>
      <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2">
        <AddToShelfButton book={book} size="sm" variant="quick" className="w-full" />
        <button type="button" onClick={onOpenDrawer} className="btn btn-secondary btn-sm w-full">
          Details
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BookPopover;
