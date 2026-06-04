"use client";
import { useState, useMemo, useRef, useEffect } from "react";

const DRAG_THRESHOLD = 6; // px — must move this far before drag activates

function suppressNextClick(e) {
  e.stopPropagation();
  e.preventDefault();
}

export function useShelfDragDrop({ books, setBooks, shelfId, enabled }) {
  const [dragging, setDragging] = useState(false);
  const [overIndex, setOverIndex] = useState(null);
  const [ghostPos, setGhostPos] = useState(null);
  const [ghostSize, setGhostSize] = useState({ w: 80, h: 120 });

  const fromIndexRef = useRef(null);
  const overIndexRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const pendingRef = useRef(null); // { index, startX, startY, rect } | null
  const rafRef = useRef(null); // rAF handle — throttles overIndex updates to one per frame
  const booksRef = useRef(books);
  const setBooksFnRef = useRef(setBooks);
  const shelfIdRef = useRef(shelfId);
  const saving = useRef(false);

  useEffect(() => { booksRef.current = books; }, [books]);
  useEffect(() => { setBooksFnRef.current = setBooks; }, [setBooks]);
  useEffect(() => { shelfIdRef.current = shelfId; }, [shelfId]);
  useEffect(() => { overIndexRef.current = overIndex; }, [overIndex]);

  const liveBooks = useMemo(() => {
    if (!dragging || fromIndexRef.current === null || overIndex === null)
      return books;
    const from = fromIndexRef.current;
    if (from === overIndex) return books;
    const copy = [...books];
    const [moved] = copy.splice(from, 1);
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

        // Threshold crossed: activate drag (first React state change happens HERE)
        // Suppress the click the browser will fire when pointer is eventually released
        document.addEventListener("click", suppressNextClick, {
          capture: true,
          once: true,
        });

        pendingRef.current = null;
        fromIndexRef.current = pd.index;
        overIndexRef.current = pd.index;
        offsetRef.current = {
          x: pd.startX - pd.rect.left,
          y: pd.startY - pd.rect.top,
        };
        draggingRef.current = true;
        setGhostSize({ w: pd.rect.width, h: pd.rect.height });
        setGhostPos({ x: e.clientX, y: e.clientY });
        setOverIndex(pd.index);
        setDragging(true);
        return;
      }

      if (!draggingRef.current) return;

      // Dragging phase: update ghost and find which tile is under the cursor.
      // elementFromPoint works regardless of implicit pointer capture because it
      // queries visual layout directly. The ghost has pointerEvents:none so it
      // is invisible to the hit test.
      setGhostPos({ x: e.clientX, y: e.clientY });

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tile = el?.closest("[data-drag-idx]");
      if (tile) {
        const idx = parseInt(tile.dataset.dragIdx, 10);
        if (!isNaN(idx) && idx !== overIndexRef.current) {
          const rect = tile.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          if (Math.abs(e.clientX - cx) <= 20) {
            // Throttle state update to one per animation frame to avoid
            // queuing multiple re-renders per pointermove burst
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
              rafRef.current = null;
              overIndexRef.current = idx;
              setOverIndex(idx);
            });
          }
        }
      }
    }

    async function onPointerUp() {
      if (pendingRef.current) {
        // Released before threshold — pure tap. Clear pending and let the
        // browser's native click event fire and reach Book's onClick handler.
        pendingRef.current = null;
        return;
      }

      if (!draggingRef.current) return;

      const from = fromIndexRef.current;
      const over = overIndexRef.current;
      const currentBooks = booksRef.current;

      draggingRef.current = false;
      fromIndexRef.current = null;
      setDragging(false);
      setOverIndex(null);
      setGhostPos(null);

      if (from === null || over === null || from === over) return;

      const reordered = [...currentBooks];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(over, 0, moved);
      const withPositions = reordered.map((b, i) => ({ ...b, position: i + 1 }));
      setBooksFnRef.current(withPositions);

      if (saving.current) return;
      saving.current = true;
      try {
        const orderedIds = withPositions.map((b) => b.id);
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
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (draggingRef.current) {
        draggingRef.current = false;
        fromIndexRef.current = null;
        setDragging(false);
        setOverIndex(null);
        setGhostPos(null);
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

  // Called from motion.div onPointerDown — records the press into a ref only.
  // NO React state change = NO re-render = click event sequence stays intact.
  function startDrag(e, index) {
    if (!enabled) return;
    pendingRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      rect: e.currentTarget.getBoundingClientRect(),
    };
  }

  const draggedBook =
    dragging && fromIndexRef.current !== null
      ? books[fromIndexRef.current]
      : null;

  return {
    dragging,
    liveBooks,
    ghostPos,
    ghostSize,
    offsetRef,
    draggedBook,
    overIndex,
    startDrag,
  };
}
