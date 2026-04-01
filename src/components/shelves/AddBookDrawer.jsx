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
  const [searchedExternal, setSearchedExternal] = useState(false);
  const [loadingExternal, setLoadingExternal] = useState(false);
  const [shelves, setShelves] = useState([]);
  const [selectedShelfId, setSelectedShelfId] = useState(shelfId || "");
  const [adding, setAdding] = useState(null);
  const [addingStatus, setAddingStatus] = useState("");
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [selectedCovers, setSelectedCovers] = useState({});
  const fetchedShelves = useRef(false);
  const lastQuery = useRef("");

  // Detail view state
  const [selectedResult, setSelectedResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [chosenDescription, setChosenDescription] = useState(null);
  const [chosenCover, setChosenCover] = useState(null);

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

  // Phase 1: Fast DB-only search
  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    setSearchedExternal(false);
    lastQuery.current = query.trim();
    await loadShelves();

    try {
      const res = await fetch(
        `/api/books/search?q=${encodeURIComponent(query.trim())}&source=local`
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

  // Phase 2: Full external search (user-triggered)
  const handleSearchExternal = async () => {
    const q = lastQuery.current;
    if (!q) return;
    setLoadingExternal(true);
    setError(null);

    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      setResults(data.results || []);
      setSearchedExternal(true);
    } catch (e) {
      console.error("External search error:", e);
      setError("Online search failed. Please try again.");
    } finally {
      setLoadingExternal(false);
    }
  };

  // Click a search result — local books add directly, external opens detail view
  const handleResultClick = async (result) => {
    if (
      result.source === "local" &&
      result._raw?.id &&
      !result._raw?.is_incomplete
    ) {
      // Complete local book — add directly
      handleAddBook(result);
      return;
    }

    // External / incomplete — open detail view and fetch preview
    setSelectedResult(result);
    setLoadingPreview(true);
    setError(null);
    setChosenDescription(null);
    setChosenCover(null);

    try {
      const res = await fetch("/api/books/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _raw: result._raw,
          source: result.source,
          preview: result.preview,
          ...(result.hardcover_id ? { hardcover_id: result.hardcover_id } : {})
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Preview fetch failed");
      }

      const data = await res.json();
      setPreviewData(data);

      // Default to longest description
      const descriptions = getUniqueDescriptions(data.sources);
      if (descriptions.length > 0) {
        setChosenDescription(descriptions[0].text);
      }

      // Default to first cover candidate
      if (data.coverCandidates?.length > 0) {
        setChosenCover(data.coverCandidates[0]);
      }
    } catch (e) {
      console.error("Preview error:", e);
      setError("Failed to load book details. Please try again.");
      setSelectedResult(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleBackToResults = () => {
    setSelectedResult(null);
    setPreviewData(null);
    setChosenDescription(null);
    setChosenCover(null);
    setError(null);
  };

  // Add book (used for both direct add and confirmed detail add)
  const handleAddBook = async (result, overrides = {}) => {
    if (!selectedShelfId) return;
    const key = result.preview?.isbn_13 || result.preview?.title;
    setAdding(key);
    setAddingStatus("Fetching book data...");
    setError(null);
    setWarning(null);

    try {
      let book;

      if (
        result.source === "local" &&
        result._raw?.id &&
        !result._raw?.is_incomplete
      ) {
        book = result._raw;
      } else {
        const chosenCoverUrl =
          overrides.chosenCover ||
          selectedCovers[result.preview?.isbn_13 || result.preview?.title];
        const previewForAdd = chosenCoverUrl
          ? { ...result.preview, cover_preview_url: chosenCoverUrl }
          : result.preview;

        const res = await fetch("/api/books/normalise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            _raw: result._raw,
            source: result.source,
            preview: previewForAdd,
            ...(result.hardcover_id
              ? { hardcover_id: result.hardcover_id }
              : {}),
            ...(overrides.chosenDescription
              ? { chosenDescription: overrides.chosenDescription }
              : {}),
            ...(overrides.chosenCover
              ? { chosenCover: overrides.chosenCover }
              : {})
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Normalisation failed");
        }

        const data = await res.json();
        book = data.book;
      }

      if (!book) {
        setError("Could not fetch book data. Please try again.");
        return;
      }

      setAddingStatus("Adding to shelf...");
      await addBookToShelf(supabase, userId, book.id, selectedShelfId);

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

  const handleConfirmAdd = () => {
    if (!selectedResult) return;
    handleAddBook(selectedResult, {
      chosenDescription,
      chosenCover
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const hasSearched = lastQuery.current && !loading;
  const showExternalPrompt =
    hasSearched && !searchedExternal && !loadingExternal;

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
          {/* ──────── DETAIL VIEW ──────── */}
          {selectedResult ? (
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={handleBackToResults}
                className="font-departureMono uppercase text-[11px] text-textSecondary hover:text-textPrimary transition-colors flex items-center gap-1"
              >
                <span>←</span> Back to results
              </button>

              {loadingPreview ? (
                <div className="py-8 text-center">
                  <p className="font-departureMono uppercase text-[10px] text-textSecondary animate-pulse">
                    Loading book details from multiple sources...
                  </p>
                </div>
              ) : previewData ? (
                <DetailView
                  result={selectedResult}
                  previewData={previewData}
                  chosenDescription={chosenDescription}
                  setChosenDescription={setChosenDescription}
                  chosenCover={chosenCover}
                  setChosenCover={setChosenCover}
                  shelves={shelves}
                  selectedShelfId={selectedShelfId}
                  setSelectedShelfId={setSelectedShelfId}
                  adding={adding}
                  addingStatus={addingStatus}
                  onConfirm={handleConfirmAdd}
                  error={error}
                  warning={warning}
                />
              ) : null}
            </div>
          ) : (
            <>
              {/* ──────── SEARCH VIEW ──────── */}
              {/* Shelf selector */}
              {shelves.length > 0 && (
                <div className="space-y-1">
                  <label className="font-departureMono uppercase text-[10px] text-textSecondary">
                    Add to shelf
                  </label>
                  <select
                    className="w-full border border-border rounded-[8px] px-3 h-9 font-departureMono text-[12px] bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary"
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
                  placeholder="Search by title or author..."
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
                <p className="font-departureMono uppercase text-[10px] text-red-500 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
                  {error}
                </p>
              )}
              {warning && (
                <p className="font-departureMono uppercase text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2">
                  {warning}
                </p>
              )}

              {/* Results */}
              <div className="space-y-2">
                {results.map((result, i) => {
                  const preview = result.preview || {};
                  const key = preview.isbn_13
                    ? `${preview.isbn_13}-${i}`
                    : `${preview.title}-${i}`;
                  const stateKey = preview.isbn_13 || preview.title;
                  const isAdding = adding === stateKey;
                  const displayCover =
                    selectedCovers[stateKey] || preview.cover_preview_url;
                  const isLocal =
                    result.source === "local" &&
                    result._raw?.id &&
                    !result._raw?.is_incomplete;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleResultClick(result)}
                      disabled={isAdding || !!adding}
                      className="w-full text-left p-3 border border-border rounded-[8px] hover:bg-[#f4f4f4] transition-colors"
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
                              <span className="shrink-0 font-departureMono uppercase text-[9px] px-1.5 py-0.5 rounded-[6px] bg-[#f0f0f0] text-textSecondary">
                                New
                              </span>
                            )}
                            {result.is_incomplete && (
                              <span className="shrink-0 font-departureMono uppercase text-[9px] px-1.5 py-0.5 rounded-[6px] bg-amber-50 text-amber-600">
                                Incomplete
                              </span>
                            )}
                          </div>
                          <p className="font-departureMono uppercase text-[10px] text-textSecondary truncate">
                            {preview.author}
                          </p>
                        </div>
                        <span className="font-departureMono uppercase text-[10px] text-textSecondary shrink-0 self-center">
                          {isAdding
                            ? addingStatus || "Adding..."
                            : isLocal
                              ? "Add →"
                              : "Review →"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* "Can't find it?" prompt */}
              {showExternalPrompt && (
                <div className="text-center py-3 space-y-2">
                  {results.length === 0 && (
                    <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                      No results in our catalogue
                    </p>
                  )}
                  <button
                    onClick={handleSearchExternal}
                    className="font-departureMono uppercase text-[11px] text-textSecondary hover:text-textPrimary underline underline-offset-2 transition-colors"
                  >
                    {results.length === 0
                      ? "Search online for this book"
                      : "Can\u2019t find it? Search online"}
                  </button>
                </div>
              )}

              {/* Loading indicator for external search */}
              {loadingExternal && (
                <p className="text-center font-departureMono uppercase text-[10px] text-textSecondary py-4 animate-pulse">
                  Searching online sources...
                </p>
              )}

              {/* No results at all after external search */}
              {searchedExternal && !loadingExternal && results.length === 0 && (
                <p className="text-center font-departureMono uppercase text-[10px] text-textSecondary py-4">
                  No results found — try a different search term
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getUniqueDescriptions(sources) {
  const seen = new Set();
  const descriptions = [];
  for (const src of sources) {
    if (!src?.description) continue;
    // Dedupe by first 100 chars to catch near-identical descriptions
    const fingerprint = src.description.slice(0, 100).toLowerCase();
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    descriptions.push({ text: src.description, source: src.name });
  }
  // Sort longest first
  descriptions.sort((a, b) => b.text.length - a.text.length);
  return descriptions;
}

// ── Detail View Component ───────────────────────────────────────────────────

function DetailView({
  result,
  previewData,
  chosenDescription,
  setChosenDescription,
  chosenCover,
  setChosenCover,
  shelves,
  selectedShelfId,
  setSelectedShelfId,
  adding,
  addingStatus,
  onConfirm,
  error,
  warning
}) {
  const { merged, sources, coverCandidates } = previewData;
  const descriptions = getUniqueDescriptions(sources);
  const stateKey = result.preview?.isbn_13 || result.preview?.title;
  const isAdding = adding === stateKey;

  return (
    <div className="space-y-5">
      {/* Error / Warning */}
      {error && (
        <p className="font-departureMono uppercase text-[10px] text-red-500 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
          {error}
        </p>
      )}
      {warning && (
        <p className="font-departureMono uppercase text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2">
          {warning}
        </p>
      )}

      {/* Cover selection */}
      {coverCandidates.length > 0 && (
        <div className="space-y-2">
          <span className="font-departureMono uppercase text-[10px] text-textSecondary">
            Cover
          </span>
          <div className="flex gap-2 flex-wrap">
            {coverCandidates.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setChosenCover(url)}
                className={`w-16 h-24 rounded-sm overflow-hidden border-2 transition-colors ${
                  chosenCover === url
                    ? "border-textPrimary"
                    : "border-transparent hover:border-border"
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Title */}
      <div className="space-y-1">
        <span className="font-departureMono uppercase text-[10px] text-textSecondary">
          Title
        </span>
        <p className="font-ppMondwest text-base text-textPrimary">
          {merged.title}
        </p>
      </div>

      {/* Authors */}
      {merged.authors?.length > 0 && (
        <div className="space-y-1">
          <span className="font-departureMono uppercase text-[10px] text-textSecondary">
            Author{merged.authors.length > 1 ? "s" : ""}
          </span>
          <p className="font-departureMono text-[12px] text-textPrimary">
            {merged.authors.join(", ")}
          </p>
        </div>
      )}

      {/* ISBN */}
      {(merged.isbn_13 || merged.isbn_10) && (
        <div className="space-y-1">
          <span className="font-departureMono uppercase text-[10px] text-textSecondary">
            ISBN
          </span>
          <p className="font-departureMono text-[12px] text-textPrimary">
            {merged.isbn_13 || merged.isbn_10}
          </p>
        </div>
      )}

      {/* Description picker */}
      <div className="space-y-2">
        <span className="font-departureMono uppercase text-[10px] text-textSecondary">
          Description
          {descriptions.length > 1 && (
            <span className="normal-case ml-1">
              — pick the best match ({descriptions.length} options)
            </span>
          )}
        </span>
        {descriptions.length > 0 ? (
          <div className="space-y-2">
            {descriptions.map((desc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setChosenDescription(desc.text)}
                className={`w-full text-left p-3 rounded-[8px] border transition-colors ${
                  chosenDescription === desc.text
                    ? "border-textPrimary bg-[#f9f9f9]"
                    : "border-border hover:border-textSecondary"
                }`}
              >
                <span className="font-departureMono uppercase text-[9px] text-textSecondary block mb-1">
                  {desc.source}
                </span>
                <p className="text-[12px] text-textPrimary leading-relaxed line-clamp-4">
                  {desc.text}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="font-departureMono text-[10px] text-textSecondary italic">
            No description available from any source
          </p>
        )}
      </div>

      {/* Genres */}
      {merged.genres?.length > 0 && (
        <div className="space-y-1">
          <span className="font-departureMono uppercase text-[10px] text-textSecondary">
            Genres
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {merged.genres.slice(0, 10).map((genre, i) => (
              <span
                key={i}
                className="font-departureMono text-[10px] px-2 py-0.5 rounded-[6px] bg-[#f0f0f0] text-textSecondary"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="flex gap-4 flex-wrap">
        {merged.page_count && (
          <div className="space-y-0.5">
            <span className="font-departureMono uppercase text-[9px] text-textSecondary block">
              Pages
            </span>
            <span className="font-departureMono text-[12px] text-textPrimary">
              {merged.page_count}
            </span>
          </div>
        )}
        {merged.published_date && (
          <div className="space-y-0.5">
            <span className="font-departureMono uppercase text-[9px] text-textSecondary block">
              Published
            </span>
            <span className="font-departureMono text-[12px] text-textPrimary">
              {merged.published_date}
            </span>
          </div>
        )}
        {merged.publisher && (
          <div className="space-y-0.5">
            <span className="font-departureMono uppercase text-[9px] text-textSecondary block">
              Publisher
            </span>
            <span className="font-departureMono text-[12px] text-textPrimary">
              {merged.publisher}
            </span>
          </div>
        )}
      </div>

      {/* Shelf selector + Confirm */}
      <div className="pt-2 border-t border-border space-y-3">
        {shelves.length > 0 && (
          <div className="space-y-1">
            <label className="font-departureMono uppercase text-[10px] text-textSecondary">
              Add to shelf
            </label>
            <select
              className="w-full border border-border rounded-[8px] px-3 h-9 font-departureMono text-[12px] bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary"
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
        <Button
          onClick={onConfirm}
          disabled={isAdding || !!adding}
          className="w-full font-departureMono uppercase text-[11px] bg-[#1f1f1f] text-white hover:bg-[#353535] rounded-[8px]"
        >
          {isAdding ? addingStatus || "Adding..." : "Add to Shelf"}
        </Button>
      </div>
    </div>
  );
}
