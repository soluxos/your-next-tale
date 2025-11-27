import React from "react";
import { Button } from "@/components/ui/button";

const truncateDescription = (text, limit) => {
  if (text.length <= limit) return text;
  return text.slice(0, text.lastIndexOf(" ", limit)) + "...";
};

const BookPopover = ({ book, onOpenDrawer }) => {
  const { title, author, description, amazon_affiliate_link } = book;

  return (
    <div className="book-popover space-y-4 max-w-full">
      {/* Title and Author */}
      <div>
        <h4 className="text-[20px] text-textPrimary font-ppMondwest">
          {title}
        </h4>
        <p className="text-[20px] font-ppMondwest text-textSecondary">
          By <span className="text-textPrimary">{author}</span>
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
          className="text-sm w-full flex justify-between font-departureMono uppercase font-normal text-[13px]"
          onClick={onOpenDrawer}
        >
          View all details{" "}
          <img src="/icons/arrow-right.svg" alt="cart" className="ml-2" />
        </Button>
        <Button
          asChild
          className="text-sm items-center w-full flex justify-between font-departureMono uppercase font-normal text-[13px]"
          variant="default"
        >
          <a
            href={amazon_affiliate_link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Buy on Amazon{" "}
            <img src="/icons/trolley.svg" alt="cart" className="ml-2" />
          </a>
        </Button>
      </div>
    </div>
  );
};

export default BookPopover;
