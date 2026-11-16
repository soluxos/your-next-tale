"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BookReviewModal from "@/components/shelves/BookReviewModal";

/**
 * A reader's review opened from its own URL (/u/:user/:shelf/review/:bookId)
 * — e.g. from the feed or a book page. Same dialog as on the shelf, in
 * read-only form.
 */
export default function ReviewModal({ userBook, profile, username, closeHref, onClose }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  if (!open) return null;

  function close() {
    setOpen(false);
    if (onClose) onClose();
    else if (closeHref) window.history.replaceState(null, "", closeHref);
    else router.back();
  }

  return (
    <BookReviewModal
      book={userBook.book}
      userBook={userBook}
      profile={profile}
      username={username}
      isOwner={false}
      onClose={close}
    />
  );
}
