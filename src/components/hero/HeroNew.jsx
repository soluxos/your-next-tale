"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";
import UpNext from "@/components/hero/UpNext";
import ReadingGoal from "@/components/hero/ReadingGoal";
import { useCurrentlyReading } from "@/components/hero/ReadingNow";
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
      <div className="page-x mx-auto max-w-5xl pt-20 sm:pt-28 pb-16 sm:pb-24 flex flex-col items-center text-center">
        <motion.h1
          {...rise(0)}
          className="font-ppMondwest text-ink text-[40px] sm:text-[60px] leading-[1.02] max-w-[780px]"
        >
          Your whole reading life, on one beautiful bookcase
        </motion.h1>
        <motion.p
          {...rise(0.06)}
          className="mt-6 prose-book !text-[17px] sm:!text-[19px] !text-textSecondary max-w-[540px]"
        >
          Shelve what you’ve read, what you’re reading and what’s next. Track
          your progress, rate and review, and browse friends’ shelves.
        </motion.p>
        <motion.div {...rise(0.12)} className="mt-9 flex flex-col xs:flex-row gap-3 w-full xs:w-auto">
          <Link href="/get-started" className="btn btn-primary btn-lg">
            Start your bookcase
            <ArrowRight />
          </Link>
          <Link href="/discover" className="btn btn-secondary btn-lg">
            Browse books
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// "Good evening, Callum": the time of day, and your name when we have it.
function greeting(first) {
  const h = new Date().getHours();
  if (h < 5) return first ? `Up late, ${first}?` : "Up late reading?";
  const hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return first ? `${hello}, ${first}` : hello;
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n) => WORDS[n] ?? String(n);

// The book the hero talks about: the first you've logged progress on, in
// your shelf order, else simply the first.
function pickFeatured(items) {
  return items.find((r) => readingProgress(r.user_books, r.user_books.books.page_count)) ?? items[0];
}

// A title short enough to sit in a sentence: all of it when it's brief, else
// without its subtitle.
function briefTitle(title) {
  const t = String(title || "");
  if (t.length <= 36) return t;
  const main = t.split(/:\s+|\s+[-–—]\s+/)[0];
  return main.length >= 3 ? main : t;
}

// One short sentence on where your reading stands. The covers beside it show
// the rest, so it names one book and counts the others (a link to the shelf).
function ReadingLine({ featured, reading, want, total, shelfHref }) {
  if (!total) return "Your bookcase is empty. Add a book you loved and it starts here.";
  if (!featured) {
    return want
      ? `Nothing on the go, and ${want} ${want === 1 ? "book is" : "books are"} waiting on your list.`
      : "Nothing on the go right now.";
  }
  const ub = featured.user_books;
  const book = ub.books;
  const p = readingProgress(ub, book.page_count);
  const where = p?.pct ? `You’re ${p.pct}% through` : ub.progress_pages ? `You’re on page ${ub.progress_pages} of` : "You’re reading";
  const more = reading - 1;
  const others = `${word(more)} more`;
  return (
    <>
      {where} <span className="text-ink">{briefTitle(book.title)}</span>
      {more > 0 && (
        <>
          , and{" "}
          {shelfHref ? (
            <Link
              href={shelfHref}
              className="underline decoration-1 underline-offset-[3px] decoration-black/25 hover:decoration-ink hover:text-ink rounded-[3px] focus-ring"
            >
              {others}
            </Link>
          ) : (
            others
          )}
        </>
      )}
      .
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

  return (
    <section className="HeroNew page-x mx-auto max-w-[1600px] pt-12 sm:pt-20 lg:pt-24">
      {/* One line of greeting, one of where you are, one thing to do. */}
        <motion.div {...rise(0)} className="min-w-0">
          <h1 className="font-ppMondwest text-ink text-[38px] sm:text-[50px] xl:text-[60px] leading-[1.02] tracking-[-0.01em]">
            {greeting(first)}
          </h1>
          <div className="mt-4 sm:mt-5 max-w-[46ch] font-ppMondwest text-[19px] sm:text-[21px] leading-[1.4] text-textSecondary min-h-[1.4em]">
            {ready ? (
              <p className="text-balance">
                <ReadingLine featured={featured} reading={count} want={want} total={total} shelfHref={shelfHref} />
              </p>
            ) : (
              <span aria-hidden="true" className="block pt-1.5">
                <span className="block h-[18px] w-[min(100%,24rem)] rounded bg-paper-2 animate-pulse" />
              </span>
            )}
          </div>
          <div className="mt-7 sm:mt-8 min-h-12 flex flex-wrap items-center gap-x-6 gap-y-4">
            {action}
            {(!ready || total > 0) && <ReadingGoal />}
          </div>
        </motion.div>

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
