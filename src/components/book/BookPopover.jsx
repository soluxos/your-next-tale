import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import BuyButton from "@/components/book/BuyButton";

const truncateDescription = (text, limit) => {
  if (!text) return "";
  if (text.length <= limit) return text;
  return text.slice(0, text.lastIndexOf(" ", limit)) + "...";
};

const BookPopover = ({ book, onOpenDrawer, isAdmin, onDelete, deleting }) => {
  const { title, authors, description } = book;
  const [confirming, setConfirming] = useState(false);

  const handleDeleteClick = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onDelete();
    setConfirming(false);
  };

  return (
    <div className="book-popover space-y-4 max-w-full">
      {/* Title and Author */}
      <div>
        <h4 className="text-[20px] text-textPrimary font-ppMondwest">
          {title}
        </h4>
        <p className="text-[20px] font-ppMondwest text-textSecondary">
          By <span className="text-textPrimary">{authors?.[0]}</span>
        </p>
      </div>

      {/* Description */}
      <p className="text-[16px] leading-[1.4] text-textSecondary font-ppMondwest">
        {truncateDescription(description, 240)}
      </p>

      {/* Buttons */}
      <div className="flex flex-col xs:flex-row xs:justify-between items-center gap-2">
        <Button
          variant="outline"
          className="w-full flex justify-between font-departureMono uppercase text-[11px]"
          onClick={onOpenDrawer}
        >
          View all details{" "}
          <img src="/icons/arrow-right.svg" alt="cart" className="ml-2" />
        </Button>
        <BuyButton
          isbn_13={book.isbn_13}
          title={book.title}
          authors={book.authors}
          size="sm"
          className="w-full"
        />
      </div>

      {/* Admin delete */}
      {isAdmin && (
        <div className="pt-1 border-t border-border flex items-center gap-2">
          {confirming ? (
            <>
              <span className="font-departureMono text-[10px] text-textSecondary">
                Delete this book?
              </span>
              <button
                onClick={handleDeleteClick}
                disabled={deleting}
                className="font-departureMono uppercase text-[10px] text-red-500 hover:text-red-600 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Confirm"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="font-departureMono uppercase text-[10px] text-textSecondary hover:text-textPrimary"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="font-departureMono uppercase text-[10px] text-textSecondary hover:text-red-500 transition-colors flex items-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete book
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BookPopover;
