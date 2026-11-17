"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLibrary } from "@/components/providers/LibraryProvider";

const SHOWN = 4;

/**
 * The first few books on Currently Reading, in shelf order, kept in step
 * with progress logged or books moved anywhere in the app. `items` is null
 * until loaded; `count` is how many are on the shelf in all.
 */
export function useCurrentlyReading() {
  const library = useLibrary();
  const shelf = library.statusShelves.find((s) => s.slug === "currently-reading");
  const [items, setItems] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      library.subscribe((ev) => {
        // Progress edits patch in place; shelf moves change which books show.
        if (ev.type === "updated") {
          setItems((prev) =>
            prev?.map((r) =>
              r.user_books.id === ev.userBookId ? { ...r, user_books: { ...r.user_books, ...ev.fields } } : r
            )
          );
        } else {
          setVersion((v) => v + 1);
        }
      }),
    [library.subscribe]
  );

  useEffect(() => {
    if (!shelf) return;
    let cancelled = false;
    createClient()
      .from("bookshelf_books")
      .select(
        "id, position, user_books (id, rating, review, progress_pages, progress_percent, date_started, date_finished, books (id, title, authors, cover_url, page_count))"
      )
      .eq("bookshelf_id", shelf.id)
      .order("position", { ascending: true, nullsFirst: false })
      .limit(SHOWN)
      .then(({ data }) => {
        if (!cancelled) setItems((data || []).filter((r) => r.user_books?.books));
      });
    return () => {
      cancelled = true;
    };
  }, [shelf?.id, version]);

  let count = 0;
  if (shelf) for (const e of library.entries.values()) if (e.shelfIds.includes(shelf.id)) count++;

  // A library with no Currently Reading shelf simply has nothing on the go.
  const loaded = library.ready && (!shelf || items !== null);
  return { shelf, items: loaded ? (shelf ? items : []) : null, count };
}
