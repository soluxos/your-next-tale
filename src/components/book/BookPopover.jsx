import React from "react";
import { Button } from "@/components/ui/button";
import BuyButton from "@/components/book/BuyButton";

const truncateDescription = (text, limit) => {
  if (!text) return "";
  if (text.length <= limit) return text;
  return text.slice(0, text.lastIndexOf(" ", limit)) + "...";
};

const BookPopover = ({ book, onOpenDrawer }) => {
  const { title, authors, description } = book;

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
    </div>
  );
};

export default BookPopover;
