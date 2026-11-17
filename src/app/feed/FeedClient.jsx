"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import FollowButton from "@/components/profile/FollowButton";
import BookCover from "@/components/book/BookCover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { buildFeed, firstName, formatTimeAgo } from "@/components/feed/feedEntries";

export default function FeedClient({
  initialActivities = [],
  initialHasMore = false,
  pageSize,
  loadMore,
  suggested = [],
  followingCount = 0,
  viewerUsername
}) {
  const [activities, setActivities] = useState(initialActivities);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [offset, setOffset] = useState(initialActivities.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const groups = useMemo(() => buildFeed(activities), [activities]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await loadMore(offset);
      setActivities((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...page.activities.filter((a) => !seen.has(a.id))];
      });
      setOffset((o) => o + pageSize);
      setHasMore(page.hasMore);
    } catch (e) {
      console.error("Couldn't load more activity:", e);
      toast.error("Couldn’t load more activity", { description: "Please try again." });
    } finally {
      setLoadingMore(false);
    }
  };

  if (!groups.length) {
    return <EmptyFeed followingCount={followingCount} suggested={suggested} viewerUsername={viewerUsername} />;
  }

  return (
    <div className="FeedClient grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12 items-start">
      <section aria-label="Activity" className="min-w-0">
        <ol className="flex flex-col gap-4">
          {groups.map((group) => (
            <li key={group.key}>
              <FeedGroup group={group} />
            </li>
          ))}
        </ol>
        <div className="mt-8 flex justify-center">
          {hasMore ? (
            <button type="button" onClick={handleLoadMore} disabled={loadingMore} className="btn btn-secondary">
              {loadingMore ? (
                <>
                  <Spinner /> Loading…
                </>
              ) : (
                "Load more"
              )}
            </button>
          ) : (
            activities.length > pageSize / 2 && <p className="label text-textSecondary">You’re all caught up</p>
          )}
        </div>
      </section>

      {suggested.length > 0 && (
        <aside aria-labelledby="suggested-heading" className="lg:sticky lg:top-24">
          <h2 id="suggested-heading" className="label text-textSecondary mb-3">
            Readers to follow
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {suggested.map((reader) => (
              <li key={reader.id}>
                <SuggestedReader reader={reader} />
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}

function EmptyFeed({ followingCount, suggested, viewerUsername }) {
  const following = followingCount > 0;
  const hasSuggestions = suggested.length > 0;

  return (
    <section aria-labelledby="empty-feed-heading" className="card px-5 py-8 sm:px-10 sm:py-10">
      <div className="text-center flex flex-col items-center gap-3 max-w-lg mx-auto">
        <svg width="56" height="40" viewBox="0 0 56 40" fill="none" aria-hidden="true" className="mb-1">
          <rect x="0.5" y="0.5" width="55" height="39" rx="2" fill="#f7f7f7" stroke="#ddd" />
          <rect x="8" y="12" width="6" height="22" rx="1" fill="#d9d6e8" />
          <rect x="16" y="8" width="7" height="26" rx="1" fill="#c9c5dc" />
          <rect x="25" y="14" width="5" height="20" rx="1" fill="#e2e0ec" />
          <path d="M4 34h48" stroke="#ddd" />
        </svg>
        <h2 id="empty-feed-heading" className="font-ppMondwest text-ink text-[26px] leading-tight">
          {following ? "It’s quiet on the shelves" : "Follow readers to fill your feed"}
        </h2>
        <p className="font-ppMondwest text-[17px] leading-snug text-textSecondary">
          {following
            ? "When the people you follow start, finish, rate or review a book, it’ll show up here. Follow a few more readers to liven it up."
            : "See what other readers are starting, finishing and reviewing. Follow someone below to get started."}
        </p>
      </div>

      {hasSuggestions && (
        <div className="mt-8">
          <h3 className="label text-textSecondary mb-3 text-center">Readers to follow</h3>
          {/* Wrapping flex rather than a grid so a short last row stays centred */}
          <ul className="flex flex-wrap justify-center gap-3">
            {suggested.map((reader) => (
              <li key={reader.id} className="w-full sm:w-[calc(50%-6px)] lg:w-[calc((100%-24px)/3)]">
                <SuggestedReader reader={reader} coversClassName="hidden xs:flex" className="h-full bg-paper-2 border-transparent" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cn("flex flex-wrap justify-center gap-2", hasSuggestions ? "mt-8 pt-6 border-t border-line" : "mt-6")}>
        {!hasSuggestions && (
          <Link href="/discover" className="btn btn-primary">
            Browse books
          </Link>
        )}
        {viewerUsername && <ShareBookcaseButton username={viewerUsername} />}
      </div>
    </section>
  );
}

/** Copies the viewer's bookcase link so they can invite friends who already read. */
function ShareBookcaseButton({ username }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/u/${encodeURIComponent(username)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied", { description: url });
    } catch {
      toast("Your bookcase link", { description: url });
    }
  };

  return (
    <button type="button" onClick={share} className="btn btn-secondary">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      {copied ? "Link copied" : "Share your bookcase"}
    </button>
  );
}

function SuggestedReader({ reader, className, coversClassName = "hidden xs:flex lg:hidden xl:flex" }) {
  const name = reader.full_name || reader.username;
  return (
    <div className={cn("card p-3 flex items-center gap-3", className)}>
      <Link href={`/u/${encodeURIComponent(reader.username)}`} className="group flex items-center gap-3 min-w-0 flex-1 focus-ring rounded-[8px]">
        <FacehashAvatar name={name} color={reader.facehash_color} size={40} />
        <div className="min-w-0">
          <p className="font-ppMondwest text-[17px] leading-tight text-ink truncate group-hover:underline underline-offset-4">{name}</p>
          <p className="label text-textSecondary truncate mt-0.5">
            {reader.bookCount} {reader.bookCount === 1 ? "book" : "books"}
          </p>
        </div>
      </Link>
      {reader.covers.length > 0 && (
        <div className={cn("-space-x-3 shrink-0", coversClassName)} aria-hidden="true">
          {reader.covers.map((b) => (
            <div key={b.id} className="w-7">
              <BookCover book={b} flat />
            </div>
          ))}
        </div>
      )}
      {/* 40px tall on phones so it's an easy tap */}
      <FollowButton targetUserId={reader.id} initialStatus="none" className="sm:btn-sm !min-w-0 shrink-0" />
    </div>
  );
}

function FeedGroup({ group }) {
  const { user, entries } = group;
  const name = user?.full_name || user?.username;
  const profileHref = user?.username ? `/u/${encodeURIComponent(user.username)}` : null;

  // Smaller on phones so the sentence keeps most of the width
  const avatar = (
    <>
      <span className="block sm:hidden">
        <FacehashAvatar name={name} color={user?.facehash_color} size={32} />
      </span>
      <span className="hidden sm:block">
        <FacehashAvatar name={name} color={user?.facehash_color} size={40} />
      </span>
    </>
  );

  return (
    <article className="card p-2 sm:p-3 flex gap-0.5 sm:gap-2">
      {profileHref ? (
        <Link href={profileHref} aria-label={`${name}’s bookcase`} className="shrink-0 self-start p-1.5 sm:p-2 rounded-full focus-ring">
          {avatar}
        </Link>
      ) : (
        <div className="shrink-0 p-1.5 sm:p-2">{avatar}</div>
      )}
      <ol className="flex-1 min-w-0 flex flex-col">
        {entries.map((entry) => (
          <li key={entry.key}>
            <FeedEntry entry={entry} user={user} profileHref={profileHref} />
          </li>
        ))}
      </ol>
    </article>
  );
}

/**
 * One sentence about one book: "Dawn finished Dune and rated it". The whole
 * row is a link (stretched from the title), with the reader's name a separate
 * link layered above it.
 */
function FeedEntry({ entry, user, profileHref }) {
  const { book, href } = entry;
  const subject = profileHref ? (
    <Link href={profileHref} className="relative z-10 text-ink hover:underline underline-offset-4">
      {firstName(user)}
    </Link>
  ) : (
    <span className="text-ink">{firstName(user)}</span>
  );

  const objectText = book?.title || entry.shelfName;
  const object = objectText && (
    href ? (
      <Link
        href={href}
        aria-label={`${objectText} — ${entry.linkLabel.toLowerCase()}`}
        className="text-ink underline-offset-4 decoration-1 group-hover:underline outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-2 focus-visible:after:ring-ink"
      >
        {objectText}
      </Link>
    ) : (
      <span className="text-ink">{objectText}</span>
    )
  );

  return (
    <div className={cn("group relative flex gap-3 sm:gap-4 rounded-[10px] p-2 sm:p-3", href && "hover:bg-paper-2 transition-colors")}>
      <div className="flex-1 min-w-0">
        <p className="font-ppMondwest text-[17px] leading-snug text-textSecondary">
          {subject} {entry.verb} {object}
          {entry.target && <> to <span className="text-ink">{entry.target}</span></>}
          {entry.extras && <> and {entry.extras}</>}
        </p>
        {book?.author && (
          <p className="font-ppMondwest text-[15px] leading-snug text-textSecondary truncate">by {book.author}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <time dateTime={entry.createdAt} suppressHydrationWarning className="label text-textSecondary">
            {formatTimeAgo(entry.createdAt)}
          </time>
          {entry.rating > 0 && <InkStars rating={entry.rating} />}
        </div>
        {entry.review && (
          <blockquote className="mt-2.5 border-l-2 border-line pl-3 font-ppMondwest text-[15px] leading-snug text-textPrimary">
            <p className="line-clamp-3">
              &ldquo;{entry.review}
              {entry.reviewTruncated && "…"}&rdquo;
            </p>
          </blockquote>
        )}
      </div>
      {book && (
        <div className="w-14 shrink-0 self-start transition-transform group-hover:-translate-y-0.5" aria-hidden="true">
          <BookCover book={book} flat sizes="56px" />
        </div>
      )}
    </div>
  );
}

function InkStars({ rating }) {
  return (
    <span role="img" aria-label={`Rated ${rating} out of 5`} className="flex items-center gap-[2px] text-ink">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill={i <= rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          className={i <= rating ? undefined : "text-line"}
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}
