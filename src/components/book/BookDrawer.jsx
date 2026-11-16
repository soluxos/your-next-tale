"use client";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Drawer } from "vaul";
import BookCover from "@/components/book/BookCover";
import { Bookcase, Shelf } from "@/components/bookcase/Bookcase";
import BuyButton from "@/components/book/BuyButton";
import { generateBookSlug } from "@/lib/slugify";
import AdminEditPanel from "@/components/admin/AdminEditPanel";
import AddToShelfButton from "@/components/book/AddToShelfButton";
import { useBookDescription } from "@/lib/useBookDescription";
import { tidyGenres } from "@/lib/genres";

const VaulDrawer = forwardRef(
  (
    { book, coverUrl, isAdmin, onDelete, deleting, adminEdit, onBookUpdated },
    ref
  ) => {
    const { title, authors } = book;
    const description = useBookDescription(book);
    const genre = tidyGenres(book.genres)[0];
    // One light line of facts, the same as the book page — not a boxed grid
    // that repeats the year already shown above it.
    const facts = [
      book.page_count && `${book.page_count.toLocaleString()} pages`,
      book.published_date?.slice(0, 4),
      book.publisher
    ].filter(Boolean);
    const triggerRef = useRef();
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
              aria-describedby={undefined}
            >
              <section className="bg-white w-full h-full flex flex-col shadow-[-24px_0_48px_-24px_rgba(0,0,0,0.35)]">
                {/* Header */}
                <div className="h-14 shrink-0 flex items-center justify-between px-3 border-b border-line">
                  <Drawer.Close className="btn btn-ghost btn-icon" aria-label="Close details">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </Drawer.Close>
                  <Link
                    href={bookPageUrl}
                    onClick={(e) => {
                      if (adminEdit?.isEditing && adminEdit?.dirtyFields.size > 0 && !window.confirm("Discard unsaved changes?")) {
                        e.preventDefault();
                        return;
                      }
                      // Close without restoring the old scroll position —
                      // we're moving on to a new page.
                      adminEdit?.exitEditMode();
                      setOpen(false);
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    Full page
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" />
                    </svg>
                  </Link>
                </div>

                {adminEdit?.isEditing && adminEdit?.draft ? (
                  <div className="flex-1 overflow-hidden">
                    <AdminEditPanel
                      book={book}
                      {...adminEdit}
                      onCancel={() => {
                        if (adminEdit.dirtyFields.size > 0) {
                          if (!window.confirm("Discard unsaved changes?")) return;
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
                  <>
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                      <div className="px-5 pt-5">
                        <Bookcase>
                          <Shelf grid={false} booksClassName="justify-center !pt-8 !pb-2">
                            <div className="w-[38%] max-w-[170px] relative z-10">
                              <BookCover book={book} src={coverUrl} eager />
                            </div>
                          </Shelf>
                        </Bookcase>
                      </div>

                      <div className="px-5 pt-6 pb-8 flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                          {genre && <p className="label text-textSecondary">{genre}</p>}
                          <Drawer.Title className="font-ppMondwest text-[28px] leading-[1.1] text-ink">
                            {title}
                          </Drawer.Title>
                          {authors?.[0] && (
                            <p className="font-ppMondwest text-[18px] text-textSecondary">
                              by <span className="text-textPrimary">{authors.join(", ")}</span>
                            </p>
                          )}
                          {facts.length > 0 && (
                            <p className="mt-1 font-ppMondwest text-[15px] text-textSecondary">
                              {facts.join(" · ")}
                            </p>
                          )}
                        </div>

                        <div className="prose-book !text-[16px]">
                          {description
                            ? description
                                .split(/\n+/)
                                .filter(Boolean)
                                .map((paragraph, index) => <p key={index}>{paragraph}</p>)
                            : description === null && <p className="text-textSecondary">No description yet.</p>}
                        </div>

                        {isAdmin && (
                          <div className="mt-4 pt-4 border-t border-dashed border-line flex flex-col gap-2">
                            <p className="label !text-[10px] text-textSecondary">Admin</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button onClick={adminEdit?.enterEditMode} className="btn btn-secondary btn-sm">
                                Edit book
                              </button>
                              {confirmingDelete ? (
                                <>
                                  <button
                                    onClick={() => {
                                      onDelete();
                                      setConfirmingDelete(false);
                                    }}
                                    disabled={deleting}
                                    className="btn btn-danger-solid btn-sm"
                                  >
                                    {deleting ? "Deleting…" : "Delete from catalogue"}
                                  </button>
                                  <button onClick={() => setConfirmingDelete(false)} className="btn btn-ghost btn-sm">
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmingDelete(true)} className="btn btn-danger btn-sm">
                                  Delete…
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions — a real footer, never over the text */}
                    <div className="shrink-0 border-t border-line bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] grid grid-cols-1 xs:grid-cols-[minmax(0,1fr)_auto] gap-2">
                      {/* Both at the default 40px size, so they line up */}
                      <AddToShelfButton book={book} className="w-full" />
                      <BuyButton isbn_13={book.isbn_13} title={book.title} authors={book.authors} />
                    </div>
                  </>
                )}
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
