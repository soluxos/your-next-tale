"use client";

import { useRouter } from "next/navigation";
import StarRating from "@/components/ui/StarRating";

const SNIPPET_LENGTH = 120;

export default function ReviewCardOverlay({
  bookId,
  username,
  shelfSlug,
  rating,
  review
}) {
  const router = useRouter();
  const hasContent = rating || review;

  function handleClick(e) {
    e.stopPropagation();
    router.push(`/u/${username}/${shelfSlug}/review/${bookId}`);
  }

  if (!hasContent) return null;

  const snippet = review
    ? review.length > SNIPPET_LENGTH
      ? review.slice(0, SNIPPET_LENGTH).trimEnd() + "..."
      : review
    : null;

  return (
    <button
      onClick={handleClick}
      className="absolute inset-0 z-10 flex flex-col justify-end p-3 text-left
                 bg-gradient-to-t from-black/80 via-black/40 to-transparent
                 opacity-0 group-hover:opacity-100 transition-opacity duration-200
                 rounded-[inherit] w-full"
    >
      {rating && (
        <div className="mb-1">
          <StarRating rating={rating} size={11} />
        </div>
      )}
      {snippet && (
        <p className="font-departureMono text-[9px] text-white leading-relaxed line-clamp-3">
          &ldquo;{snippet}&rdquo;
        </p>
      )}
    </button>
  );
}
