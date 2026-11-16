"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// Shelves load books without their descriptions (it's most of the payload);
// the popover and drawer fetch the one they're showing. undefined = loading,
// null = the book has none.
const cache = new Map();

export function useBookDescription(book) {
  const hasOwn = !!book && "description" in book;
  const id = book?.id;
  const [fetched, setFetched] = useState(() => (id ? cache.get(id) : undefined));

  useEffect(() => {
    if (!id || hasOwn) return;
    if (cache.has(id)) {
      setFetched(cache.get(id));
      return;
    }
    let live = true;
    createClient()
      .from("books")
      .select("description")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        const value = data?.description ?? null;
        cache.set(id, value);
        if (live) setFetched(value);
      });
    return () => {
      live = false;
    };
  }, [id, hasOwn]);

  return hasOwn ? book.description : fetched;
}
