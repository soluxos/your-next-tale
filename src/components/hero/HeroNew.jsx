"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";
import UpNext from "@/components/hero/UpNext";
import ReadingGoal from "@/components/hero/ReadingGoal";
import ReadingNow, { EmptySlot, useCurrentlyReading } from "@/components/hero/ReadingNow";
import BookReviewModal from "@/components/shelves/BookReviewModal";
import { readingProgress } from "@/components/shelves/CoverProgress";

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 300, damping: 28, delay }
});

/**
 * Home's opening. Visitors get the pitch and one clear first step; signed-in
 * readers get straight back to what they're reading.
 */
export default function HeroNew() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="h-[260px] sm:h-[320px]" aria-hidden="true" />;
  return user ? <WelcomeBack profile={profile} /> : <Pitch />;
}

function Pitch() {
  return (
    <section className="HeroNew relative">
      <div className="page-x mx-auto max-w-5xl pt-16 sm:pt-24 pb-12 sm:pb-16 flex flex-col items-center text-center gap-5">
        <motion.div {...rise(0)}>
          <PixelBook />
        </motion.div>
        <motion.p {...rise(0.04)} className="label text-textSecondary">
          A home for every book you read
        </motion.p>
        <motion.h1
          {...rise(0.08)}
          className="font-ppMondwest text-ink text-[40px] sm:text-[60px] leading-[1.02] max-w-[780px]"
        >
          Your whole reading life, on one beautiful bookcase
        </motion.h1>
        <motion.p
          {...rise(0.12)}
          className="prose-book !text-[17px] sm:!text-[19px] !text-textSecondary max-w-[560px]"
        >
          Shelve what you’ve read, what you’re reading and what’s next. Track
          your progress, rate and review, and browse friends’ shelves — without
          the clutter.
        </motion.p>
        <motion.div {...rise(0.16)} className="flex flex-col xs:flex-row gap-3 mt-2 w-full xs:w-auto">
          <Link href="/get-started" className="btn btn-primary btn-lg">
            Start your bookcase
            <ArrowRight />
          </Link>
          <Link href="/discover" className="btn btn-secondary btn-lg">
            Browse books
          </Link>
        </motion.div>
        <motion.ul
          {...rise(0.2)}
          className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 label text-textSecondary"
        >
          {["Free to use", "Read · Reading · Want to read · DNF", "Progress, ratings & reviews"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Tick /> {t}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late reading?";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n) => WORDS[n] ?? String(n);

// The book the hero talks about: the first you've logged progress on, in
// your shelf order, else simply the first.
function pickFeatured(items) {
  return items.find((r) => readingProgress(r.user_books, r.user_books.books.page_count)) ?? items[0];
}

// One sentence on where your reading stands, naming the featured book.
function ReadingLine({ featured, reading, want, total }) {
  if (!total) return "Your bookcase is empty. Add a book you loved and it starts here.";
  if (!featured) {
    return want
      ? `Nothing on the go right now, and ${want} ${want === 1 ? "book is" : "books are"} waiting on your list.`
      : "Nothing on the go right now. Your next read is somewhere below.";
  }
  const ub = featured.user_books;
  const book = ub.books;
  const p = readingProgress(ub, book.page_count);
  const where = p?.pct ? `You’re ${p.pct}% through` : ub.progress_pages ? `You’re on page ${ub.progress_pages} of` : "You’re reading";
  const more = reading - 1;
  return (
    <>
      {where} <span className="text-ink">{book.title}</span>
      {book.authors?.[0] && ` by ${book.authors[0]}`}
      {more > 0 ? `, and ${word(more)} more ${more === 1 ? "is" : "are"} on the go.` : "."}
    </>
  );
}

function WelcomeBack({ profile }) {
  const library = useLibrary();
  const first = (profile?.full_name || profile?.username || "").split(" ")[0];
  const username = profile?.username;
  const { shelf, items, count } = useCurrentlyReading();
  const [open, setOpen] = useState(null);

  const want = (() => {
    const s = library.statusShelves.find((x) => x.slug === "want-to-read");
    if (!s) return 0;
    let n = 0;
    for (const e of library.entries.values()) if (e.shelfIds.includes(s.id)) n++;
    return n;
  })();
  const ready = items !== null;
  const total = library.entries.size;
  const featured = ready && items.length ? pickFeatured(items) : null;
  const shelfHref = username && shelf ? `/u/${encodeURIComponent(username)}/${shelf.slug}` : null;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  let action = null;
  if (ready && !total) {
    action = (
      <button type="button" onClick={() => library.openAddBook()} className="btn btn-primary btn-lg">
        <Plus /> Add your first book
      </button>
    );
  } else if (featured) {
    action = (
      <button type="button" onClick={() => setOpen(featured.user_books)} className="btn btn-primary btn-lg">
        Update progress
      </button>
    );
  } else if (ready) {
    action = want ? (
      <a href="#up-next" className="btn btn-primary btn-lg">
        Choose your next read <ArrowDown />
      </a>
    ) : (
      <button type="button" onClick={() => library.openAddBook()} className="btn btn-primary btn-lg">
        <Plus /> Add books
      </button>
    );
  }

  const empty = !total ? (
    <EmptySlot onClick={() => library.openAddBook()}>Add a book</EmptySlot>
  ) : want ? (
    <EmptySlot href="#up-next">Start a book</EmptySlot>
  ) : (
    <EmptySlot onClick={() => library.openAddBook()}>Add books</EmptySlot>
  );

  return (
    <section className="HeroNew page-x mx-auto max-w-[1600px] pt-10 sm:pt-16 lg:pt-20">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-16 xl:gap-x-24 lg:items-start">
        <motion.div {...rise(0)} className="min-w-0 lg:col-start-1 lg:row-start-1">
          <p className="label text-textSecondary min-h-5 flex items-center">
            {greeting()}
            <span aria-hidden="true" className="mx-2 opacity-60">·</span>
            {today}
          </p>
          <h1 className="mt-4 sm:mt-5 font-ppMondwest text-ink text-[42px] sm:text-[58px] min-[1440px]:text-[66px] leading-[0.98] tracking-[-0.01em]">
            Welcome back{first ? `, ${first}` : ""}
          </h1>
          <div className="mt-5 sm:mt-6 max-w-[34ch] font-ppMondwest text-[19px] sm:text-[22px] leading-[1.35] text-textSecondary min-h-[2.7em]">
            {ready ? (
              <p>
                <ReadingLine featured={featured} reading={count} want={want} total={total} />
              </p>
            ) : (
              <span aria-hidden="true" className="block space-y-2.5 pt-1">
                <span className="block h-[18px] w-[92%] rounded bg-paper-2 animate-pulse" />
                <span className="block h-[18px] w-[60%] rounded bg-paper-2 animate-pulse" />
              </span>
            )}
          </div>
          <div className="mt-7 sm:mt-8 min-h-12 flex flex-wrap gap-3">{action}</div>
        </motion.div>

        {/* The covers keep their own width, so the column is as wide as they are. */}
        <motion.div
          {...rise(0.08)}
          className="min-w-0 mt-12 sm:mt-14 lg:mt-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:w-[444px] xl:w-[632px]"
        >
          <ReadingNow items={items} count={count} shelfHref={shelfHref} onOpen={setOpen} empty={empty} />
        </motion.div>

        {(!ready || total > 0) && (
          <motion.div {...rise(0.12)} className="min-w-0 mt-12 lg:col-start-1 lg:row-start-2">
            <ReadingGoal className="pt-6 border-t border-line max-w-[440px]" />
          </motion.div>
        )}
      </div>

      <motion.div {...rise(0.16)} className="mt-24 sm:mt-32">
        <UpNext username={username} />
      </motion.div>

      {open && (
        <BookReviewModal
          book={open.books}
          userBook={open}
          username={username}
          isOwner
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

function ArrowDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" />
    </svg>
  );
}

function Plus() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}

function Tick() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

// The pixel-art open book from the brand mark.
function PixelBook() {
  const r = (x, y, w, h) => <rect key={`${x}-${y}-${w}-${h}`} x={x} y={y} width={w} height={h} />;
  return (
    <svg width="36" height="30" viewBox="0 0 24 20" fill="#565656" aria-hidden="true" shapeRendering="crispEdges">
      {[
        [0, 2, 2, 15], [11, 4, 2, 15], [22, 2, 2, 15], [1, 1, 2, 2], [21, 1, 2, 2],
        [8, 1, 2, 2], [8, 17, 2, 2], [14, 1, 2, 2], [14, 17, 2, 2], [9, 2, 2, 2],
        [10, 17, 1, 3], [11, 3, 1, 2], [12, 3, 1, 2], [12, 19, 1, 1], [11, 19, 1, 1],
        [13, 2, 2, 2], [13, 17, 1, 3], [2, 0, 6, 2], [2, 16, 7, 2], [16, 0, 6, 2],
        [15, 16, 7, 2], [2, 15, 1, 1], [21, 15, 1, 1], [14, 7, 2, 2], [20, 6, 1, 2],
        [16, 5, 4, 2], [8, 7, 2, 2], [3, 6, 1, 2], [4, 5, 4, 2], [17, 9, 2, 2], [5, 9, 2, 2]
      ].map((a) => r(...a))}
    </svg>
  );
}
