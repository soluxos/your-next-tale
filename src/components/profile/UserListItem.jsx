import Link from "next/link";
import FacehashAvatar from "@/components/profile/FacehashAvatar";

/** A reader in a Followers / Following list — the whole card opens their bookcase. */
export default function UserListItem({ user }) {
  const name = user.full_name || user.username;
  const books = user.book_count > 0 ? user.book_count : null;
  return (
    <Link
      href={`/u/${encodeURIComponent(user.username)}`}
      className="group card card-hover flex items-center gap-3 p-3 min-h-[68px] focus-ring"
    >
      <FacehashAvatar name={name} color={user.facehash_color} size={44} />
      <div className="flex-1 min-w-0">
        <p className="font-ppMondwest text-[18px] leading-tight text-ink truncate">{name}</p>
        <p className="label text-textSecondary mt-1 flex items-center gap-x-2 min-w-0">
          <span className="truncate">@{user.username}</span>
          {books && (
            <span className="shrink-0">
              · <span className="text-ink tabular-nums">{books.toLocaleString("en-GB")}</span> {books === 1 ? "book" : "books"}
            </span>
          )}
          {user.is_private && (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 h-5 rounded-[4px] bg-paper-3">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Private
            </span>
          )}
        </p>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1.5 label text-textSecondary group-hover:text-ink transition-colors">
        <span className="hidden sm:inline">View bookcase</span>
        <span className="w-8 h-8 rounded-full inline-flex items-center justify-center bg-paper-2 group-hover:bg-paper-3 transition-colors" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </span>
    </Link>
  );
}
