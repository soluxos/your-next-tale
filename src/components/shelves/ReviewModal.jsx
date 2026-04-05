"use client";

import { useRouter } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import StarRating from "@/components/ui/StarRating";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import Link from "next/link";

export default function ReviewModal({
  userBook,
  profile,
  username,
  shelfSlug,
  closeHref,
  onClose
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const book = userBook.book;

  const coverUrl = book.cover_url
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${book.cover_url}`
    : null;

  function close() {
    if (onClose) {
      // Managed as client state — just call the parent callback.
      setIsOpen(false);
      onClose();
    } else if (closeHref) {
      // Direct URL load — hide the modal and silently update the URL.
      setIsOpen(false);
      window.history.replaceState(null, "", closeHref);
    } else {
      router.back();
    }
  }

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") close();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closeHref, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={() => close()}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal panel */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 bg-white rounded-[12px] shadow-2xl
                       w-full max-w-lg max-h-[85vh] overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={() => close()}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f4f4f4]
                         flex items-center justify-center hover:bg-[#e8e8e8]
                         transition-colors z-10"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="p-6">
              {/* Book info */}
              <div className="flex gap-4 mb-6">
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt={book.title}
                    className="w-16 h-24 object-cover rounded-[6px] shrink-0 shadow-sm"
                  />
                )}
                <div className="flex-1 min-w-0 pt-1">
                  <h2 className="font-ppMondwest text-[22px] leading-tight mb-1">
                    {book.title}
                  </h2>
                  <p className="font-departureMono uppercase text-[9px] text-textSecondary mb-3">
                    {book.authors?.join(", ")}
                  </p>
                  {userBook.rating && (
                    <StarRating rating={userBook.rating} size={14} />
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border mb-5" />

              {/* Reviewer */}
              <div className="flex items-center gap-2 mb-4">
                <FacehashAvatar
                  name={profile.full_name || username}
                  color={profile.facehash_color}
                  size={28}
                />
                <div>
                  <Link
                    href={`/u/${username}`}
                    className="font-ppMondwest text-[14px] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {profile.full_name || username}
                  </Link>
                  <span className="font-departureMono uppercase text-[9px] text-textSecondary ml-2">
                    @{username}
                  </span>
                </div>
              </div>

              {/* Full review text */}
              {userBook.review ? (
                <p
                  className="font-departureMono text-[12px] text-textPrimary
                              leading-relaxed whitespace-pre-wrap"
                >
                  {userBook.review}
                </p>
              ) : (
                <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                  Rating only — no written review
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
