"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import ProfileTabs from "@/components/profile/ProfileTabs";
import ShelfView from "@/app/u/[username]/[shelfSlug]/ShelfView";
import ManageShelvesPanel from "@/components/shelves/ManageShelvesPanel";
import { DEFAULT_FILTERS } from "@/lib/shelfFilter";
import { useAuth } from "@/components/providers/AuthProvider";
import FollowButton from "@/components/profile/FollowButton";
import ReaderStats from "@/components/profile/ReaderStats";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { toast } from "sonner";

export default function ProfileLayout({
  profile,
  shelves,
  shelfCounts = {},
  isOwner,
  isAdmin = false,
  currentUserId,
  followCounts,
  followStatus,
  children
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile: authProfile } = useAuth();
  const library = useLibrary();
  const [localShelves, setLocalShelves] = useState(shelves);
  const [manageShelvesOpen, setManageShelvesOpen] = useState(false);

  // Sort / filter / view state lives here, above ShelfView, so it survives
  // the shelf re-rendering as you switch tabs.
  const [sortKey, setSortKey] = useState("user");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // When viewing own profile, use the live auth context colour so it updates
  // immediately after saving without needing a full page refresh.
  const facehashColor = isOwner
    ? (authProfile?.facehash_color ?? profile.facehash_color)
    : profile.facehash_color;

  // Derive active slug from URL
  const segments = pathname.split("/");
  // /u/[username]/[shelfSlug] → segments[3]
  const activeSlug = segments[3] || "all";

  // Compute shelf props for ShelfView (used when on a shelf page)
  const isShelfPage = activeSlug !== "followers" && activeSlug !== "following";
  const activeShelf =
    activeSlug === "all"
      ? null
      : localShelves.find((s) => s.slug === activeSlug);
  const shelfId = activeShelf?.id || null;
  const shelfName = activeShelf?.name || "All Books";
  const defaultView = activeShelf?.default_view || "books";

  // Each shelf opens on its own "Opens on" setting (Manage shelves); toggling
  // Books/Reviews applies to the shelf you're looking at until you switch tabs.
  const [viewMode, setViewMode] = useState(defaultView);
  const [viewModeFor, setViewModeFor] = useState(activeSlug);
  if (viewModeFor !== activeSlug) {
    setViewModeFor(activeSlug);
    setViewMode(defaultView);
  }
  const handleViewModeChange = setViewMode;
  // Pass live facehash colour so ReviewModal reflects any in-session colour change
  const profileWithLiveColor = { ...profile, facehash_color: facehashColor };

  // Owners see live counts (they change as you add books); visitors get the
  // server-rendered counts.
  const counts = useMemo(() => {
    if (!isOwner || !library.ready) return shelfCounts;
    const live = { all: library.entries.size };
    for (const entry of library.entries.values()) {
      for (const id of entry.shelfIds) live[id] = (live[id] || 0) + 1;
    }
    return live;
  }, [isOwner, library.ready, library.entries, shelfCounts]);

  const userBase = `/u/${encodeURIComponent(profile.username)}`;

  // Shelf tabs: "All Books" (every book in the library) + the real shelves
  const shelfTabs = [
    { key: "all", href: `${userBase}/all`, label: "All Books", count: counts.all },
    ...localShelves.map((s) => ({
      key: s.slug,
      href: `${userBase}/${s.slug}`,
      label: s.name,
      count: counts[s.id] || 0
    }))
  ];

  // Followers / Following get the same strip, with a way back to the bookcase
  const peopleTabs = [
    {
      key: "bookcase",
      href: `${userBase}/all`,
      label: "Bookcase",
      icon: (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 3L5 8l5 5" />
        </svg>
      )
    },
    { key: "followers", href: `${userBase}/followers`, label: "Followers", count: followCounts?.followers },
    { key: "following", href: `${userBase}/following`, label: "Following", count: followCounts?.following }
  ];

  function handleShelvesUpdated(updatedShelves) {
    setLocalShelves(updatedShelves);
    // Keep the Add books drawer / shelf menus in step with renames & new shelves
    if (isOwner) library.setShelves(updatedShelves);
  }

  function handleDeleteRedirect() {
    router.replace(`${userBase}/all`);
  }

  // Sort is remembered per shelf (this browser only)
  const sortStorageKey = `shelf-sort:${profile.id}:${activeSlug}`;
  useEffect(() => {
    try {
      setSortKey(localStorage.getItem(sortStorageKey) || "user");
    } catch {
      setSortKey("user");
    }
  }, [sortStorageKey]);
  function handleSortChange(key) {
    setSortKey(key);
    try {
      localStorage.setItem(sortStorageKey, key);
    } catch {}
  }

  async function copyProfileLink() {
    const url = `${window.location.origin}/u/${encodeURIComponent(profile.username)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: url });
    } catch {
      toast("Your bookcase link", { description: url });
    }
  }

  const displayName = profile.full_name || profile.username;
  // Follower counts read as links: underlined, with a generous tap area.
  const countLinkClass =
    "py-2 -my-2 underline decoration-black/25 underline-offset-[3px] hover:text-ink hover:decoration-ink transition-colors rounded-[2px] focus-ring";

  // "Custom order" only exists on real shelves; All Books falls back to newest
  const effectiveSort = activeSlug === "all" && sortKey === "user" ? "date_added" : sortKey;

  return (
    <div className="ProfileLayout min-h-screen">
      {/* Profile header, stats and tabs live here in the layout, outside the
          route's loading boundary, so they stay put while you switch tabs. */}
      <header className="page-x pt-8 sm:pt-12 pb-6 sm:pb-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="shrink-0 hidden sm:block">
              <FacehashAvatar name={displayName} color={facehashColor} size={76} />
            </div>
            <div className="shrink-0 sm:hidden">
              <FacehashAvatar name={displayName} color={facehashColor} size={56} />
            </div>
            <div className="min-w-0">
              <h1 className="font-ppMondwest text-ink text-[28px] sm:text-[38px] leading-[1.05] truncate">
                {displayName}
              </h1>
              {/* Phones: @username, then the counts on their own (wrapping) line */}
              <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 label text-textSecondary">
                <span>@{profile.username}</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {typeof counts.all === "number" && (
                    <span>
                      <span className="text-ink tabular-nums">{counts.all}</span> {counts.all === 1 ? "book" : "books"}
                    </span>
                  )}
                  {followCounts && (
                    <>
                      <Link href={`${userBase}/followers`} className={countLinkClass}>
                        <span className="text-ink tabular-nums">{followCounts.followers}</span>{" "}
                        {followCounts.followers === 1 ? "follower" : "followers"}
                      </Link>
                      <Link href={`${userBase}/following`} className={countLinkClass}>
                        <span className="text-ink tabular-nums">{followCounts.following}</span> following
                      </Link>
                    </>
                  )}
                </div>
              </div>
              {profile.bio && (
                <p className="mt-2 font-ppMondwest text-[16px] text-textPrimary line-clamp-2 max-w-xl">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isOwner && currentUserId && (
              <FollowButton
                targetUserId={profile.id}
                isPrivate={profile.is_private}
                initialStatus={followStatus || "none"}
              />
            )}
            {/* Icon-only on phones so the owner's three actions share one row */}
            <button type="button" onClick={copyProfileLink} className="btn btn-secondary btn-icon sm:w-auto sm:px-4 shrink-0" aria-label="Copy link to this bookcase">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>
            {isOwner && (
              <>
                <button type="button" onClick={() => setManageShelvesOpen(true)} className="btn btn-secondary flex-1 sm:flex-none px-3 sm:px-4">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                  Manage shelves
                </button>
                <Link href="/account" className="btn btn-secondary flex-1 sm:flex-none px-3 sm:px-4">
                  Edit profile
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {isShelfPage && (
        <ReaderStats
          userId={profile.id}
          readCount={counts[localShelves.find((s) => s.slug === "read")?.id] || 0}
          isOwner={isOwner}
        />
      )}

      {isShelfPage ? (
        <ProfileTabs tabs={shelfTabs} activeKey={activeSlug} label="Shelves" />
      ) : (
        <ProfileTabs tabs={peopleTabs} activeKey={activeSlug} label={`${displayName}’s profile`} />
      )}

      {/* Shelf content */}
      {isShelfPage ? (
        <>
          <ShelfView
            shelfSlug={activeSlug}
            shelfId={shelfId}
            shelfName={shelfName}
            isOwner={isOwner}
            isAdmin={isAdmin}
            userId={profile.id}
            username={profile.username}
            shelves={localShelves}
            defaultView={defaultView}
            profile={profileWithLiveColor}
            sortKey={effectiveSort}
            onSortChange={handleSortChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            filters={filters}
            onFiltersChange={setFilters}
            knownCount={activeSlug === "all" ? counts.all : shelfId ? counts[shelfId] || 0 : undefined}
          />
          {/* children carries the @modal slot (e.g. ReviewModal on direct load) */}
          {children}
        </>
      ) : (
        <div>{children}</div>
      )}

      {isOwner && (
        <ManageShelvesPanel
          open={manageShelvesOpen}
          onOpenChange={setManageShelvesOpen}
          shelves={localShelves}
          userId={profile.id}
          onShelvesUpdated={handleShelvesUpdated}
          currentShelfSlug={activeSlug}
          onDeleteRedirect={handleDeleteRedirect}
          onRenameRedirect={(slug) =>
            router.replace(`${userBase}/${slug}`)
          }
          shelfCounts={counts}
        />
      )}
    </div>
  );
}
