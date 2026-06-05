"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const DRAG_THRESHOLD = 6; // px — must move this far before drag activates
const SWAP_COOLDOWN = 80; // ms — minimum time between overIndex changes

function suppressNextClick(e) {
  e.stopPropagation();
  e.preventDefault();
}

/**
 * ID-based drag-and-drop hook.
 *
 * Instead of juggling raw indices (which differ between the sorted display
 * order and the raw `books` state), this hook tracks the *dragged book's ID*
 * and a *visual drop position*. `liveBooks` is always derived by:
 *   1. Finding the dragged item in `books` by ID.
 *   2. Removing it.
 *   3. Inserting it at the target visual position.
 */
export function useShelfDragDrop({ books, setBooks, shelfId, enabled }) {
  const [dragging, setDragging] = useState(false);
  const [overIndex, setOverIndex] = useState(null); // visual drop position
  const ghostPosRef = useRef(null); // { x, y } — updated directly, not via state
  const [ghostSize, setGhostSize] = useState({ w: 80, h: 120 });
  const ghostElRef = useRef(null); // DOM ref for the ghost element

  const draggedIdRef = useRef(null); // ID of the book being dragged
  const overIndexRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const pendingRef = useRef(null); // { bookId, startX, startY, rect } | null
  const lastSwapTime = useRef(0); // timestamp of last overIndex change
  const booksRef = useRef(books);
  const setBooksFnRef = useRef(setBooks);
  const shelfIdRef = useRef(shelfId);
  const saving = useRef(false);

  useEffect(() => { booksRef.current = books; }, [books]);
  useEffect(() => { setBooksFnRef.current = setBooks; }, [setBooks]);
  useEffect(() => { shelfIdRef.current = shelfId; }, [shelfId]);
  useEffect(() => { overIndexRef.current = overIndex; }, [overIndex]);

  // Compute the live-reordered list for rendering during drag.
  // `overIndex` is the desired VISUAL position of the dragged item.
  const liveBooks = useMemo(() => {
    if (!dragging || !draggedIdRef.current || overIndex === null) return books;
    const fromIdx = books.findIndex((b) => b.id === draggedIdRef.current);
    if (fromIdx === -1) return books;
    if (fromIdx === overIndex) return books;
    const copy = [...books];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(overIndex, 0, moved);
    return copy;
  }, [books, dragging, overIndex]);

  useEffect(() => {
    if (!enabled) return;

    function onPointerMove(e) {
      const pd = pendingRef.current;

      if (pd) {
        // Press is recorded but drag not yet started — check threshold
        const dx = e.clientX - pd.startX;
        const dy = e.clientY - pd.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

        // Threshold crossed: activate drag
        document.addEventListener("click", suppressNextClick, {
          capture: true,
          once: true,
        });

        // Find the initial visual position of the dragged book in `books`
        const initialIdx = booksRef.current.findIndex(
          (b) => b.id === pd.bookId
        );

        pendingRef.current = null;
        draggedIdRef.current = pd.bookId;
        overIndexRef.current = initialIdx !== -1 ? initialIdx : 0;
        offsetRef.current = {
          x: pd.startX - pd.rect.left,
          y: pd.startY - pd.rect.top,
        };
        draggingRef.current = true;
        setGhostSize({ w: pd.rect.width, h: pd.rect.height });
        ghostPosRef.current = { x: e.clientX, y: e.clientY };
        setOverIndex(initialIdx !== -1 ? initialIdx : 0);
        setDragging(true);
        lastSwapTime.current = performance.now();
        return;
      }

      if (!draggingRef.current) return;

      // Dragging phase: update ghost position via DOM (no React re-render)
      ghostPosRef.current = { x: e.clientX, y: e.clientY };
      if (ghostElRef.current) {
        ghostElRef.current.style.left = `${e.clientX - offsetRef.current.x}px`;
        ghostElRef.current.style.top = `${e.clientY - offsetRef.current.y}px`;
      }

      // Cooldown: skip if we swapped too recently (prevents flickering)
      if (performance.now() - lastSwapTime.current < SWAP_COOLDOWN) return;

      // Find which tile is under the cursor via elementFromPoint.
      // The ghost has pointerEvents:none so it won't intercept.
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tile = el?.closest("[data-drag-idx]");
      if (tile) {
        const idx = parseInt(tile.dataset.dragIdx, 10);
        if (!isNaN(idx) && idx !== overIndexRef.current) {
          lastSwapTime.current = performance.now();
          overIndexRef.current = idx;
          setOverIndex(idx);
        }
      }
    }

    async function onPointerUp() {
      if (pendingRef.current) {
        pendingRef.current = null;
        return;
      }

      if (!draggingRef.current) return;

      const bookId = draggedIdRef.current;
      const over = overIndexRef.current;
      const currentBooks = booksRef.current;

      draggingRef.current = false;
      draggedIdRef.current = null;
      ghostPosRef.current = null;
      setDragging(false);
      setOverIndex(null);

      if (!bookId || over === null) return;

      // Check if the book actually moved
      const fromIdx = currentBooks.findIndex((b) => b.id === bookId);
      if (fromIdx === -1 || fromIdx === over) return;

      const reordered = [...currentBooks];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(over, 0, moved);
      const withPositions = reordered.map((b, i) => ({
        ...b,
        position: i + 1,
      }));
      setBooksFnRef.current(withPositions);

      if (saving.current) return;
      saving.current = true;
      try {
        const orderedIds = withPositions
          .filter((b) => b.id && !String(b.id).startsWith("new-"))
          .map((b) => b.id);
        if (!orderedIds.length) return;
        const res = await fetch(`/api/shelves/${shelfIdRef.current}/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds }),
        });
        if (!res.ok) {
          setBooksFnRef.current(currentBooks);
          console.error("Reorder failed — reverted");
        }
      } catch {
        setBooksFnRef.current(currentBooks);
      } finally {
        saving.current = false;
      }
    }

    function onPointerCancel() {
      pendingRef.current = null;
      if (draggingRef.current) {
        draggingRef.current = false;
        draggedIdRef.current = null;
        ghostPosRef.current = null;
        setDragging(false);
        setOverIndex(null);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [enabled]);

  // Called from the tile's onPointerDown — records the press into a ref.
  // NO React state change = NO re-render = click event sequence stays intact.
  const startDrag = useCallback(
    (e, bookId) => {
      if (!enabled) return;
      pendingRef.current = {
        bookId,
        startX: e.clientX,
        startY: e.clientY,
        rect: e.currentTarget.getBoundingClientRect(),
      };
    },
    [enabled]
  );

  const draggedBook = useMemo(() => {
    if (!dragging || !draggedIdRef.current) return null;
    return books.find((b) => b.id === draggedIdRef.current) ?? null;
  }, [dragging, books]);

  return {
    dragging,
    liveBooks,
    ghostPosRef,
    ghostSize,
    ghostElRef,
    offsetRef,
    draggedBook,
    overIndex,
    startDrag,
  };
}
