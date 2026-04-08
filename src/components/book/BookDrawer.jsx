"use client";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import BuyButton from "@/components/book/BuyButton";
import Link from "next/link";
import { generateBookSlug } from "@/lib/slugify";
import AdminEditPanel from "@/components/admin/AdminEditPanel";

const VaulDrawer = forwardRef(
  (
    { book, coverUrl, isAdmin, onDelete, deleting, adminEdit, onBookUpdated },
    ref
  ) => {
    const { id, title, authors, description } = book;
    const triggerRef = useRef();
    const [copied, setCopied] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const savedScrollY = useRef(0);

    useEffect(() => setMounted(true), []);

    function handleOpenChange(nextOpen) {
      if (
        !nextOpen &&
        adminEdit?.isEditing &&
        adminEdit?.dirtyFields.size > 0
      ) {
        if (!window.confirm("Discard unsaved changes and close?")) return;
      }
      if (!nextOpen) {
        adminEdit?.exitEditMode();
        requestAnimationFrame(() =>
          window.scrollTo({ top: savedScrollY.current, behavior: "instant" })
        );
      }
      setOpen(nextOpen);
    }

    // Generate book page URL based on slug
    const bookPageUrl = `/books/${generateBookSlug(title, authors?.[0])}`;

    useImperativeHandle(ref, () => ({
      open: () => {
        savedScrollY.current = window.scrollY;
        setOpen(true);
      },
      close: () => setOpen(false)
    }));

    return (
      <>
        {mounted &&
          createPortal(
            <div
              className="fixed inset-0 bg-black/40 transition-opacity duration-500 ease-in-out"
              style={{
                opacity: open ? 1 : 0,
                pointerEvents: open ? "auto" : "none",
                zIndex: 99
              }}
              onPointerDown={() => handleOpenChange(false)}
            />,
            document.body
          )}
        <Drawer.Root
          direction="right"
          open={open}
          onOpenChange={handleOpenChange}
          noBodyStyles
          modal={false}
        >
          <Drawer.Portal>
            <Drawer.Content
              className="right-0 top-0 bottom-0 fixed z-[100] outline-none w-[480px] max-w-full flex h-full"
              style={{ "--initial-transform": "calc(100% + 8px)" }}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <section className="drawer-container bg-white w-[480px] h-full flex flex-row">
                <div className="drawer-left w-4 h-full border border-solid border-border"></div>
                <div className="drawer-center w-full h-full flex flex-col">
                  <div className="drawer-top w-full h-4 border-1 border-border border flex border-r-0 border-l-0 relative">
                    <Drawer.Close
                      className="absolute left-4 top-11 transform -translate-y-1/2 w-8 h-8 bg-white rounded-[6px] flex items-center justify-center shadow-md hover:bg-[#f4f4f4] cursor-pointer"
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

                  {/* Admin edit mode — replaces normal content */}
                  {adminEdit?.isEditing && adminEdit?.draft ? (
                    <div className="flex-1 overflow-hidden">
                      <AdminEditPanel
                        book={book}
                        {...adminEdit}
                        onCancel={() => {
                          if (adminEdit.dirtyFields.size > 0) {
                            if (!window.confirm("Discard unsaved changes?"))
                              return;
                          }
                          adminEdit.exitEditMode();
                        }}
                        save={async () => {
                          const updatedBook = await adminEdit.save();
                          if (updatedBook) onBookUpdated?.(updatedBook);
                        }}
                      />
                    </div>
                  ) : (
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
                              By{" "}
                              <span className="text-textPrimary">
                                {authors?.[0]}
                              </span>
                            </Drawer.Description>
                            <div className="text-[16px] leading-[1.4] font-ppMondwest text-textSecondary mt-2">
                              {description
                                ? description
                                    .split("\n")
                                    .map((paragraph, index) => (
                                      <p key={index} className="mb-2">
                                        {paragraph}
                                      </p>
                                    ))
                                : "No description available."}
                            </div>
                          </div>
                        </div>
                        <div className="fixed bottom-8 left-8 w-[calc(100%-64px)] flex flex-col gap-2">
                          {isAdmin && (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={adminEdit?.enterEditMode}
                                className="font-departureMono uppercase text-[10px] text-textSecondary hover:text-textPrimary transition-colors flex items-center gap-1.5"
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
                                    d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"
                                  />
                                </svg>
                                Edit book
                              </button>
                              {confirmingDelete ? (
                                <>
                                  <span className="font-departureMono text-[10px] text-textSecondary">
                                    Delete this book?
                                  </span>
                                  <button
                                    onClick={() => {
                                      onDelete();
                                      setConfirmingDelete(false);
                                    }}
                                    disabled={deleting}
                                    className="font-departureMono uppercase text-[10px] text-red-500 hover:text-red-600 disabled:opacity-40"
                                  >
                                    {deleting ? "Deleting…" : "Confirm"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmingDelete(false)}
                                    className="font-departureMono uppercase text-[10px] text-textSecondary hover:text-textPrimary"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDelete(true)}
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
                          <div className="flex gap-4">
                            <BuyButton
                              isbn_13={book.isbn_13}
                              title={book.title}
                              authors={book.authors}
                              className="w-full"
                            />
                            <a
                              href={bookPageUrl}
                              className="rounded-[8px] border border-border bg-white shadow-sm hover:bg-[#f4f4f4] text-textPrimary items-center h-[44px] flex justify-center font-departureMono uppercase text-[11px] w-full gap-2 transition-colors"
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
                    </div>
                  )}
                  <div className="drawer-bottom w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
                </div>
                <div className="drawer-right w-4 h-full border border-solid border-border"></div>
              </section>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </>
    );
  }
);

VaulDrawer.displayName = "VaulDrawer";

export default VaulDrawer;
