"use client";
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { generateBookSlug } from "@/lib/slugify";

const VaulDrawer = forwardRef(({ book, coverUrl }, ref) => {
  const { id, title, authors, description, amazon_affiliate_link } = book;
  const triggerRef = useRef();
  const [copied, setCopied] = useState(false);

  // Generate book page URL based on slug
  const bookPageUrl = `/books/${generateBookSlug(title, authors?.[0])}`;

  useImperativeHandle(ref, () => ({
    open: () => {
      if (triggerRef.current) {
        triggerRef.current.click();
      }
    }
  }));

  return (
    <Drawer.Root direction="right">
      <Drawer.Trigger ref={triggerRef} className="hidden" />
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content
          className="right-0 top-0 bottom-0 fixed z-50 outline-none w-[480px] max-w-full flex h-full" // Add h-full here
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
                  <div className="flex flex-col items-center gap-4 w-full bg-[#F4F3FF] p-10">
                    {coverUrl && (
                      <img
                        src={coverUrl}
                        alt={`${title} cover`}
                        className="h-auto w-[50%] self-center shadow-[0_0_64px_8px_rgba(0,0,0,0.2)]"
                        loading="eager"
                        decoding="async"
                      />
                    )}
                  </div>
                  <div className="drawer-bottom w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
                  <div className="py-5 px-10 xs:p-5 flex flex-col gap-5 w-full max-w-full pb-20 xs:pb-24">
                    <div>
                      <Drawer.Title className="text-[24px] text-textPrimary font-ppMondwest">
                        {title}
                      </Drawer.Title>
                      <Drawer.Description className="text-[24px] font-ppMondwest text-textSecondary">
                        By <span className="text-textPrimary">{authors?.[0]}</span>
                      </Drawer.Description>
                      <div className="text-[16px] leading-[1.4] font-ppMondwest text-textSecondary mt-2">
                        {description
                          ? description.split("\n").map((paragraph, index) => (
                              <p key={index} className="mb-2">
                                {paragraph}
                              </p>
                            ))
                          : "No description available."}
                      </div>
                    </div>
                  </div>
                  <div className="fixed bottom-8 left-8 w-[calc(100%-64px)] flex gap-4">
                    {amazon_affiliate_link && (
                      <Button
                        asChild
                        className="text-sm items-center h-[48px] gap-2 flex justify-center font-departureMono uppercase font-normal text-[13px] w-full"
                        variant="default"
                      >
                        <a
                          href={amazon_affiliate_link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Buy on Amazon{" "}
                          <img src="/icons/trolley.svg" alt="cart" />
                        </a>
                      </Button>
                    )}
                    <a
                      href={bookPageUrl}
                      className="rounded-md border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground text-sm items-center h-[48px] flex justify-center font-departureMono uppercase font-normal text-[13px] w-full gap-2"
                      variant="outline"
                    >
                      View page
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                    </a>
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
