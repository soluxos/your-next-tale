"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { getUserShelves, ensureDefaultShelves } from "@/lib/bookshelves";
import {
  addBookToShelf,
  removeBookFromShelf,
  removeBookFromLibrary
} from "@/lib/shelfBooks";
import { TABLES } from "@/lib/supabase/types";
import { describeWork, sameWork, titlesCompatible } from "@/lib/books/sameBook";
import AddBookDrawer from "@/components/shelves/AddBookDrawer";
import ImportLibraryDialog from "@/components/import/ImportLibraryDialog";

/**
 * LibraryProvider — the signed-in reader's library, in one place.
 *
 * Knows every shelf the user has and every book they own (and which shelves
 * it sits on), and exposes the only mutations the UI needs:
 *
 *   addBook({ book | result }, shelfId, { silent })
 *                                          add / move a book onto a shelf
 *                                          (silent: no feed activity)
 *   removeFromShelf(entry, shelfId)        take it off one shelf
 *   removeFromLibrary(entry)               remove it everywhere
 *   openAddBook({ shelfId })               open the "Add books" drawer
 *   openImport()                           open "Import & export" (CSV)
 *
 * Shelf pages subscribe() to change events so they stay in sync no matter
 * where a book was added from (drawer, Discover, book page, review modal).
 */

const LibraryContext = createContext(null);

const STATUS_PRIORITY = ["currently-reading", "want-to-read", "read", "did-not-finish"];

/**
 * Which owned book (if any) is this search result / catalogue book?
 * Any copy counts — the catalogue can hold the same book more than once, and
 * a reader who owns one copy should see "On your shelf", not "Add".
 */
function matchEntry(entries, result) {
  if (!result) return null;
  const ids = result.catalog_ids?.length
    ? result.catalog_ids
    : result.source === "local" && result._raw?.id
      ? [result._raw.id]
      : [];
  for (const id of ids) {
    const entry = entries.get(id);
    if (entry) return entry;
  }
  const p = result.preview || {};
  const work = describeWork(p);
  for (const entry of entries.values()) {
    const isbnMatch =
      (p.isbn_13 && entry.isbn_13 === p.isbn_13) ||
      (p.isbn_10 && entry.isbn_10 === p.isbn_10);
    if (isbnMatch && titlesCompatible(entry.work.core, work.core)) return entry;
    if (sameWork(entry.work, work)) return entry;
  }
  return null;
}

function bookAsResult(book) {
  if (!book) return null;
  return {
    source: "local",
    _raw: book,
    catalog_ids: book.id ? [book.id] : [],
    preview: {
      title: book.title,
      author: book.authors?.[0] || null,
      authors: book.authors || [],
      isbn_13: book.isbn_13,
      isbn_10: book.isbn_10
    }
  };
}

function entryWork(book) {
  return describeWork({ title: book?.title, authors: book?.authors || [] });
}

