import React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

const BookPopover = ({ title, author, description, onViewDetails, onPurchase }) => {
  return (
    <div className="space-y-4">
      {/* Title and Author */}
      <div>
        <h4 className="text-[15px] text-textPrimary font-departureMono uppercase">{title}</h4>
        <p className="text-[15px] font-departureMono text-textSecondary">
          By <span className="text-textPrimary uppercase">{author}</span>
        </p>
      </div>

      {/* Description */}
      <ScrollArea className="max-h-20 overflow-y-auto">
        <p className="text-sm text-textSecondary">{description}</p>
      </ScrollArea>

      {/* Buttons */}
      <div className="flex justify-between items-center gap-4">
        <Button
          variant="outline"
          className="text-sm w-full flex justify-between font-departureMono uppercase text-[13px]"
        >
          View All Details <img src="/icons/arrow-right.svg" alt="cart" className="ml-2" />
        </Button>
        <Button
          variant="default"
          className="text-sm items-center w-full flex justify-between font-departureMono uppercase text-[13px]"
        >
          Purchase This Book <img src="/icons/trolley.svg" alt="cart" className="ml-2" />
        </Button>
      </div>
    </div>
  )
}

export default BookPopover
