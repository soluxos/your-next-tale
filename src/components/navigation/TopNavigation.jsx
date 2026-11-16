"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import { useLibrary } from "@/components/providers/LibraryProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const menuItem = "label !text-[11px] cursor-pointer h-10 px-3 rounded-[6px]";
// Phone menu rows: a 44px tap target each.
const sheetRow = "h-11 px-3 -mx-3 flex items-center justify-between gap-3 label-lg rounded-[8px] text-left transition-colors";

const EFFECTS = [
  { key: "crt", label: "CRT filter" },
  { key: "noise", label: "Paper grain" }
];

export default function TopNavigation() {
  const { user, profile, loading, updateUISettings } = useAuth();
  const library = useLibrary();
  const isLoggedIn = !!user;
  const isAdmin = profile?.role === "admin";
  const fullName = profile?.full_name || "";
  const username = profile?.username || "";
  const displayName = fullName || username;
  const facehashColor = profile?.facehash_color;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 4);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the phone menu whenever the page changes
  useEffect(() => setMobileMenuOpen(false), [pathname]);

  // Escape closes the phone menu too
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMobileMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  // Pending follow requests (private profiles only)
  useEffect(() => {
    if (!user || !profile?.is_private) return;
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", user.id)
      .eq("status", "pending")
      .then(({ count }) => setPendingRequestCount(count || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const bookcaseHref = username ? `/u/${encodeURIComponent(username)}` : "/account";
  const navItems = [
    { id: "discover", label: "Discover", href: "/discover" },
    { id: "releases", label: "New releases", href: "/releases" },
    { id: "my-bookcase", label: "Bookcase", href: bookcaseHref, authOnly: true },
    { id: "feed", label: "Feed", href: "/feed", authOnly: true }
  ];

  function getActiveItem() {
    if (pathname.startsWith("/feed")) return "feed";
    if (pathname.startsWith("/releases")) return "releases";
    if (
      username &&
      (pathname === `/u/${username}` ||
        pathname.startsWith(`/u/${encodeURIComponent(username)}/`) ||
        pathname.startsWith(`/u/${username}/`))
    )
      return "my-bookcase";
    if (pathname.startsWith("/discover") || pathname.startsWith("/books")) return "discover";
    return "";
  }
  const activeItem = getActiveItem();

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    router.push("/");
    router.refresh();
  };

  // Before auth has settled, show what everyone gets, so the bar doesn't
  // grow two links a moment after it paints.
  const visibleNavItems = navItems.filter((item) => !item.authOnly || isLoggedIn);

  // Add books from your own shelf page adds to that shelf
  const openAddBook = () => {
    const m = username && pathname.match(new RegExp(`^/u/${encodeURIComponent(username)}/([^/]+)`));
    const shelf = m && library.shelves.find((s) => s.slug === m[1]);
    library.openAddBook({ shelfId: shelf?.id || null });
  };
  const shortcut = isMac ? "⌘K" : "Ctrl K";
  const effectOn = (key) => profile?.ui_settings?.[key] ?? key !== "crt";
  const settled = mounted && !loading;

  return (
    <header
      className={cn(
        "TopNavigation fixed top-0 inset-x-0 z-[50] h-16 border-b transition-[background-color,border-color] duration-300",
        // No backdrop blur while the phone menu is open: backdrop-filter would
        // trap the menu's fixed scrim inside the 64px header.
        mobileMenuOpen
          ? "bg-white border-line"
          : scrolled
            ? "bg-white/90 backdrop-blur-md border-line"
            : "bg-white border-transparent"
      )}
    >
      {/* The same 1600px column as the pages, so the logo and the avatar line
          up with the content's edges at every width. */}
      <div className="h-full page-x mx-auto max-w-[1600px] flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 rounded-[6px] focus-ring"
          aria-label="Your Next Tale — home"
        >
          <img src="/new-logo.svg" alt="" className="w-auto h-5" />
          <span className="font-ppMondwest text-[20px] text-ink leading-none">Your next tale</span>
        </Link>

        <nav aria-label="Main" className="hidden md:flex items-center gap-1 ml-3 lg:ml-8">
          {visibleNavItems.map((item) => {
            const active = activeItem === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "h-9 px-3 inline-flex items-center label-lg rounded-[8px] whitespace-nowrap transition-colors",
                  active ? "bg-paper-3 text-ink" : "text-textSecondary hover:text-ink hover:bg-paper-2"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {!settled ? (
            <div className="w-9 h-9 rounded-full bg-paper-3 animate-pulse" aria-hidden="true" />
          ) : isLoggedIn ? (
            <>
              <button
                type="button"
                onClick={openAddBook}
                aria-label="Add books"
                aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
                title={`Add books (${shortcut})`}
                className="btn btn-primary btn-icon md:!h-9 md:!w-9 lg:!w-auto lg:!px-4"
              >
                <PlusIcon />
                <span className="hidden lg:inline">Add books</span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="hidden md:flex relative rounded-full w-9 h-9 items-center justify-center ring-1 ring-line hover:ring-ink/30 data-[state=open]:ring-ink/50 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                  aria-label="Account menu"
                >
                  <FacehashAvatar name={fullName || user?.email || "user"} color={facehashColor} size={36} />
                  {pendingRequestCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#d92d20] ring-2 ring-white" aria-hidden="true" />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="w-64 z-[101] p-1.5 rounded-[12px]">
                  <div className="flex items-center gap-3 px-3 pt-2.5 pb-3">
                    <FacehashAvatar name={fullName || user?.email || "user"} color={facehashColor} size={36} />
                    <div className="min-w-0">
                      <p className="font-ppMondwest text-[17px] leading-tight text-ink truncate">{displayName}</p>
                      {username && <p className="label text-textSecondary truncate mt-0.5">@{username}</p>}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {username && (
                    <DropdownMenuItem className={menuItem} onClick={() => router.push(bookcaseHref)}>
                      Your bookcase
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className={menuItem} onClick={() => library.openImport()}>
                    Import &amp; export
                  </DropdownMenuItem>
                  {pendingRequestCount > 0 && (
                    <DropdownMenuItem className={menuItem} onClick={() => router.push("/account/follow-requests")}>
                      Follow requests
                      <Badge count={pendingRequestCount} />
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className={menuItem} onClick={() => router.push("/account")}>
                    Account settings
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem className={menuItem} onClick={() => router.push("/admin")}>
                      Admin dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <p className="px-3 pt-2 pb-1 label !text-[10px] text-textSecondary">Display</p>
                  {EFFECTS.map(({ key, label }) => {
                    const on = effectOn(key);
                    return (
                      <DropdownMenuItem
                        key={key}
                        role="menuitemcheckbox"
                        aria-checked={on}
                        className={cn(menuItem, "justify-between")}
                        onSelect={(e) => {
                          e.preventDefault();
                          updateUISettings({ [key]: !on });
                        }}
                      >
                        {label}
                        <Toggle on={on} />
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className={cn(menuItem, "text-[#b42318] focus:text-[#b42318]")}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden md:inline-flex btn btn-ghost !h-9">
                Sign in
              </Link>
              <Link href="/get-started" className="hidden xs:inline-flex btn btn-primary !h-9">
                Get started
              </Link>
            </>
          )}

          {/* Phones: everything else lives in the menu */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            className="md:hidden relative btn btn-secondary btn-icon"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {mobileMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 8h16M4 16h16" />}
            </svg>
            {pendingRequestCount > 0 && !mobileMenuOpen && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#d92d20] ring-2 ring-white" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.button
            key="scrim"
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMobileMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-ink/30 cursor-default"
          />
        )}
        {mobileMenuOpen && (
          <motion.div
            key="menu"
            id="mobile-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 460, damping: 36 }}
            className="md:hidden absolute top-full inset-x-0 bg-white border-b border-line shadow-[0_24px_48px_-24px_rgba(0,0,0,0.35)] max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain"
          >
            <div className="page-x pt-3 pb-6">
              {/* Where to go: the pages, large, the one you're on marked */}
              <nav aria-label="Main" className="flex flex-col">
                {visibleNavItems.map((item) => {
                  const active = activeItem === item.id;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "h-14 flex items-center justify-between font-ppMondwest text-[26px] leading-none border-b border-line/70 last:border-b-0",
                        active ? "text-ink" : "text-textPrimary"
                      )}
                    >
                      {item.label}
                      {active && <span className="w-2 h-2 rounded-full bg-ink" aria-hidden="true" />}
                    </Link>
                  );
                })}
              </nav>

              {settled && isLoggedIn ? (
                <>
                  {/* You: who's signed in, then your things */}
                  <div className="mt-5 rounded-[12px] bg-paper-2 px-4 py-3">
                    <div className="flex items-center gap-3 py-1.5">
                      <FacehashAvatar name={fullName || user?.email || "user"} color={facehashColor} size={40} />
                      <div className="min-w-0">
                        <p className="font-ppMondwest text-[18px] leading-tight text-ink truncate">{displayName}</p>
                        {username && <p className="label text-textSecondary truncate mt-0.5">@{username}</p>}
                      </div>
                    </div>
                    <div className="mt-2 pt-1 border-t border-line flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          library.openImport();
                        }}
                        className={cn(sheetRow, "text-textPrimary hover:bg-white")}
                      >
                        Import &amp; export
                      </button>
                      {pendingRequestCount > 0 && (
                        <Link href="/account/follow-requests" className={cn(sheetRow, "text-textPrimary hover:bg-white")}>
                          Follow requests
                          <Badge count={pendingRequestCount} />
                        </Link>
                      )}
                      <Link href="/account" className={cn(sheetRow, "text-textPrimary hover:bg-white")}>
                        Account settings
                      </Link>
                      {isAdmin && (
                        <Link href="/admin" className={cn(sheetRow, "text-textPrimary hover:bg-white")}>
                          Admin dashboard
                        </Link>
                      )}
                    </div>
                  </div>

                  <p className="mt-6 mb-1 label text-textSecondary">Display</p>
                  <div className="flex flex-col">
                    {EFFECTS.map(({ key, label }) => {
                      const on = effectOn(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          role="switch"
                          aria-checked={on}
                          onClick={() => updateUISettings({ [key]: !on })}
                          className={cn(sheetRow, "text-textPrimary hover:bg-paper-2")}
                        >
                          {label}
                          <Toggle on={on} />
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="btn btn-secondary btn-lg w-full mt-6 !text-[#b42318]"
                  >
                    Sign out
                  </button>
                </>
              ) : settled ? (
                <div className="grid grid-cols-2 gap-2 mt-6">
                  <Link href="/login" className="btn btn-secondary btn-lg">
                    Sign in
                  </Link>
                  <Link href="/get-started" className="btn btn-primary btn-lg">
                    Get started
                  </Link>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}

function Badge({ count }) {
  return (
    <span className="ml-auto bg-ink text-white text-[10px] rounded-full min-w-5 h-5 px-1 flex items-center justify-center tabular-nums">
      {count}
    </span>
  );
}

function Toggle({ on }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative w-8 h-[18px] rounded-full transition-colors shrink-0", on ? "bg-ink" : "bg-[#cfcfcf]")}
    >
      <span
        className={cn(
          "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[16px]" : "translate-x-[2px]"
        )}
      />
    </span>
  );
}