export function LibraryProvider({ children }) {
  const { user } = useAuth();
  const supabase = useRef(createClient()).current;
  const userId = user?.id || null;

  const [shelves, setShelves] = useState([]);
  const [entries, setEntries] = useState(() => new Map());
  const [ready, setReady] = useState(false);
  const [addState, setAddState] = useState({ open: false, shelfId: null });
  const [importOpen, setImportOpen] = useState(false);

  const entriesRef = useRef(entries);
  const shelvesRef = useRef(shelves);
  const listeners = useRef(new Set());
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  useEffect(() => {
    shelvesRef.current = shelves;
  }, [shelves]);

  const emit = useCallback((event) => {
    for (const fn of listeners.current) {
      try {
        fn(event);
      } catch (e) {
        console.error("[library] listener error", e);
      }
    }
  }, []);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  // Rating, progress, dates or review changed on one of your books. Shelves
  // and the home page patch themselves from this instead of refetching.
  const notifyUpdated = useCallback(
    (userBookId, bookId, fields) => emit({ type: "updated", userBookId, bookId, fields }),
    [emit]
  );

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!userId) {
      setShelves([]);
      setEntries(new Map());
      setReady(false);
      return;
    }
    try {
      const [rawShelves, { data: userBooks }] = await Promise.all([
        getUserShelves(supabase, userId),
        supabase
          .from(TABLES.USER_BOOKS)
          .select(
            "id, book_id, books (id, title, authors, isbn_13, isbn_10), bookshelf_books (bookshelf_id)"
          )
          .eq("user_id", userId)
      ]);
      const fullShelves = await ensureDefaultShelves(
        supabase,
        userId,
        rawShelves || []
      );
      const map = new Map();
      for (const ub of userBooks || []) {
        map.set(ub.book_id, {
          bookId: ub.book_id,
          userBookId: ub.id,
          shelfIds: (ub.bookshelf_books || []).map((l) => l.bookshelf_id),
          isbn_13: ub.books?.isbn_13 || null,
          isbn_10: ub.books?.isbn_10 || null,
          work: entryWork(ub.books)
        });
      }
      setShelves(fullShelves || []);
      setEntries(map);
      setReady(true);
    } catch (e) {
      console.error("[library] load failed", e);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Lookups ─────────────────────────────────────────────────────────────
  const getEntry = useCallback(
    (bookId) => (bookId ? entries.get(bookId) || null : null),
    [entries]
  );

  /** Match a search result (which may not have a book id yet). */
  const findEntry = useCallback(
    (result) => matchEntry(entries, result),
    [entries]
  );

  /** The entry for a catalogue book — this copy or any other copy of it. */
  const entryForBook = useCallback(
    (book) =>
      book ? entries.get(book.id) || matchEntry(entries, bookAsResult(book)) : null,
    [entries]
  );

  const shelfById = useCallback(
    (id) => shelves.find((s) => s.id === id) || null,
    [shelves]
  );

  /** The status shelf (Read / Want to Read …) a book is on, if any. */
  const statusShelfFor = useCallback(
    (entry) => {
      if (!entry) return null;
      const onShelves = entry.shelfIds
        .map((id) => shelves.find((s) => s.id === id))
        .filter(Boolean);
      return (
        onShelves.find((s) => s.is_exclusive) ||
        onShelves[0] ||
        null
      );
    },
    [shelves]
  );

  // ── Mutations ───────────────────────────────────────────────────────────
  const resolveBook = useCallback(async ({ book, result }) => {
    if (book?.id) return book;
    if (
      result?.source === "local" &&
      result._raw?.id &&
      !result._raw?.is_incomplete
    ) {
      return result._raw;
    }
    const res = await fetch("/api/books/normalise", {
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
      throw new Error(err.error || "Couldn't fetch that book");
    }
    const data = await res.json();
    if (!data.book?.id) throw new Error("Couldn't fetch that book");
    return data.book;
  }, []);

  const ownedBook = useCallback(
    async (bookId, input) => {
      if (input.book?.id === bookId) return input.book;
      if (input.result?._raw?.id === bookId) return input.result._raw;
      const { data, error } = await supabase
        .from(TABLES.BOOKS)
        .select("*")
        .eq("id", bookId)
        .single();
      if (error || !data) throw new Error("Couldn't load that book");
      return data;
    },
    [supabase]
  );

  const addBook = useCallback(
    async (input, shelfId, { silent = false } = {}) => {
      if (!userId) throw new Error("Sign in to add books");
      if (!shelfId) throw new Error("Pick a shelf first");

      // Already own a copy of this book (maybe a different catalogue row)?
      // Move that one, rather than adding a second copy.
      const owned = matchEntry(
        entriesRef.current,
        input.result || bookAsResult(input.book)
      );
      const book = owned
        ? await ownedBook(owned.bookId, input)
        : await resolveBook(input);
      const prev = entriesRef.current.get(book.id);
      const shelf = shelvesRef.current.find((s) => s.id === shelfId);

      if (prev?.shelfIds.includes(shelfId)) {
        return { book, entry: prev, shelf, alreadyThere: true };
      }

      const exclusiveIds = new Set(
        shelvesRef.current.filter((s) => s.is_exclusive).map((s) => s.id)
      );

      // Every book needs a reading status. Adding a book that has none
      // straight to a custom shelf (a tag) also puts it on Want to Read.
      let statusLink = null;
      let statusShelf = null;
      if (shelf && !shelf.is_exclusive && !(prev?.shelfIds || []).some((id) => exclusiveIds.has(id))) {
        statusShelf =
          shelvesRef.current.find((s) => s.slug === "want-to-read") ||
          shelvesRef.current.find((s) => s.is_exclusive);
        if (statusShelf) {
          statusLink = await addBookToShelf(supabase, userId, book.id, statusShelf.id, { silent });
        }
      }

      const link = await addBookToShelf(supabase, userId, book.id, shelfId, { silent });

      const prevIds = [
        ...(prev?.shelfIds || []),
        ...(statusShelf ? [statusShelf.id] : [])
      ];
      const removedShelfIds = shelf?.is_exclusive
        ? prevIds.filter((id) => exclusiveIds.has(id) && id !== shelfId)
        : [];
      const entry = {
        bookId: book.id,
        userBookId: link.user_book?.id || prev?.userBookId,
        shelfIds: [
          ...prevIds.filter((id) => !removedShelfIds.includes(id)),
          shelfId
        ],
        isbn_13: book.isbn_13 || null,
        isbn_10: book.isbn_10 || null,
        work: entryWork(book)
      };

      // Update the ref now as well as state: back-to-back calls (an import
      // adding a book's status shelf, then its tags) must see this entry
      // before React re-renders.
      entriesRef.current = new Map(entriesRef.current).set(book.id, entry);
      setEntries((m) => {
        const next = new Map(m);
        next.set(book.id, entry);
        return next;
      });

      if (statusLink) {
        emit({
          type: "added",
          book,
          userBook: statusLink.user_book || null,
          shelfId: statusShelf.id,
          shelfBookId: statusLink.id,
          position: statusLink.position,
          removedShelfIds: [],
          isNewToLibrary: !prev
        });
      }
      emit({
        type: "added",
        book,
        userBook: link.user_book || null,
        shelfId,
        shelfBookId: link.id,
        position: link.position,
        removedShelfIds,
        isNewToLibrary: !prev && !statusLink
      });

      return {
        book,
        entry,
        shelf,
        alreadyThere: false,
        alsoAddedTo: statusShelf,
        isNewToLibrary: !prev
      };
    },
    [emit, ownedBook, resolveBook, supabase, userId]
  );

  const removeFromShelf = useCallback(
    async (entry, shelfId) => {
      if (!entry?.userBookId) return;
      await removeBookFromShelf(supabase, entry.userBookId, shelfId);
      const remaining = entry.shelfIds.filter((id) => id !== shelfId);
      setEntries((m) => {
        const next = new Map(m);
        // removeBookFromShelf deletes the user_book once it's on no shelves
        if (remaining.length) next.set(entry.bookId, { ...entry, shelfIds: remaining });
        else next.delete(entry.bookId);
        return next;
      });
      emit({
        type: "removed",
        bookId: entry.bookId,
        userBookId: entry.userBookId,
        shelfIds: [shelfId],
        libraryRemoved: remaining.length === 0
      });
    },
    [emit, supabase]
  );

  const removeFromLibrary = useCallback(
    async (entry) => {
      if (!entry?.userBookId) return;
      await removeBookFromLibrary(supabase, entry.userBookId);
      setEntries((m) => {
        const next = new Map(m);
        next.delete(entry.bookId);
        return next;
      });
      emit({
        type: "removed",
        bookId: entry.bookId,
        userBookId: entry.userBookId,
        shelfIds: entry.shelfIds,
        libraryRemoved: true
      });
    },
    [emit, supabase]
  );

  // ── Add-books drawer ────────────────────────────────────────────────────
  const openAddBook = useCallback(
    ({ shelfId = null } = {}) => setAddState({ open: true, shelfId }),
    []
  );
  const closeAddBook = useCallback(
    () => setAddState((s) => ({ ...s, open: false })),
    []
  );
  const openImport = useCallback(() => {
    setAddState((s) => ({ ...s, open: false }));
    setImportOpen(true);
  }, []);

  // ⌘K / Ctrl+K opens "Add books" from anywhere
  useEffect(() => {
    if (!userId) return;
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAddState((s) => ({ open: !s.open, shelfId: s.shelfId }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId]);

  /** Where a new book should go when the caller didn't say. */
  const defaultShelfId = useMemo(() => {
    const want = shelves.find((s) => s.slug === "want-to-read");
    return want?.id || shelves.find((s) => s.is_exclusive)?.id || shelves[0]?.id || null;
  }, [shelves]);

  const statusShelves = useMemo(
    () =>
      shelves
        .filter((s) => s.is_exclusive)
        .sort(
          (a, b) =>
            rank(STATUS_PRIORITY, a.slug) - rank(STATUS_PRIORITY, b.slug)
        ),
    [shelves]
  );
  const customShelves = useMemo(
    () => shelves.filter((s) => !s.is_exclusive),
    [shelves]
  );

  const value = useMemo(
    () => ({
      ready,
      userId,
      shelves,
      statusShelves,
      customShelves,
      entries,
      defaultShelfId,
      getEntry,
      findEntry,
      entryForBook,
      shelfById,
      statusShelfFor,
      addBook,
      removeFromShelf,
      removeFromLibrary,
      subscribe,
      notifyUpdated,
      openAddBook,
      closeAddBook,
      openImport,
      refresh: load,
      setShelves
    }),
    [
      ready,
      userId,
      shelves,
      statusShelves,
      customShelves,
      entries,
      defaultShelfId,
      getEntry,
      findEntry,
      entryForBook,
      shelfById,
      statusShelfFor,
      addBook,
      removeFromShelf,
      removeFromLibrary,
      subscribe,
      notifyUpdated,
      openAddBook,
      closeAddBook,
      openImport,
      load
    ]
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
      {userId && (
        <AddBookDrawer
          open={addState.open}
          initialShelfId={addState.shelfId}
          onClose={closeAddBook}
        />
      )}
      {userId && (
        <ImportLibraryDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
      )}
    </LibraryContext.Provider>
  );
}

function rank(order, slug) {
  const i = order.indexOf(slug);
  return i === -1 ? order.length : i;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return ctx;
}
