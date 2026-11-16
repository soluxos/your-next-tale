"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";

const linkClass = "label-lg text-textSecondary hover:text-ink transition-colors py-1.5 w-fit";

export default function Footer() {
  const { user, profile } = useAuth();
  const library = useLibrary();
  const bookcaseHref = profile?.username ? `/u/${encodeURIComponent(profile.username)}` : "/account";

  const explore = [
    { label: "Discover", href: "/discover" },
    { label: "New releases", href: "/releases" },
    { label: "Feed", href: "/feed" }
  ];

  return (
    <footer className="relative z-[21] bg-white border-t border-line">
      <div className="page-x mx-auto max-w-[1600px] pt-12 sm:pt-16 pb-8">
        <div className="grid gap-10 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-16 lg:gap-x-24">
          <div className="max-w-[340px]">
            <Link href="/" className="inline-flex items-center gap-2.5 rounded-[6px] focus-ring">
              <img src="/new-logo.svg" alt="" className="h-5 w-auto" />
              <span className="font-ppMondwest text-[20px] text-ink leading-none">Your next tale</span>
            </Link>
            <p className="mt-4 font-ppMondwest text-[16px] leading-snug text-textSecondary">
              Keep track of what you read, and find the book you’ll read next.
            </p>
          </div>

          <nav aria-label="Explore" className="flex flex-col">
            <p className="label text-ink mb-2">Explore</p>
            {explore.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </nav>

          <nav aria-label="Your library" className="flex flex-col">
            <p className="label text-ink mb-2">{user ? "Your library" : "Join in"}</p>
            {user ? (
              <>
                <Link href={bookcaseHref} className={linkClass}>
                  Your bookcase
                </Link>
                <button type="button" onClick={() => library.openImport()} className={`${linkClass} text-left`}>
                  Import &amp; export
                </button>
                <Link href="/account" className={linkClass}>
                  Account settings
                </Link>
              </>
            ) : (
              <>
                <Link href="/get-started" className={linkClass}>
                  Create your bookcase
                </Link>
                <Link href="/login" className={linkClass}>
                  Sign in
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="mt-12 pt-6 border-t border-line">
          <p className="label text-textSecondary">© {new Date().getFullYear()} Your Next Tale</p>
        </div>
      </div>
    </footer>
  );
}
