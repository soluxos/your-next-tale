"use client";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import BuyButton from "@/components/book/BuyButton";

const VaulDrawer = forwardRef(({ book, coverUrl }, ref) => {
  const { title, author, description } = book;
  const triggerRef = useRef();

  useImperativeHandle(ref, () => ({
    open: () => {
      if (triggerRef.current) {
        triggerRef.current.click();
      }
    }
  }));

  return (
    <Drawer.Root direction="left">
      <Drawer.Trigger ref={triggerRef} className="hidden" />
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-10" />
        <Drawer.Content
          className="right-0 top-0 bottom-0 fixed z-10 outline-none w-[480px] max-w-full flex h-full" // Add h-full here
          style={{ "--initial-transform": "calc(100% + 8px)" }}
        >
          <section className="drawer-container bg-white w-[480px] h-full flex flex-row">
            <div className="drawer-left w-4 h-full border border-solid border-border"></div>
            <div className="drawer-center w-full h-full flex flex-col">
              <div className="drawer-top w-full h-4 border-1 border-border border flex border-r-0 border-l-0 relative">
                <Drawer.Close
                  className="absolute left-4 top-11 transform -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 cursor-pointer"
                  aria-label="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 text-textPrimary hover:text-textSecondary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Drawer.Close>
              </div>
              <div className="drawer-content overflow-y-scroll flex flex-col h-full items-center justify-start">
                <div className="content-container flex flex-col w-full max-w-full h-auto">
                  <div className="flex flex-col items-center gap-4 w-full bg-[rgba(0,0,0,0.1)] p-10">
                    {coverUrl && (
                      <img
                        src={coverUrl}
                        alt={`${title} cover`}
                        className="h-auto w-[50%] self-center shadow-[0_0_64px_8px_rgba(0,0,0,0.2)]"
                      />
                    )}
                  </div>
                  <div className="py-5 px-10 xs:p-10 flex flex-col gap-5 w-full max-w-full pb-20 xs:pb-10">
                    <div>
                      <Drawer.Title className="text-[16px] text-textPrimary font-departureMono uppercase">
                        {title}
                      </Drawer.Title>
                      <Drawer.Description className="text-[16px] font-departureMono uppercase text-textSecondary">
                        By <span className="text-textPrimary">{author}</span>
                      </Drawer.Description>
                      <div className="text-[13px] font-inter text-textSecondary mt-2">
                        {description
                          ? description.split("\n").map((paragraph, index) => (
                              <p key={index} className="mb-2">
                                {paragraph}
                              </p>
                            ))
                          : "No description available."}
                      </div>
                    </div>
                    <BuyButton
                      isbn_13={book.isbn_13}
                      title={book.title}
                      authors={book.authors || (author ? [author] : [])}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
              <div className="drawer-bottom w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
            </div>
            <div className="drawer-right w-4 h-full border border-solid border-border"></div>
          </section>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
});

VaulDrawer.displayName = "VaulDrawer";

export default VaulDrawer;
