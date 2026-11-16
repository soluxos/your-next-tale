"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import BookCover from "@/components/book/BookCover";
import { buildTaste, rankUpNext } from "@/lib/upNext";
import { updateUserBook } from "@/lib/userBooks";
import { generateBookSlug } from "@/lib/slugify";
import { cn } from "@/lib/utils";
import SectionHeading from "@/components/hero/SectionHeading";

const MODES = [
  { key: "best", label: "Best match" },
  { key: "quick", label: "Quick reads" },
  // Phones fit about ten characters a segment beside the dice.
  { key: "waiting", label: "Waiting longest", short: "Waiting" }
];
// Eight across on a wide screen: covers stay near the size they were scanned
// at, so none is enlarged and gone soft.
const SHOW = 8;

const localToday = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

/**
 * Home, signed in: picks from your Want to Read pile, ranked by the authors
 * and genres you've rated highly, each with the reason it's there.
 */
export default function UpNext({ username }) {
  const library = useLibrary();
  const { profile, updateUISettings } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  // Picks you've waved off stay off (kept in ui_settings, newest 300).
  const hiddenIds = profile?.ui_settings?.up_next_hidden;
  const hidden = useMemo(() => new Set(hiddenIds || []), [hiddenIds]);
  const wantShelf = library.statusShelves.find((s) => s.slug === "want-to-read");
  const readShelf = library.statusShelves.find((s) => s.slug === "read");
  const readingShelf = library.statusShelves.find((s) => s.slug === "currently-reading");

  const [data, setData] = useState(null);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState("best");
  const [surprise, setSurprise] = useState(null);
  const [starting, setStarting] = useState(null);
  const rowRef = useRef(null);

  // A new surprise goes first; bring the row back to it (browsers otherwise
  // keep the old cards in view and push the pick off-screen).
  useEffect(() => {
    if (surprise) rowRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [surprise]);

  // Shelf moves change the pile; rating edits don't need a refetch.
  useEffect(
    () => library.subscribe((ev) => ev.type !== "updated" && setVersion((v) => v + 1)),
    [library.subscribe]
  );

  useEffect(() => {
    if (!wantShelf || !readShelf) return;
    let cancelled = false;
    const rows = (shelfId) =>
      supabase
        .from("bookshelf_books")
        .select("user_books (id, rating, created_at, books (id, title, authors, cover_url, genres, page_count))")
        .eq("bookshelf_id", shelfId)
        .limit(1000);
    Promise.all([rows(wantShelf.id), rows(readShelf.id)]).then(([want, read]) => {
      if (cancelled) return;
      const finished = (read.data || [])
        .map((r) => r.user_books)
        .filter((ub) => ub?.books)
        .map((ub) => ({ rating: ub.rating, book: ub.books }));
      const pile = (want.data || [])
        .map((r) => r.user_books)
        .filter((ub) => ub?.books)
        .map((ub) => ({ userBookId: ub.id, addedAt: ub.created_at, book: ub.books }));
      setData({ ranked: rankUpNext(pile, buildTaste(finished)), readCount: finished.length });
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, wantShelf?.id, readShelf?.id, version]);

  const pool = useMemo(() => {
    if (!data) return [];
    const ranked = data.ranked.filter((x) => !hidden.has(x.book.id));
    if (mode === "quick") return ranked.filter((x) => x.quick);
    if (mode === "waiting") {
      return ranked
        .filter((x) => x.addedAt)
        .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
        .map((x) => ({ ...x, reason: `On your list since ${new Date(x.addedAt).getFullYear()}` }));
    }
    return ranked;
  }, [data, mode, hidden]);

  const shown = useMemo(() => {
    const pick = surprise && data?.ranked.find((x) => x.book.id === surprise);
    const rest = pool.filter((x) => x.book.id !== surprise);
    return (pick ? [pick, ...rest] : rest).slice(0, SHOW);
  }, [pool, surprise, data]);

  const surpriseMe = () => {
    // Anything from the better half of the current list, but never the same twice in a row.
    const candidates = pool.slice(0, Math.max(12, Math.ceil(pool.length / 2))).filter((x) => x.book.id !== surprise);
    if (!candidates.length) return;
    setSurprise(candidates[Math.floor(Math.random() * candidates.length)].book.id);
  };

  const startReading = async (item) => {
    if (!readingShelf) return;
    setStarting(item.book.id);
    try {
      await library.addBook({ book: item.book }, readingShelf.id);
      await updateUserBook(supabase, item.userBookId, { date_started: localToday() }, item.book.page_count, { silent: true });
      toast.success("Moved to Currently Reading", {
        description: item.book.title,
        action: { label: "Undo", onClick: () => undoStart(item) }
      });
      if (surprise === item.book.id) setSurprise(null);
    } catch (e) {
      console.error("Error starting book:", e);
      toast.error("Couldn’t move this book", { description: e.message || "Please try again." });
    } finally {
      setStarting(null);
    }
  };

  const setHidden = (ids) => updateUISettings({ up_next_hidden: ids.slice(-300) });
  const notForMe = (item) => {
    const before = [...hidden];
    setHidden([...before, item.book.id]);
    if (surprise === item.book.id) setSurprise(null);
    toast("Hidden from Up next", {
      description: `${item.book.title} stays on your Want to Read shelf.`,
      action: { label: "Undo", onClick: () => setHidden(before) }
    });
  };

  const undoStart = async (item) => {
    try {
      await library.addBook({ book: item.book }, wantShelf.id);
      await updateUserBook(supabase, item.userBookId, { date_started: null }, item.book.page_count, { silent: true });
      toast("Back on Want to Read", { description: item.book.title });
    } catch (e) {
      toast.error("Couldn’t undo that", { description: e.message || "Please try again." });
    }
  };

  if (!library.ready || !wantShelf) return null;
  if (!data) {
    return (
      <section id="up-next" className="scroll-mt-24" aria-busy="true">
        <div className="h-[34px] w-40 rounded bg-paper-2 animate-pulse" />
        <div className="mt-3 h-[15px] w-72 max-w-full rounded bg-paper-2 animate-pulse" />
        <div className="mt-10 grid grid-cols-3 xs:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-5 sm:gap-6">
          {Array.from({ length: SHOW }, (_, i) => (
            <div key={i} className={cn("aspect-[2/3] rounded-[3px] bg-paper-2 animate-pulse", i > 2 && "hidden xs:block", i > 3 && "xs:hidden lg:block", i > 5 && "lg:hidden xl:block")} />
          ))}
        </div>
      </section>
    );
  }

  const total = data.ranked.length;
  const wantHref = `/u/${encodeURIComponent(username || "")}/${wantShelf.slug}`;

  if (!total) {
    return (
      <section id="up-next" className="scroll-mt-24" aria-labelledby="up-next-title">
        <SectionHeading id="up-next-title" title="Up next" />
        <div className="card px-6 py-6 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="prose-book !text-[17px] !text-textSecondary max-w-[560px]">
            Add books you’re curious about to Want to Read, and we’ll line up what to read next based on what you’ve loved.
          </p>
          <button type="button" onClick={() => library.openAddBook({ shelfId: wantShelf.id })} className="btn btn-secondary self-start sm:self-auto">
            Add to Want to Read
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="up-next" className="scroll-mt-24" aria-labelledby="up-next-title">
      <SectionHeading
        id="up-next-title"
        title="Up next"
        stackUntil="lg"
        description={
          <>
            {data.readCount >= 3
              ? "Picked from your Want to Read pile, ranked by what you’ve loved. "
              : "Picked from your Want to Read pile. Rate what you finish and these get sharper. "}
            <Link
              href={wantHref}
              className="text-ink underline decoration-black/25 underline-offset-[3px] hover:decoration-ink transition-colors whitespace-nowrap"
            >
              See all {total}
            </Link>
          </>
        }
        action={
          <>
            <div role="group" aria-label="Show" className="flex-1 sm:flex-none grid grid-cols-3 sm:flex p-1 rounded-[10px] bg-paper-3">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={mode === m.key}
                  onClick={() => {
                    setMode(m.key);
                    setSurprise(null);
                  }}
                  className={cn(
                    "h-9 sm:h-8 px-2 sm:px-3 rounded-[7px] label whitespace-nowrap transition-colors",
                    mode === m.key ? "bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-textPrimary hover:text-ink"
                  )}
                >
                  {m.short ? (
                    <>
                      <span className="sm:hidden">{m.short}</span>
                      <span className="max-sm:hidden">{m.label}</span>
                    </>
                  ) : (
                    m.label
                  )}
                </button>
              ))}
            </div>
            <button type="button" onClick={surpriseMe} className="btn btn-secondary max-sm:btn-icon sm:h-10" disabled={!pool.length} aria-label="Surprise me">
              <Dice /> <span className="max-sm:hidden">Surprise me</span>
            </button>
          </>
        }
      />

      {shown.length ? (
        <ul ref={rowRef} className="flex gap-5 sm:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 -mx-4 px-4 pt-3 pb-2 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-6 xl:grid-cols-8 lg:overflow-visible">
          {shown.map((item) => {
            const { book } = item;
            const isSurprise = surprise === book.id;
            const href = `/books/${generateBookSlug(book.title, book.authors?.[0])}`;
            return (
              <li key={book.id} className="group/card w-[36%] xs:w-[140px] sm:w-[150px] shrink-0 snap-start lg:w-auto lg:max-xl:[&:nth-child(n+7)]:hidden flex flex-col">
                <div className={cn("relative rounded-[4px]", isSurprise && "ring-2 ring-ink ring-offset-4 ring-offset-paper")}>
                  {isSurprise && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full bg-ink text-white label !text-[10px] px-2 h-5 flex items-center">
                      Surprise pick
                    </span>
                  )}
                  <Link href={href} className="block focus-ring rounded-[3px]" aria-label={`${book.title} — book details`}>
                    <BookCover book={book} sizes="(max-width: 640px) 36vw, 170px" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => notForMe(item)}
                    aria-label={`Not for me: hide ${book.title} from Up next`}
                    title="Not for me"
                    className="absolute top-1.5 right-1.5 z-10 w-8 h-8 rounded-full bg-white/90 text-ink shadow-[0_1px_3px_rgba(0,0,0,0.25)] flex items-center justify-center opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity focus-ring"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-4 flex-1 flex flex-col">
                  <Link href={href} className="font-ppMondwest text-[16px] leading-[1.2] text-ink line-clamp-2 hover:underline underline-offset-4">
                    {book.title}
                  </Link>
                  <p className="text-[12.5px] text-textSecondary truncate mt-1">{book.authors?.[0]}</p>
                  <p className="mt-2.5 text-[12.5px] leading-snug text-textPrimary line-clamp-3">
                    <Reason text={item.reason} />
                  </p>
                  <button
                    type="button"
                    onClick={() => startReading(item)}
                    disabled={starting === book.id}
                    className="mt-auto pt-3 self-start inline-flex items-center gap-2 min-h-10 label text-textPrimary hover:text-ink disabled:opacity-55 group/start"
                  >
                    <span className="w-6 h-6 rounded-full border border-line bg-white flex items-center justify-center transition-colors group-hover/start:border-ink group-hover/start:bg-ink group-hover/start:text-white" aria-hidden="true">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                    </span>
                    {starting === book.id ? "Starting…" : "Start reading"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card px-5 py-4 label text-textSecondary">
          No books under 300 pages on your list right now.
        </p>
      )}
    </section>
  );
}

// Keeps a trailing star rating together so "★★★★★" never splits across lines.
function Reason({ text }) {
  const m = text.match(/^(.*?)\s*(★+)$/);
  if (!m) return text;
  return (
    <>
      {m[1]} <span className="whitespace-nowrap" aria-label={`${m[2].length} stars`}>{m[2]}</span>
    </>
  );
}

function Dice() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}
