"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";
import BookCover from "@/components/book/BookCover";
import AddToShelfButton from "@/components/book/AddToShelfButton";
import { RELEASE_GENRES, pickedFrom, releaseKey, releaseRank, listable } from "@/lib/releases/genres";
import { countdown, daysUntil, releaseGroup, releaseLabel } from "@/lib/releases/dates";
import { authorKey } from "@/lib/books/sameBook";
import { generateBookSlug } from "@/lib/slugify";
import { cn } from "@/lib/utils";

const WHEN = [
  { key: "soon", label: "Coming soon", short: "Upcoming" },
  { key: "out", label: "Just out" }
];
const GENRE_SHORT = { "science-fiction": "Sci-fi" };
const NAV_H = 64; // the fixed top navigation
const fmt = (n) => n.toLocaleString("en-GB");
const asBook = (item) => ({
  id: item.bookId,
  title: item.title,
  authors: item.authors,
  cover_url: item.cover_url,
  page_count: item.page_count
});
const bookHref = (item) => `/books/${generateBookSlug(item.title, item.authors?.[0])}`;
const seriesLine = (s) =>
  s ? (s.position ? `Book ${s.position}${s.count ? ` of ${s.count}` : ""} · ${s.name}` : s.name) : null;

export default function ReleasesPage({ snapshot, blurbs, initialGenre, initialWhen }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const library = useLibrary();
  const [genre, setGenre] = useState(initialGenre);
  const [when, setWhen] = useState(initialWhen);
  const [now] = useState(() => Date.now());
  const { sentinel, stuck } = useStuck();

  // Keep the URL shareable without a server round trip.
  useEffect(() => {
    const params = new URLSearchParams();
    if (genre !== RELEASE_GENRES[0].slug) params.set("genre", genre);
    if (when !== "soon") params.set("when", when);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/releases?${qs}` : "/releases");
  }, [genre, when]);

  // Switching from the pinned bar mid-page: start the new list from its top.
  const pick = (set) => (value) => {
    set(value);
    if (stuck && sentinel.current) {
      window.scrollTo({ top: sentinel.current.getBoundingClientRect().top + window.scrollY - NAV_H });
    }
  };

  const all = useMemo(() => (snapshot?.genres?.[genre] || []).filter(listable), [snapshot, genre]);
  const soon = useMemo(() => all.filter((x) => daysUntil(x.releaseDate, now) >= 0), [all, now]);
  const out = useMemo(
    () => all.filter((x) => daysUntil(x.releaseDate, now) < 0).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || releaseRank(b) - releaseRank(a)),
    [all, now]
  );
  const list = when === "soon" ? soon : out;
  const otherWhen = when === "soon" ? "out" : "soon";
  const other = when === "soon" ? out : soon;

  const anticipated = useMemo(() => [...soon].sort((a, b) => releaseRank(b) - releaseRank(a)).slice(0, 5), [soon]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of list) {
      const g = releaseGroup(item.releaseDate, now);
      if (!map.has(g.key)) map.set(g.key, { ...g, items: [] });
      map.get(g.key).items.push(item);
    }
    const sorted = [...map.values()].sort((a, b) => (when === "soon" ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key)));
    // Biggest books first within a month.
    for (const g of sorted) g.items.sort((a, b) => releaseRank(b) - releaseRank(a));
    return sorted;
  }, [list, now, when]);

  const forYou = useAuthorMatches(user, snapshot, now);
  const shelvedUpcoming = useShelvedUpcoming(user, library, now);

  if (!snapshot) return <NotReady isAdmin={profile?.role === "admin"} onDone={() => router.refresh()} />;

  const genreLabel = RELEASE_GENRES.find((g) => g.slug === genre)?.label || "";

  return (
    <div className="page-x pt-8 sm:pt-12 pb-16">
      <header className="max-w-[720px]">
        <p className="label text-textSecondary">New & upcoming</p>
        <h1 className="mt-2 font-ppMondwest text-ink text-[34px] sm:text-[46px] leading-[1.02]">
          What’s coming to your shelves
        </h1>
        <p className="prose-book !text-[16px] sm:!text-[17px] !text-textPrimary mt-3">
          Fantasy and science fiction out in the next year and the last few months, picked by the booksellers at
          Waterstones and Bookshop.org.
        </p>
      </header>

      {shelvedUpcoming.length > 0 && <Countdown books={shelvedUpcoming} now={now} />}

      {/* Pins under the navigation once scrolled past, so the list can be switched from anywhere */}
      <div ref={sentinel} aria-hidden="true" className="mt-6 h-px" />
      <div
        className={cn(
          "sticky top-16 z-30 -mx-4 sm:-mx-10 px-4 sm:px-10 py-2 border-b transition-[background-color,border-color] duration-200",
          stuck ? "bg-white/90 backdrop-blur-md border-line" : "border-transparent"
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <Segmented
            label="Genre"
            options={RELEASE_GENRES.map((g) => ({ key: g.slug, label: g.label, short: GENRE_SHORT[g.slug] }))}
            value={genre}
            onChange={pick(setGenre)}
          />
          <Segmented label="When" options={WHEN} value={when} onChange={pick(setWhen)} />
          <p className="ml-auto max-md:hidden label text-textSecondary tabular-nums" aria-live="polite">
            {list.length} {list.length === 1 ? "book" : "books"}
          </p>
        </div>
      </div>

      {forYou.length > 0 && <ForYou matches={forYou} now={now} />}

      {when === "soon" && anticipated.length >= 3 && (
        <Anticipated items={anticipated} blurbs={blurbs} now={now} genreLabel={genreLabel} />
      )}

      <section aria-labelledby="calendar" className="mt-14">
        <SectionHeading
          id="calendar"
          title={when === "soon" ? "Release calendar" : "Out in the last few months"}
          note={when === "soon" ? "Every confirmed date, month by month" : "Newest first"}
        />
        {groups.length ? (
          <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 sm:gap-x-5 gap-y-10">
            {groups.map((g) => (
              <Fragment key={g.key}>
                <MonthMarker group={g} now={now} />
                {g.items.map((item) => (
                  <ReleaseCard key={releaseKey(item)} item={item} now={now} />
                ))}
              </Fragment>
            ))}
          </div>
        ) : (
          <p className="card px-5 py-6 prose-book !text-[16px] !text-textSecondary">
            Nothing {when === "soon" ? "announced" : "out"} in {genreLabel.toLowerCase()} right now. Check back soon.
          </p>
        )}
        {/* A short list ends with the way to the other one, rather than just stopping */}
        {list.length < 6 && other.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setWhen(otherWhen);
              // Land on the new list, below the pinned bar.
              const top = document.getElementById("calendar")?.getBoundingClientRect().top;
              if (top != null) window.scrollTo({ top: top + window.scrollY - NAV_H - 72 });
            }}
            className="mt-8 inline-flex items-center gap-2 min-h-10 font-ppMondwest text-[17px] text-ink underline underline-offset-4 decoration-line hover:decoration-ink"
          >
            See the {other.length} {genreLabel.toLowerCase()} {other.length === 1 ? "book" : "books"}{" "}
            {otherWhen === "soon" ? "coming soon" : "out in the last few months"}
            <Chevron dir="right" />
          </button>
        )}
      </section>

      <footer className="mt-16 pt-6 border-t border-line max-w-[760px] text-[12.5px] leading-relaxed text-textSecondary">
        Picked from the new and coming-soon lists at <ExternalLink href="https://www.waterstones.com/campaign/coming-soon">Waterstones</ExternalLink>{" "}
        and <ExternalLink href="https://bookshop.org/lists/most-anticipated-books">Bookshop.org</ExternalLink>, updated{" "}
        {timeAgo(snapshot.generatedAt, now)}. Covers and descriptions from <ExternalLink href="https://isbndb.com">ISBNdb</ExternalLink> and{" "}
        <ExternalLink href="https://openlibrary.org">Open Library</ExternalLink>. Only books with a confirmed date and a finished cover are listed;
        dates can still move.
        {profile?.role === "admin" && (
          <>
            {" "}
            <RefreshButton onDone={() => router.refresh()} />
          </>
        )}
      </footer>
    </div>
  );
}

function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">
      {children}
    </a>
  );
}

/** Whether the element after `sentinel` has scrolled up under the navigation. */
function useStuck() {
  const sentinel = useRef(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < NAV_H), {
      rootMargin: `-${NAV_H}px 0px 0px 0px`
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { sentinel, stuck };
}

function SectionHeading({ id, title, note, aside }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="font-ppMondwest text-[24px] sm:text-[28px] leading-[1.05] text-ink">
          {title}
        </h2>
        {note && <p className="label text-textSecondary mt-1.5">{note}</p>}
      </div>
      {aside}
    </div>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex max-sm:flex-1 p-1 rounded-[10px] bg-paper-3">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "h-9 max-sm:flex-1 px-2 sm:px-3.5 rounded-[7px] label whitespace-nowrap transition-colors",
            value === o.key ? "bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-textPrimary hover:text-ink"
          )}
        >
          {o.short ? (
            <>
              <span className="sm:hidden">{o.short}</span>
              <span className="max-sm:hidden">{o.label}</span>
            </>
          ) : (
            o.label
          )}
        </button>
      ))}
    </div>
  );
}

function DateLine({ item, now, className, as: Tag = "p" }) {
  const days = daysUntil(item.releaseDate, now);
  const soon = days >= 0 && days <= 14;
  return (
    <Tag className={cn("label !text-[11px]", soon ? "text-shelved" : "text-textSecondary", className)}>
      {releaseLabel(item.releaseDate, now)}
    </Tag>
  );
}

/**
 * Opens each month in the calendar. On phones it's a heading across the row;
 * from md up it takes a cover-sized cell, so a month with one or two books
 * shares its row with the next month instead of leaving it mostly empty.
 */
function MonthMarker({ group, now }) {
  const [y, m] = group.key.split("-");
  const tbc = m === "99";
  const month = tbc ? y : new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long" });
  const today = new Date(now);
  const offset = tbc ? null : (Number(y) - today.getFullYear()) * 12 + (Number(m) - 1 - today.getMonth());
  const relative = { [-1]: "Last month", 0: "This month", 1: "Next month" }[offset];
  const n = group.items.length;
  return (
    // On phones the heading sits closer to its own books than the grid gap allows.
    <div className="col-span-full -mb-4 md:mb-0 md:col-span-1 flex items-baseline gap-3 border-b border-line pb-2 md:block md:border-0 md:pb-0">
      <div className="contents md:flex md:flex-col md:aspect-[2/3] md:rounded-[4px] md:border md:border-line md:bg-white md:p-4 lg:p-5">
        <p className={cn("max-md:hidden label", offset === 0 ? "text-shelved" : "text-textSecondary")}>
          {tbc ? "Date to be confirmed" : relative || y}
        </p>
        <h2 className="font-ppMondwest text-[26px] sm:text-[30px] md:text-[34px] lg:text-[clamp(30px,2.4vw,40px)] leading-none text-ink md:mt-auto">
          {month}
          {!tbc && <span className="md:sr-only"> {y}</span>}
        </h2>
        <p className="label text-textSecondary md:mt-2.5">
          {(tbc || relative) && <span className="md:hidden">{tbc ? "Date TBC" : relative} · </span>}
          {n} {n === 1 ? "book" : "books"}
        </p>
      </div>
    </div>
  );
}

function ReleaseCard({ item, now, reason }) {
  const href = bookHref(item);
  const upcoming = daysUntil(item.releaseDate, now) >= 0;
  const meta = reason || seriesLine(item.series);
  const readers = item.picks ? item.readers || 0 : 0;
  return (
    <article className="flex flex-col h-full">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="block rounded-[3px]">
        <BookCover book={asBook(item)} sizes="(max-width: 480px) 44vw, 200px" />
      </Link>
      <div className="mt-3 flex-1 flex flex-col">
        <DateLine item={item} now={now} />
        <h3 className="mt-1">
          <Link href={href} className="font-ppMondwest text-[16.5px] leading-[1.15] text-ink line-clamp-2 hover:underline underline-offset-4 focus-ring rounded-[2px]">
            {item.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-[13px] text-textPrimary truncate">{item.authors?.join(", ")}</p>
        {meta && <p className="mt-1.5 text-[12.5px] leading-snug text-textSecondary line-clamp-2">{meta}</p>}
        {readers > 0 && (
          <p className="mt-1 text-[12.5px] text-textSecondary tabular-nums">
            {fmt(readers)} {upcoming ? "waiting" : "reading"} here
          </p>
        )}
        <div className="mt-auto pt-3">
          <AddToShelfButton book={asBook(item)} size="sm" tone="quiet" className="w-full" />
        </div>
      </div>
    </article>
  );
}

/** Releases by authors the reader already has, in a row that scrolls sideways. */
function ForYou({ matches, now }) {
  const rail = useRail();
  return (
    <section aria-labelledby="for-you" className="mt-10">
      <SectionHeading
        id="for-you"
        title="From authors on your shelves"
        note="New and upcoming books by writers you already read"
        aside={rail.controls}
      />
      <ul ref={rail.ref} className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 sm:scroll-px-10 -mx-4 sm:-mx-10 px-4 sm:px-10 pb-2">
        {matches.map(({ item, reason }) => (
          <li key={releaseKey(item)} className="w-[44%] xs:w-[168px] sm:w-[180px] shrink-0 snap-start">
            <ReleaseCard item={item} now={now} reason={reason} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Previous / next buttons for a sideways-scrolling list; hidden when it all fits. */
function useRail() {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
  const go = (dir) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };
  const controls =
    edges.start && edges.end ? null : (
      <div className="max-sm:hidden flex gap-1.5 shrink-0">
        <button type="button" onClick={() => go(-1)} disabled={edges.start} className="btn btn-secondary btn-sm btn-icon" aria-label="Scroll back">
          <Chevron dir="left" />
        </button>
        <button type="button" onClick={() => go(1)} disabled={edges.end} className="btn btn-secondary btn-sm btn-icon" aria-label="Scroll forward">
          <Chevron dir="right" />
        </button>
      </div>
    );
  return { ref, controls };
}

function Chevron({ dir }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/** The top five: the leader with its blurb, the rest as a ranked list beside it. */
function Anticipated({ items, blurbs, now, genreLabel }) {
  const [first, ...rest] = items;
  return (
    <section aria-labelledby="anticipated" className="mt-14">
      <SectionHeading
        id="anticipated"
        title={`Most anticipated ${genreLabel.toLowerCase()}`}
        note="Ranked by how prominently Waterstones and Bookshop.org are featuring them"
      />
      <div className="grid gap-4 lg:gap-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] items-start">
        <FeaturedRelease item={first} blurb={blurbLead(blurbs?.[first.bookId])} now={now} />
        <ol start={2} className="card divide-y divide-line">
          {rest.map((item, i) => (
            <AnticipatedRow key={releaseKey(item)} item={item} rank={i + 2} now={now} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function FeaturedRelease({ item, blurb, now }) {
  const href = bookHref(item);
  const from = pickedFrom(item.picks);
  return (
    <article className="card p-4 sm:p-6 grid grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[168px_minmax(0,1fr)] gap-x-4 sm:gap-x-6 gap-y-4">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="self-start sm:row-span-2 rounded-[3px]">
        <BookCover book={asBook(item)} sizes="(max-width: 640px) 104px, 168px" eager />
      </Link>
      <div className="min-w-0 self-center sm:self-start">
        <p className="label text-textSecondary">
          <span className="text-ink">No. 1</span>
          <span aria-hidden="true"> · </span>
          <DateLine item={item} now={now} as="span" />
        </p>
        <h3 className="mt-2">
          <Link href={href} className="font-ppMondwest text-[24px] sm:text-[32px] leading-[1.02] text-ink hover:underline underline-offset-4 focus-ring rounded-[2px]">
            {item.title}
          </Link>
        </h3>
        <p className="mt-1.5 text-[14px] text-textPrimary">
          {item.authors?.join(", ")}
          {item.series && <span className="text-textSecondary"> · {seriesLine(item.series)}</span>}
        </p>
      </div>
      <div className="col-span-2 sm:col-span-1 sm:col-start-2 min-w-0">
        {blurb && <p className="prose-book !text-[15.5px] !leading-[1.55] !text-textPrimary line-clamp-4">{blurb}</p>}
        {from && <p className="mt-3 text-[12.5px] leading-snug text-textSecondary">{from}</p>}
        <div className="mt-4">
          <AddToShelfButton book={asBook(item)} className="w-full xs:w-auto xs:min-w-[200px]" />
        </div>
      </div>
    </article>
  );
}

function AnticipatedRow({ item, rank, now }) {
  const href = bookHref(item);
  return (
    <li className="grid grid-cols-[20px_48px_minmax(0,1fr)] sm:grid-cols-[20px_48px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-4 sm:px-5 py-3.5">
      <span className="row-span-2 sm:row-span-1 font-ppMondwest text-[24px] leading-none text-textSecondary text-center tabular-nums" aria-hidden="true">
        {rank}
      </span>
      <Link href={href} tabIndex={-1} aria-hidden="true" className="row-span-2 sm:row-span-1 rounded-[3px]">
        <BookCover book={asBook(item)} sizes="48px" />
      </Link>
      <div className="min-w-0">
        <h3>
          <Link href={href} className="font-ppMondwest text-[17px] leading-tight text-ink line-clamp-2 hover:underline underline-offset-4 focus-ring rounded-[2px]">
            {item.title}
          </Link>
        </h3>
        <p className="text-[13px] text-textPrimary truncate">{item.authors?.[0]}</p>
        <DateLine item={item} now={now} className="mt-1" />
      </div>
      <div className="col-start-3 sm:col-start-4 sm:row-start-1">
        <AddToShelfButton book={asBook(item)} size="sm" tone="quiet" className="sm:w-[168px]" />
      </div>
    </li>
  );
}

/**
 * The opening of a publisher's blurb, minus the sales lines in front of it
 * ("THE INSTANT SUNDAY TIMES BESTSELLER", "The sequel to…").
 */
function blurbLead(text) {
  if (!text) return null;
  // Line breaks lost in cleaning leave "Abyss!Death"; put the space back.
  const fixed = text.replace(/([a-z][.!?])([A-Z])/g, "$1 $2");
  const sentences = fixed.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) || [fixed];
  const puff = (s) =>
    /bestsell|from the author of|award-winning|sunday times|new york times|#1\b|sequel to|book in the|series by/i.test(s) ||
    (s.replace(/[^A-Za-z]/g, "").length > 12 && s === s.toUpperCase());
  let i = 0;
  while (i < sentences.length - 1 && puff(sentences[i])) i++;
  return sentences.slice(i).join("").trim() || null;
}

/** Books on the reader's own shelves that aren't out yet, soonest first. */
function useShelvedUpcoming(user, library, now) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState([]);
  const [version, setVersion] = useState(0);

  // Shelving a release on this page should put it straight into the countdown.
  useEffect(() => library.subscribe(() => setVersion((v) => v + 1)), [library.subscribe]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const today = new Date(now).toISOString().slice(0, 10);
    supabase
      .from("user_books")
      .select("books!inner (id, title, authors, cover_url, published_date)")
      .eq("user_id", user.id)
      .gt("books.published_date", today)
      .limit(200)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const seen = new Set();
        const list = [];
        for (const { books: b } of data) {
          if (!b || seen.has(b.id) || !/^\d{4}-\d{2}-\d{2}$/.test(b.published_date || "")) continue;
          seen.add(b.id);
          list.push(b);
        }
        setItems(list.sort((a, b) => a.published_date.localeCompare(b.published_date)));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, user, now, version]);

  return items;
}

const COUNTDOWN_SHOWN = 6;

function Countdown({ books, now }) {
  const [all, setAll] = useState(false);
  const shown = all ? books : books.slice(0, COUNTDOWN_SHOWN);
  return (
    <section aria-labelledby="countdown" className="mt-8">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 id="countdown" className="label text-ink">
          Your countdown
          <span className="text-textSecondary"> · {books.length} on your shelves not out yet</span>
        </h2>
        {books.length > COUNTDOWN_SHOWN && (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="shrink-0 min-h-10 label text-textSecondary hover:text-ink hover:underline underline-offset-4"
            aria-expanded={all}
          >
            {all ? "Show fewer" : `Show all ${books.length}`}
          </button>
        )}
      </div>
      <ul className="grid gap-px rounded-[12px] overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((b) => {
          const c = countdown(b.published_date, now);
          const href = `/books/${generateBookSlug(b.title, b.authors?.[0])}`;
          return (
            <li key={b.id} className="bg-white">
              <Link href={href} className="group flex items-center gap-3.5 px-4 py-3 h-full hover:bg-paper focus-ring">
                <span className="shrink-0 w-[40px]">
                  <BookCover book={b} sizes="40px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-ppMondwest text-[16px] leading-tight text-ink line-clamp-1 group-hover:underline underline-offset-4">
                    {b.title}
                  </span>
                  <span className="block text-[12.5px] text-textSecondary truncate">
                    {b.authors?.[0]} · {releaseLabel(b.published_date, now).replace(/^Out /, "")}
                  </span>
                </span>
                <span className="shrink-0 text-right" aria-label={c.tbc ? `${c.n}, date to be confirmed` : `in ${c.n} ${c.unit}`}>
                  <span className={cn("block font-ppMondwest leading-none tabular-nums", c.tbc ? "text-[18px] text-textSecondary" : "text-[24px] text-ink")}>
                    {c.n}
                  </span>
                  <span className="block label !text-[10px] text-textSecondary mt-0.5">{c.unit}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Releases by authors already in the reader's library, best matches first. */
function useAuthorMatches(user, snapshot, now) {
  const supabase = useMemo(() => createClient(), []);
  const [authors, setAuthors] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const counts = new Map();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("user_books")
          .select("books (authors)")
          .eq("user_id", user.id)
          .range(from, from + 999);
        if (error || !data) break;
        for (const row of data) {
          for (const a of row.books?.authors || []) {
            const k = authorKey(a);
            if (k) counts.set(k, { name: a, n: (counts.get(k)?.n || 0) + 1 });
          }
        }
        if (data.length < 1000) break;
      }
      if (!cancelled) setAuthors(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  return useMemo(() => {
    if (!authors || !snapshot) return [];
    const seen = new Set();
    const out = [];
    for (const item of Object.values(snapshot.genres).flat().filter(listable)) {
      if (seen.has(releaseKey(item)) || daysUntil(item.releaseDate, now) < -60) continue;
      const author = (item.authors || []).find((a) => authors.has(authorKey(a)));
      if (!author) continue;
      const match = authors.get(authorKey(author));
      seen.add(releaseKey(item));
      const s = item.series;
      const surname = author.trim().split(/\s+/).pop();
      const owned = `${match.n} of ${surname}’s ${match.n === 1 ? "book" : "books"} on your shelves`;
      const reason = s?.position > 1 ? `Next in ${s.name} · ${owned}` : owned;
      out.push({ item, reason, weight: match.n * 10 + releaseRank(item) / 100 });
    }
    return out.sort((a, b) => b.weight - a.weight).slice(0, 12);
  }, [authors, snapshot, now]);
}

function timeAgo(iso, now) {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function RefreshButton({ onDone, className, label = "Refresh now" }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/releases", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Refresh failed");
      toast.success("Releases refreshed", { description: `${json.added} new books added to the catalogue` });
      onDone?.();
    } catch (e) {
      toast.error("Couldn’t refresh releases", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={run} disabled={busy} className={cn("underline underline-offset-4 hover:text-ink disabled:opacity-60", className)}>
      {busy ? "Refreshing… (a few minutes)" : label}
    </button>
  );
}

function NotReady({ isAdmin, onDone }) {
  return (
    <div className="page-x pt-12 pb-24">
      <div className="card px-6 py-8 max-w-[560px]">
        <h1 className="font-ppMondwest text-[30px] text-ink leading-tight">New releases are on their way</h1>
        <p className="prose-book !text-[16px] !text-textPrimary mt-2">
          We haven’t gathered this season’s fantasy and science fiction releases yet. Check back shortly.
        </p>
        {isAdmin && <RefreshButton onDone={onDone} label="Fetch releases now" className="btn btn-primary mt-5 no-underline" />}
      </div>
    </div>
  );
}
