"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The 3D bookcase every row of books sits in: Discover, a reader's shelves,
 * and their loading / empty states. One component so they all look alike.
 *
 *   <Bookcase>
 *     <Shelf>{covers…}</Shelf>
 *     <Shelf>{covers…}</Shelf>
 *   </Bookcase>
 *
 * Geometry is driven by CSS variables on .bookcase (see globals.css), so
 * phones get slimmer posts and shallower shelves and more room for covers.
 */

// Books per shelf. Mirrors the grid-cols classes on .shelf-books.
export function booksPerRowFor(width) {
  if (width >= 1024) return 9;
  if (width >= 768) return 6;
  if (width >= 480) return 4;
  return 3;
}

export function useBooksPerRow() {
  const [perRow, setPerRow] = useState(9);
  useEffect(() => {
    const update = () => setPerRow(booksPerRowFor(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return perRow;
}

/** Split items into shelves, padding the last one so covers keep their size. */
export function chunkIntoShelves(items, perRow, { minRows = 1 } = {}) {
  const list = [...items];
  while (list.length < perRow * minRows) {
    list.push({ id: `placeholder-${list.length}`, placeholder: true });
  }
  const rows = [];
  for (let i = 0; i < list.length; i += perRow) rows.push(list.slice(i, i + perRow));
  const last = rows[rows.length - 1];
  while (last && last.length < perRow) {
    last.push({ id: `placeholder-pad-${last.length}`, placeholder: true });
  }
  return rows;
}

// A square corner piece, scaled to the shelf depth.
function Corner({ points, fill, line }) {
  return (
    <svg
      viewBox="0 0 40 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="bookcase-corner"
    >
      <polygon points={points} fill={fill} />
      {line && (
        <line
          {...line}
          stroke="var(--case-line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

export function Bookcase({ children, className, base = false, ...rest }) {
  return (
    <div className={cn("bookcase", className)} {...rest}>
      {/* Top surface, seen from slightly above */}
      <div className="bookcase-top" aria-hidden="true">
        <Corner
          points="0,40 40,40 40,0"
          fill="var(--case-top)"
          line={{ x1: 0, y1: 40, x2: 40, y2: 0 }}
        />
        <div className="bookcase-top-bar" />
        <Corner
          points="0,0 0,40 40,40"
          fill="var(--case-top)"
          line={{ x1: 0, y1: 0, x2: 40, y2: 40 }}
        />
      </div>

      <div className="bookcase-body">
        <div className="bookcase-post" aria-hidden="true" />
        <div className="min-w-0">
          <div className="bookcase-rail" aria-hidden="true" />
          {children}
          {base && <div className="bookcase-base" aria-hidden="true" />}
        </div>
        <div className="bookcase-post" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * One shelf: side walls, back wall, the floor the books stand on, and the
 * front lip. `children` are the covers (or an empty / loading state).
 */
export const Shelf = React.forwardRef(function Shelf(
  { children, className, booksClassName, grid = true, style, ...rest },
  ref
) {
  return (
    <>
      <div ref={ref} className={cn("shelf", className)} style={style} {...rest}>
        <div className="shelf-side shelf-side-left" aria-hidden="true">
          <div className="flex-1" />
          <Corner points="0,0 40,0 0,40" fill="var(--case-side-l)" />
        </div>

        <div className="shelf-bay">
          <div
            className={cn(
              grid ? "shelf-books" : "shelf-books-free",
              booksClassName
            )}
          >
            {children}
          </div>
          <div className="shelf-floor" aria-hidden="true" />
        </div>

        <div className="shelf-side shelf-side-right" aria-hidden="true">
          <div className="flex-1" />
          <Corner points="0,0 40,0 40,40" fill="var(--case-side-r)" />
        </div>
      </div>
      <div className="shelf-lip" aria-hidden="true" />
    </>
  );
});

/**
 * The soft shadow a cover casts on the plank it stands on. Put it inside the
 * cover's positioned wrapper (one with `group` and a z-index); it stays on
 * the floor when the cover lifts on hover, so the book reads as picked up.
 */
export function ContactShadow({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -z-10 left-[6%] right-[6%] -bottom-[3px] h-[9px] rounded-[50%] bg-black/45 blur-[4px]",
        "transition-[opacity,transform] duration-200 group-hover:opacity-40 group-hover:scale-x-90 group-focus-within:opacity-40",
        className
      )}
    />
  );
}

// Books per row at each breakpoint (mirrors .shelf-books' grid columns), with
// the literal classes that show / hide a slot from that width up.
const SKELETON_BREAKPOINTS = [
  { perRow: 3, show: "block", hide: "hidden" },
  { perRow: 4, show: "xs:block", hide: "xs:hidden" },
  { perRow: 6, show: "md:block", hide: "md:hidden" },
  { perRow: 9, show: "lg:block", hide: "lg:hidden" }
];
const visibleWhen = (test) =>
  SKELETON_BREAKPOINTS.map((bp) => (test(bp.perRow) ? bp.show : bp.hide)).join(" ");

/**
 * Pulsing cover placeholders.
 *
 * With `perRow` it renders exactly that many per shelf. Without it (server
 * render, or before the viewport is measured) it lays out every breakpoint
 * in CSS, so the first paint is already right: `count` covers (e.g. the
 * shelf's known size) across at most `rows` shelves — one on phones — with
 * the rest of each shelf left empty.
 */
export function ShelfSkeleton({ perRow, rows = 1, count }) {
  const pulse = (i) => (
    <div
      className="w-full rounded-[3px] bg-black/[0.08] animate-pulse"
      style={{ aspectRatio: "2 / 3", animationDelay: `${i * 60}ms` }}
    />
  );

  if (perRow) {
    const total = count ?? perRow * rows;
    return Array.from({ length: rows }).map((_, r) => (
      <Shelf key={r}>
        {Array.from({ length: perRow }).map((_, i) => (
          <div key={i} className="w-full relative z-10">
            {r * perRow + i < total && pulse(i)}
          </div>
        ))}
      </Shelf>
    ));
  }

  const total = count ?? Infinity;
  const maxPerRow = SKELETON_BREAKPOINTS[SKELETON_BREAKPOINTS.length - 1].perRow;
  return Array.from({ length: rows }).map((_, r) => (
    <div
      key={r}
      // Later shelves only where there's more than one row's worth to show.
      className={r === 0 ? undefined : visibleWhen((n) => n > 3 && r * n < total)}
    >
      <Shelf>
        {Array.from({ length: maxPerRow }).map((_, i) => (
          <div key={i} className={cn("w-full relative z-10", visibleWhen((n) => i < n))}>
            <div className={visibleWhen((n) => r * n + i < total)}>{pulse(i)}</div>
          </div>
        ))}
      </Shelf>
    </div>
  ));
}
