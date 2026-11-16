"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import StarRating from "@/components/ui/StarRating";
import AddToShelfButton from "@/components/book/AddToShelfButton";
import StatusIcon, { STATUS } from "@/components/book/StatusIcon";

const CHIP = {
  "currently-reading": "bg-shelved-bg border-shelved-line text-[#1b4a2b]",
  read: "bg-paper-2 border-line text-ink",
  "want-to-read": "bg-white border-line text-textSecondary",
  "did-not-finish": "bg-white border-line text-textSecondary"
};

/** The reading status (exclusive shelf) a user_books row sits on. */
function statusOf(row) {
  return (row.bookshelf_books || [])
    .map((l) => l.bookshelves)
    .find((s) => s?.is_exclusive)?.slug;
}

/**
 * Who has this book on their shelves — the social proof on a book page.
 * Fetched in the browser so it stays fresh on a statically cached page.
 * Private profiles are left out (except your own copy, which only you see),
 * and it refreshes when you shelve, move or rate the book here.
 */
export default function BookReaders({ book, onSummary }) {
  const bookId = book.id;
  const { user, loading: authLoading } = useAuth();
  const library = useLibrary();
  const me = user?.id || null;
  const [readers, setReaders] = useState(null);
  const [totals, setTotals] = useState(null); // { count, average } across ALL readers
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      library.subscribe((ev) => {
        const id = ev.book?.id || ev.bookId;
        if (id !== bookId) return;
        if (ev.type === "updated") {
          // Reviews autosave as you type — patch those; a new rating also
          // changes the average, so refetch for that.
          setReaders((list) =>
            list?.map((r) => (r.id === ev.userBookId ? { ...r, ...pick(ev.fields) } : r))
          );
          if ("rating" in ev.fields) setVersion((v) => v + 1);
        } else {
          setVersion((v) => v + 1);
        }
      }),
    [library.subscribe, bookId]
  );

  useEffect(() => {
    // Wait for auth so "You" can be placed first without fetching twice
    if (authLoading) return;
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const [{ data: rows }, { count }, { data: ratedRows }] = await Promise.all([
        supabase
          .from("user_books")
          .select("id, user_id, rating, review, updated_at, bookshelf_books (bookshelves (slug, is_exclusive))")
          .eq("book_id", bookId)
          .order("updated_at", { ascending: false })
          .limit(50),
        supabase
          .from("user_books")
          .select("id", { count: "exact", head: true })
          .eq("book_id", bookId),
        supabase
          .from("user_books")
          .select("rating")
          .eq("book_id", bookId)
          .not("rating", "is", null)
      ]);
      const ratings = (ratedRows || []).map((r) => r.rating).filter((n) => n > 0);
      if (!cancelled) {
        setTotals({
          count: count ?? null,
          average: ratings.length
            ? ratings.reduce((s, n) => s + n, 0) / ratings.length
            : null
        });
      }
      const ids = [...new Set((rows || []).map((r) => r.user_id))];
      if (!ids.length) {
        if (!cancelled) setReaders([]);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, facehash_color, is_private")
        .in("id", ids);
      const byId = new Map(
        (profiles || []).filter((p) => !p.is_private || p.id === me).map((p) => [p.id, p])
      );
      const list = (rows || [])
        .filter((r) => byId.has(r.user_id))
        .map((r) => ({ ...r, status: statusOf(r), profile: byId.get(r.user_id) }));
      // You first, then everyone else by most recent activity
      list.sort((a, b) => (b.user_id === me) - (a.user_id === me));
      if (!cancelled) setReaders(list);
    })().catch(() => !cancelled && setReaders((r) => r || []));
    return () => {
      cancelled = true;
    };
  }, [bookId, me, authLoading, version]);

  useEffect(() => {
    if (!readers) return;
    const rated = readers.filter((r) => r.rating);
    onSummary?.({
      count: totals?.count ?? readers.length,
      average: totals
        ? totals.average
        : rated.length
          ? rated.reduce((s, r) => s + r.rating, 0) / rated.length
          : null
    });
  }, [readers, totals, onSummary]);

  if (readers === null) {
    return (
      <ul className="divide-y divide-line border-y border-line" aria-hidden="true">
        {[0, 1].map((i) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <div className="w-9 h-9 rounded-full bg-paper-3 animate-pulse shrink-0" />
            <div className="flex-1 flex flex-col gap-2 pt-1">
              <div className="h-3.5 w-40 max-w-full rounded-[3px] bg-paper-3 animate-pulse" />
              <div className="h-3 w-24 rounded-[3px] bg-paper-3 animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (!readers.length) {
    const onlyPrivate = totals?.count > 0;
    return (
      <div className="rounded-[12px] border border-dashed border-[#cfcfcf] bg-paper-2 px-4 sm:px-5 py-5 flex flex-col xs:flex-row xs:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-ppMondwest text-[18px] leading-tight text-ink">
            {onlyPrivate ? "Only on private shelves so far" : "No one’s shelved this yet"}
          </p>
          <p className="mt-1 font-ppMondwest text-[15px] leading-snug text-textSecondary">
            Add it to yours and you’ll be the first reader here.
          </p>
        </div>
        <AddToShelfButton book={book} size="sm" className="xs:shrink-0" />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line border-y border-line">
      {readers.map((r) => {
        const isMe = r.user_id === me;
        const name = r.profile.full_name || r.profile.username;
        const href = r.review || r.rating
          ? `/u/${encodeURIComponent(r.profile.username)}/all/review/${bookId}`
          : `/u/${encodeURIComponent(r.profile.username)}`;
        return (
          <li key={r.id}>
            <Link
              href={href}
              className="flex items-start gap-3 py-3 px-2 -mx-2 rounded-[8px] hover:bg-paper-2 transition-colors focus-ring"
            >
              <FacehashAvatar name={name} color={r.profile.facehash_color} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  <span className="font-ppMondwest text-[16px] text-ink">{name}</span>
                  {isMe && (
                    <span className="inline-flex items-center h-[18px] px-1.5 rounded-[4px] bg-ink text-white label !text-[10px]">
                      You
                    </span>
                  )}
                  <span className="label text-textSecondary">@{r.profile.username}</span>
                </div>
                {(r.status || r.rating) && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {r.status && STATUS[r.status] && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 h-[22px] px-2 rounded-full border label !text-[10px]",
                          CHIP[r.status]
                        )}
                      >
                        <StatusIcon slug={r.status} size={11} />
                        {STATUS[r.status].short}
                      </span>
                    )}
                    {r.rating ? <StarRating rating={r.rating} size={12} /> : null}
                  </div>
                )}
                {r.review && (
                  <p className="mt-1.5 font-ppMondwest text-[15px] leading-snug text-textPrimary line-clamp-2">
                    “{r.review}”
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function pick(fields) {
  const out = {};
  if ("rating" in fields) out.rating = fields.rating;
  if ("review" in fields) out.review = fields.review;
  return out;
}
