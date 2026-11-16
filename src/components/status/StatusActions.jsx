"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { cn } from "@/lib/utils";

/**
 * The way back: "Go to your bookcase" when signed in (with a username),
 * otherwise "Go home". Status pages render outside any user context, so
 * this reads it on the client rather than making the pages dynamic.
 */
export function HomeAction({ primary = false }) {
  const { profile } = useAuth();
  const username = profile?.username;
  return (
    <Link
      href={username ? `/u/${encodeURIComponent(username)}` : "/"}
      className={cn("btn", primary ? "btn-primary" : "btn-secondary")}
    >
      {username ? "Go to your bookcase" : "Go home"}
    </Link>
  );
}

/** Opens the "Add books" search for signed-in readers; Discover for everyone else. */
export function SearchBooksAction() {
  const library = useLibrary();
  if (library.userId) {
    return (
      <button type="button" onClick={() => library.openAddBook()} className="btn btn-primary">
        Search for a book
      </button>
    );
  }
  return (
    <Link href="/discover" className="btn btn-primary">
      Search for a book
    </Link>
  );
}
