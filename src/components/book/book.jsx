"use client";
import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent
} from "@/components/ui/hover-card";
import { useAdminBookEdit } from "@/hooks/useAdminBookEdit";
import BookPopover from "@/components/book/BookPopover.jsx";
import BookDrawer from "@/components/book/BookDrawer.jsx";
import BookCover from "@/components/book/BookCover";
import { coverUrl as coverUrlFor } from "@/lib/covers";
import { generateBookSlug } from "@/lib/slugify";

// Hover cards only where there is a real hover — on touch screens a tap
// should go straight to the details, not to a floating card.
//
// One media-query listener shared by every cover. With one each, a mouse
// appearing (a tablet's keyboard attached, or devtools leaving phone mode)
// re-rendered a 100-book shelf 100 separate times, and React stopped it as a
// "Maximum update depth exceeded" loop.
const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const hoverSubscribers = new Set();
let hoverQuery = null;
function subscribeCanHover(onChange) {
  if (!hoverQuery) {
    hoverQuery = window.matchMedia(HOVER_QUERY);
    hoverQuery.addEventListener("change", () => hoverSubscribers.forEach((fn) => fn()));
  }
  hoverSubscribers.add(onChange);
  return () => hoverSubscribers.delete(onChange);
}
const canHoverNow = () => window.matchMedia(HOVER_QUERY).matches;
const canHoverOnServer = () => false;

function useCanHover() {
  return useSyncExternalStore(subscribeCanHover, canHoverNow, canHoverOnServer);
}

/**
 * A cover on a shelf. It's a real link to the book's page (open in a new tab,
 * copy the link); a plain click opens the details drawer instead — or calls
 * `onClick` (your own shelf opens the reading-details modal).
 */
const Book = (props) => {
  const { book: initialBook, onImageLoad, onDeleted, disableHover, onClick } = props;
  const [currentBook, setCurrentBook] = useState(initialBook);
  const [drawerOn, setDrawerOn] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const { id, title, authors } = currentBook;
  const hoverAllowed = useCanHover() && !disableHover;

  useEffect(() => setCurrentBook(initialBook), [initialBook]);

  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const router = useRouter();
  const adminEdit = useAdminBookEdit(currentBook);
  const drawerRef = useRef();
  const openWhenReady = useRef(false);

  const href = `/books/${generateBookSlug(title, authors?.[0])}`;
  const label = authors?.[0] ? `${title} by ${authors[0]}` : title;

  // The details drawer is only built the first time it's opened. Built up
  // front, every cover on a shelf fetched its description as the shelf loaded
  // (hundreds of requests on a big bookcase), holding up whatever came next.
  useEffect(() => {
    if (!drawerOn || !openWhenReady.current) return;
    // A frame after it mounts, so it slides in rather than appearing.
    const frame = requestAnimationFrame(() => {
      openWhenReady.current = false;
      drawerRef.current?.open();
    });
    return () => cancelAnimationFrame(frame);
  }, [drawerOn]);

  const openDrawer = () => {
    setHoverOpen(false);
    if (drawerRef.current) return drawerRef.current.open();
    openWhenReady.current = true;
    setDrawerOn(true);
  };

  const closeDrawer = () => {
    drawerRef.current?.close();
    adminEdit.exitEditMode();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/books/${id}`, { method: "DELETE" });
      if (res.ok) {
        closeDrawer();
        setDeleted(true);
        onDeleted?.(id);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleClick = (e) => {
    // Let the browser handle new-tab / new-window clicks
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    setHoverOpen(false);
    (onClick || openDrawer)();
  };

  if (deleted) return null;

  const tile = (
    <a
      href={href}
      onClick={handleClick}
      aria-label={label}
      draggable={false}
      className="block relative z-10 rounded-[3px] transition-transform duration-200 ease-out hover:-translate-y-1.5 focus-visible:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <BookCover book={currentBook} onLoad={onImageLoad} />
    </a>
  );

  return (
    <>
      {drawerOn && (
        <BookDrawer
          ref={drawerRef}
          book={currentBook}
          coverUrl={coverUrlFor(currentBook.cover_url)}
          onClose={closeDrawer}
          isAdmin={isAdmin}
          onDelete={handleDelete}
          deleting={deleting}
          adminEdit={adminEdit}
          onBookUpdated={(updatedBook) => {
            setCurrentBook(updatedBook);
            router.refresh();
          }}
        />
      )}

      {/* Always wrapped, and only allowed to open where it should, so the
          cover isn't torn down and rebuilt (image and all) whenever that
          changes — a drag starting or ending did it to every cover. */}
      <HoverCard
        open={hoverAllowed && hoverOpen}
        onOpenChange={(open) => setHoverOpen(open && hoverAllowed)}
        openDelay={350}
        closeDelay={80}
      >
        <HoverCardTrigger asChild>{tile}</HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={10}
          collisionPadding={16}
          className="book-popover w-[min(380px,80vw)] p-0 bg-white rounded-[12px] border-line shadow-[0_18px_48px_-18px_rgba(0,0,0,0.4)] z-[60]"
        >
          <BookPopover book={currentBook} onOpenDrawer={openDrawer} />
        </HoverCardContent>
      </HoverCard>
    </>
  );
};

export default Book;
