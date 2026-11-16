import Link from "next/link";
import UserListItem from "@/components/profile/UserListItem";
import { TABLES } from "@/lib/supabase/types";

/**
 * Each reader's library size, for the list. One head-only count per person,
 * run in parallel; skipped for long lists so the page stays quick. Counts
 * the viewer can't see (private libraries) come back as 0 and aren't shown.
 */
export async function withBookCounts(supabase, people, limit = 60) {
  if (!people.length || people.length > limit) return people;
  const counts = await Promise.all(
    people.map((p) =>
      supabase
        .from(TABLES.USER_BOOKS)
        .select("id", { count: "exact", head: true })
        .eq("user_id", p.id)
        .then(({ count, error }) => (error ? null : count))
    )
  );
  return people.map((p, i) => ({ ...p, book_count: counts[i] }));
}

/**
 * Followers / Following, under the profile header and its tabs (the tabs
 * link back to the bookcase). Headed like a shelf so the two read alike.
 */
export default function FollowList({ title, people, emptyTitle, emptyText, emptyAction }) {
  return (
    <div className="page-x pt-6 pb-24">
      <div className="max-w-2xl">
        <h2 className="font-ppMondwest text-ink text-[26px] sm:text-[30px] leading-none">{title}</h2>
        <p className="label text-textSecondary mt-2">
          {people.length} {people.length === 1 ? "reader" : "readers"}
        </p>

        {people.length === 0 ? (
          <div className="card mt-5 px-6 py-12 flex flex-col items-center text-center">
            <span className="w-12 h-12 rounded-full bg-paper-3 text-ink flex items-center justify-center mb-4" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
                <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.6 3 5.2" />
              </svg>
            </span>
            <p className="font-ppMondwest text-[22px] leading-tight text-ink">{emptyTitle}</p>
            {emptyText && (
              <p className="font-ppMondwest text-[16px] leading-snug text-textPrimary mt-2 max-w-sm">{emptyText}</p>
            )}
            {emptyAction && (
              <Link href={emptyAction.href} className="btn btn-primary mt-5">
                {emptyAction.label}
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {people.map((person) => (
              <li key={person.id}>
                <UserListItem user={person} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Loading state for the lists above (used by the profile's loading.jsx). */
export function FollowListSkeleton() {
  return (
    <div className="page-x pt-6 pb-24" aria-busy="true" aria-label="Loading readers">
      <div className="max-w-2xl">
        <div className="w-40 h-7 rounded-[8px] bg-paper-3 animate-pulse" />
        <div className="w-20 h-3 mt-3 rounded-[6px] bg-paper-3 animate-pulse" />
        <ul className="mt-5 flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="card flex items-center gap-3 p-3">
              <div className="w-11 h-11 rounded-full bg-paper-3 animate-pulse" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="w-36 h-4 rounded-[6px] bg-paper-3 animate-pulse" />
                <div className="w-24 h-3 rounded-[6px] bg-paper-3 animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
