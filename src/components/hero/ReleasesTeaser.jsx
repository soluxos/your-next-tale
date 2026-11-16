"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BookCover from "@/components/book/BookCover";
import { releasesSnapshotUrl, releaseKey, releaseRank, listable } from "@/lib/releases/genres";
import { daysUntil, releaseLabel } from "@/lib/releases/dates";
import { generateBookSlug } from "@/lib/slugify";
import { cn } from "@/lib/utils";
import SectionHeading, { SectionLink } from "@/components/hero/SectionHeading";

const SHOW = 6;

/** Home: the most anticipated fantasy and sci-fi coming soon, linking to /releases. */
export default function ReleasesTeaser() {
  const [items, setItems] = useState(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch(releasesSnapshotUrl())
      .then((r) => (r.ok ? r.json() : null))
      .then((snap) => {
        if (cancelled || !snap) return setItems([]);
        const seen = new Set();
        const soon = Object.values(snap.genres || {})
          .flat()
          .filter(listable)
          .filter((x) => daysUntil(x.releaseDate, now) >= 0 && !seen.has(releaseKey(x)) && seen.add(releaseKey(x)))
          .sort((a, b) => releaseRank(b) - releaseRank(a))
          .slice(0, SHOW);
        setItems(soon);
      })
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [now]);

  if (items && !items.length) return null;

  return (
    // Its own band, so what's coming reads apart from your own books above
    // and the catalogue below.
    <section aria-labelledby="releases-teaser" className="mt-16 sm:mt-24 border-y border-line bg-paper-2">
      <div className="page-x mx-auto max-w-[1600px] py-14 sm:py-20">
        <SectionHeading
          id="releases-teaser"
          title="Coming soon"
          description="The fantasy and sci-fi booksellers are most excited about"
          stackUntil="none"
          action={<SectionLink href="/releases">All new releases</SectionLink>}
        />
        <ul className="flex gap-5 sm:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 -mx-4 px-4 pb-2 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {(items || Array.from({ length: SHOW }, () => null)).map((item, i) => (
            <li key={releaseKey(item) ?? i} className="w-[38%] xs:w-[150px] sm:w-[160px] shrink-0 snap-start lg:w-auto">
              {item ? (
                <Link
                  href={`/books/${generateBookSlug(item.title, item.authors?.[0])}`}
                  className="group block focus-ring rounded-[3px]"
                >
                  <BookCover
                    book={{
                      title: item.title,
                      authors: item.authors,
                      cover_url: item.cover_url
                    }}
                    sizes="(max-width: 480px) 38vw, 180px"
                  />
                  {/* Green only for the next fortnight, as on /releases */}
                  <p
                    className={cn(
                      "mt-4 label !text-[11px]",
                      daysUntil(item.releaseDate, now) <= 14 ? "text-shelved" : "text-textSecondary"
                    )}
                  >
                    {releaseLabel(item.releaseDate, now)}
                  </p>
                  <p className="mt-1.5 font-ppMondwest text-[17px] leading-[1.15] text-ink line-clamp-2 group-hover:underline underline-offset-4">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-textSecondary truncate">{item.authors?.[0]}</p>
                </Link>
              ) : (
                <div className="aspect-[2/3] rounded-[3px] bg-paper-2 animate-pulse" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
