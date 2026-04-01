"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Facehash } from "facehash";
import TopNavigation from "@/components/navigation/TopNavigation";
import ManageShelvesPanel from "@/components/shelves/ManageShelvesPanel";
import { useAuth } from "@/components/providers/AuthProvider";
import FollowButton from "@/components/profile/FollowButton";

export default function ProfileLayout({
  profile,
  shelves,
  isOwner,
  currentUserId,
  followCounts,
  followStatus,
  children
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile: authProfile } = useAuth();
  const [localShelves, setLocalShelves] = useState(shelves);
  const [manageShelvesOpen, setManageShelvesOpen] = useState(false);

  // When viewing own profile, use the live auth context colour so it updates
  // immediately after saving without needing a full page refresh.
  const facehashColor = isOwner
    ? (authProfile?.facehash_color ?? profile.facehash_color)
    : profile.facehash_color;

  // Derive active slug from URL
  const segments = pathname.split("/");
  // /u/[username]/[shelfSlug] → segments[3]
  const activeSlug = segments[3] || "all";

  // Build tab list: "All" virtual shelf + real shelves
  const tabs = [
    { slug: "all", name: "All Books" },
    ...localShelves.map((s) => ({ slug: s.slug, name: s.name }))
  ];

  function handleShelvesUpdated(updatedShelves) {
    setLocalShelves(updatedShelves);
  }

  function handleDeleteRedirect(remaining) {
    const next = remaining[0]?.slug || "all";
    router.push(`/u/${encodeURIComponent(profile.username)}/${next}`);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Profile header */}
      <div className="px-5 py-[120px]">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <Facehash
            name={profile.full_name || profile.username || "user"}
            size={64}
            variant="solid"
            enableBlink
            className="rounded-full text-black"
            colors={
              facehashColor
                ? [facehashColor]
                : [
                    "oklch(0.7 0.24 0)",
                    "oklch(0.7 0.24 30)",
                    "oklch(0.7 0.24 60)",
                    "oklch(0.7 0.24 90)",
                    "oklch(0.7 0.24 120)",
                    "oklch(0.7 0.24 150)",
                    "oklch(0.7 0.24 180)",
                    "oklch(0.7 0.24 210)",
                    "oklch(0.7 0.24 240)",
                    "oklch(0.7 0.24 270)",
                    "oklch(0.7 0.24 300)",
                    "oklch(0.7 0.24 330)"
                  ]
            }
          />

          <div className="min-w-0 flex-1 text-center">
            <h1 className="font-ppMondwest text-xl text-textPrimary truncate">
              {profile.full_name || profile.username}
            </h1>
            <p className="font-departureMono uppercase text-[11px] text-textSecondary">
              @{profile.username}
            </p>
            {profile.bio && (
              <p className="mt-1 font-inter text-[14px] text-textSecondary line-clamp-2">
                {profile.bio}
              </p>
            )}
          </div>

          {/* Follower / following counts */}
          {followCounts && (
            <div className="flex items-center gap-6">
              <Link
                href={`/u/${profile.username}/followers`}
                className="font-departureMono uppercase text-[11px] hover:underline"
              >
                <span className="font-ppMondwest text-[18px]">
                  {followCounts.followers}
                </span>{" "}
                <span className="text-textSecondary">Followers</span>
              </Link>
              <Link
                href={`/u/${profile.username}/following`}
                className="font-departureMono uppercase text-[11px] hover:underline"
              >
                <span className="font-ppMondwest text-[18px]">
                  {followCounts.following}
                </span>{" "}
                <span className="text-textSecondary">Following</span>
              </Link>
            </div>
          )}

          {/* Follow button — only show to logged-in non-owners */}
          {!isOwner && currentUserId && (
            <FollowButton
              targetUserId={profile.id}
              isPrivate={profile.is_private}
              initialStatus={followStatus || "none"}
            />
          )}

          {isOwner && (
            <div className="flex gap-2 items-center">
              <Link
                href="/account"
                className="shrink-0 h-8 px-3 flex items-center font-departureMono uppercase text-[10px] text-textSecondary rounded-[8px] border border-border hover:bg-[#f4f4f4] transition-colors"
              >
                Edit Profile
              </Link>
              <button
                onClick={() => setManageShelvesOpen(true)}
                className="flex items-center gap-1.5 px-3 h-8
                           font-departureMono uppercase text-[10px] text-textSecondary
                           border border-border rounded-[8px] hover:bg-[#f4f4f4]
                           hover:text-textPrimary transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                Manage Shelves
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shelf tab navigation — hidden on followers/following sub-pages */}
      {activeSlug !== "followers" && activeSlug !== "following" && (
      <div className="px-5">
        <div className="max-w-4xl mx-auto">
          <nav className="flex gap-1 overflow-x-auto no-scrollbar -mb-px items-center">
            {tabs.map((tab) => (
              <Link
                key={tab.slug}
                href={`/u/${encodeURIComponent(profile.username)}/${tab.slug}`}
                prefetch={true}
                className={cn(
                  "px-3 py-2 font-departureMono uppercase text-[11px] whitespace-nowrap border-b-2 transition-colors",
                  activeSlug === tab.slug
                    ? "border-textPrimary text-textPrimary"
                    : "border-transparent text-textSecondary hover:text-textPrimary hover:border-[#ddd]"
                )}
              >
                {tab.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      )}

      {/* Shelf content */}
      <div>{children}</div>

      {/* Manage Shelves Panel */}
      {isOwner && (
        <ManageShelvesPanel
          open={manageShelvesOpen}
          onOpenChange={setManageShelvesOpen}
          shelves={localShelves}
          userId={profile.id}
          onShelvesUpdated={handleShelvesUpdated}
          currentShelfSlug={activeSlug}
          onDeleteRedirect={handleDeleteRedirect}
        />
      )}
    </div>
  );
}
