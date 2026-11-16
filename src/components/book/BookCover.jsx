"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { coverUrl, coverSrcSet } from "@/lib/covers";

/**
 * A book cover that reads as a physical book (spine crease, edge, contact
 * shadow — see .book-cover in globals.css). Missing or broken covers become
 * a typeset title card, so a shelf never shows a hole.
 *
 * `book` needs { title, authors?, cover_url? }; `src` overrides the URL.
 */
export default function BookCover({
  book,
  src,
  className,
  imgClassName,
  sizes,
  eager = false,
  flat = false,
  onLoad
}) {
  const url = src ?? coverUrl(book?.cover_url);
  // Shelf-sized copies unless a caller passes its own src.
  const srcSet = src ? undefined : coverSrcSet(book?.cover_url);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImage = url && !failed;

  // An image that finished loading before React attached its onLoad (cached,
  // or loaded during hydration) never fires it; check when the element mounts.
  const imgRef = useCallback((img) => {
    if (img?.complete) {
      if (img.naturalWidth) setLoaded(true);
      else setFailed(true);
    }
  }, []);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        !flat && "book-cover",
        flat && "rounded-[3px]",
        className
      )}
      style={{ aspectRatio: "2 / 3" }}
    >
      {showImage ? (
        <>
          {!loaded && (
            <div className="absolute inset-0 bg-black/[0.07] animate-pulse" />
          )}
          <img
            ref={imgRef}
            src={url}
            alt={book?.title ? `${book.title} cover` : ""}
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            srcSet={srcSet}
            sizes={srcSet ? sizes || "(max-width: 640px) 34vw, 200px" : sizes}
            onLoad={() => {
              setLoaded(true);
              onLoad?.();
            }}
            onError={() => {
              setFailed(true);
              onLoad?.();
            }}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
              imgClassName
            )}
          />
        </>
      ) : (
        <TitleCard book={book} />
      )}
    </div>
  );
}

// Cloth colours for books without a cover image, each with an ink that
// reads on it. A book always gets the same one.
const CLOTH = [
  { bg: "#6b2d2b", ink: "#f2e7d3" }, // oxblood
  { bg: "#2f4a3b", ink: "#ece0c6" }, // forest
  { bg: "#28394f", ink: "#eadcc1" }, // navy
  { bg: "#b38a3e", ink: "#2a2116" }, // ochre
  { bg: "#4b5560", ink: "#eee6d6" }, // slate
  { bg: "#503651", ink: "#f0e3cd" }, // plum
  { bg: "#2f5557", ink: "#ebe0c7" }, // teal
  { bg: "#a4553b", ink: "#f7ead7" }, // terracotta
  { bg: "#8c9b7d", ink: "#1f261b" }, // sage
  { bg: "#d8c8a7", ink: "#2b2418" }  // sand
];

function clothFor(title = "") {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return CLOTH[h % CLOTH.length];
}

/** A cloth-bound stand-in: the title stamped in a frame, the author below. */
function TitleCard({ book }) {
  const title = book?.title || "Untitled";
  const author = book?.authors?.[0] || book?.author;
  const { bg, ink } = clothFor(title);
  return (
    <div className="title-card absolute inset-0" style={{ backgroundColor: bg, color: ink }}>
      <div className="title-card__frame">
        <span className="title-card__rule" style={{ backgroundColor: ink }} aria-hidden="true" />
        <span className="title-card__title font-ppMondwest">{title}</span>
        {author && (
          <span className="title-card__author font-departureMono uppercase">{author}</span>
        )}
      </div>
    </div>
  );
}
