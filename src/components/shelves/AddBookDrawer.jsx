"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addBookToShelf } from "@/lib/shelfBooks";
import { getUserShelves } from "@/lib/bookshelves";
import { fetchAndNormaliseBook } from "@/lib/books/fetchAndNormaliseBook";
import { TABLES } from "@/lib/supabase/types";

export default function AddBookDrawer({
  userId,
  shelfId,
  onClose,
  onBookAdded
}) {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shelves, setShelves] = useState([]);
  const [selectedShelfId, setSelectedShelfId] = useState(shelfId || "");
  const [adding, setAdding] = useState(null);
  const [addingStatus, setAddingStatus] = useState("");
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [selectedCovers, setSelectedCovers] = useState({});
  const fetchedShelves = useRef(false);

  const loadShelves = async () => {
    if (fetchedShelves.current) return;
    fetchedShelves.current = true;
    try {
      const data = await getUserShelves(supabase, userId);
      setShelves(data || []);
      if (!selectedShelfId && data?.length > 0) {
        const exclusive = data.find((s) => s.is_exclusive);
        setSelectedShelfId(exclusive?.id || data[0].id);
      }
    } catch (e) {
      console.error("Error loading shelves:", e);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    await loadShelves();

    try {
      const res = await fetch(
        `/api/books/search?q=${encodeURIComponent(query.trim())}`
      );
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      console.error("Search error:", e);
      setError("Search failed. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async (result) => {
    if (!selectedShelfId) return;
    const key = result.preview?.isbn_13 || result.preview?.title;
    setAdding(key);
    setAddingStatus("Fetching book data...");
    setError(null);
    setWarning(null);

    try {
      let book;

      if (result.source === "local" && result._raw?.id) {
        // Local book — no need to normalise, just add to shelf
        book = result._raw;
      } else {
        // External result — run through the normalisation pipeline
        const chosenCover =
          selectedCovers[result.preview?.isbn_13 || result.preview?.title];
        const previewForAdd = chosenCover
          ? { ...result.preview, cover_preview_url: chosenCover }
          : result.preview;
        book = await fetchAndNormaliseBook(
          { _raw: result._raw, source: result.source, preview: previewForAdd },
          supabase
        );
      }

      if (!book) {
        setError("Could not fetch book data. Please try again.");
        return;
      }

      setAddingStatus("Adding to shelf...");
      await addBookToShelf(supabase, userId, book.id, selectedShelfId);

      // Fetch the user_books record that was just created
      const { data: userBook } = await supabase
        .from(TABLES.USER_BOOKS)
        .select("*")
        .eq("user_id", userId)
        .eq("book_id", book.id)
        .single();

      if (book.is_incomplete) {
        setWarning(
          "Some book details are missing but it has been added to your shelf."
        );
      }

      onBookAdded?.({ book, userBook });
      router.refresh();

      if (!book.is_incomplete) {
        onClose();
      }
    } catch (e) {
      console.error("Error adding book:", e);
      setError("Failed to add book. Please try again.");
    } finally {
      setAdding(null);
      setAddingStatus("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-ppMondwest text-xl">
            Add a Book
          </SheetTitle>
          <SheetDescription className="font-departureMono uppercase text-[11px] text-textSecondary">
            Search and add to your shelf
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Shelf selector */}
          {shelves.length > 0 && (
            <div className="space-y-1">
              <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                Add to shelf
              </label>
              <select
                className="w-full border border-border rounded-[8px] p-2 text-sm font-departureMono"
                value={selectedShelfId}
                onChange={(e) => setSelectedShelfId(e.target.value)}
              >
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search by title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="font-departureMono text-[12px]"
            />
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="font-departureMono uppercase text-[11px] bg-[#1f1f1f] text-white hover:bg-[#353535] rounded-[8px] shrink-0"
            >
              {loading ? "..." : "Search"}
            </Button>
          </div>

          {/* Error / Warning messages */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
              {error}
            </p>
          )}
          {warning && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2">
              {warning}
            </p>
          )}

          {/* Results */}
          <div className="space-y-2">
            {results.map((result, i) => {
              const preview = result.preview || {};
              const key = preview.isbn_13 || `${preview.title}-${i}`;
              const stateKey = preview.isbn_13 || preview.title;
              const isAdding = adding === stateKey;
              const allCovers = preview.all_covers || [];
              const displayCover =
                selectedCovers[stateKey] || preview.cover_preview_url;

              return (
                <div
                  key={key}
                  className="p-3 border border-border rounded-[8px] hover:bg-[#f4f4f4] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {displayCover ? (
                      <img
                        src={displayCover}
                        alt={preview.title}
                        className="w-10 h-auto rounded-sm shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-[#e0e0e0] rounded-sm shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-ppMondwest text-sm text-textPrimary truncate">
                          {preview.title}
                        </p>
                        {result.source !== "local" && (
                          <span className="shrink-0 font-departureMono uppercase text-[9px] px-1.5 py-0.5 rounded bg-[#f0f0f0] text-textSecondary">
                            New
                          </span>
                        )}
                        {result.is_incomplete && (
                          <span className="shrink-0 font-departureMono uppercase text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                            Incomplete
                          </span>
                        )}
                      </div>
                      <p className="font-departureMono uppercase text-[10px] text-textSecondary truncate">
                        {preview.author}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddBook(result)}
                      disabled={isAdding || !!adding}
                      className="font-departureMono uppercase text-[10px] bg-[#1f1f1f] text-white hover:bg-[#353535] rounded-[8px] shrink-0"
                    >
                      {isAdding ? addingStatus || "Adding..." : "Add"}
                    </Button>
                  </div>
                  {allCovers.length > 1 && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                      <span className="font-departureMono uppercase text-[9px] text-textSecondary shrink-0">
                        Covers:
                      </span>
                      <div className="flex gap-1.5 flex-wrap">
                        {allCovers.map((coverUrl, ci) => (
                          <button
                            key={ci}
                            onClick={() =>
                              setSelectedCovers((prev) => ({
                                ...prev,
                                [stateKey]: coverUrl
                              }))
                            }
                            className={`w-8 h-12 rounded-sm overflow-hidden border-2 transition-colors ${
                              displayCover === coverUrl
                                ? "border-textPrimary"
                                : "border-transparent hover:border-border"
                            }`}
                          >
                            <img
                              src={coverUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!loading && results.length === 0 && query && !error && (
            <p className="text-center text-sm text-textSecondary py-4">
              No results found
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
