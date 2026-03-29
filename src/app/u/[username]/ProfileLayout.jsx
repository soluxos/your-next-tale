"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TopNavigation from "@/components/navigation/TopNavigation";

export default function ProfileLayout({ profile, shelves, isOwner, children }) {
  const pathname = usePathname();

  // Derive active slug from URL
  const segments = pathname.split("/");
  // /u/[username]/[shelfSlug] → segments[3]
  const activeSlug = segments[3] || "all";

  const getInitials = (name) => {
    if (!name) return profile.username?.[0]?.toUpperCase() ?? "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Build tab list: "All" virtual shelf + real shelves
  const tabs = [
    { slug: "all", name: "All Books" },
    ...shelves.map((s) => ({ slug: s.slug, name: s.name }))
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Profile header */}
      <div className="px-5 pt-6 pb-4">
        <div className="max-w-4xl mx-auto flex items-start gap-4">
          <Avatar className="h-16 w-16 border border-border shrink-0">
            <AvatarImage src={profile.avatarUrl} alt={profile.full_name} />
            <AvatarFallback className="text-lg font-departureMono bg-[#f4f4f4] text-textPrimary">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h1 className="font-ppMondwest text-xl text-textPrimary truncate">
              {profile.full_name || profile.username}
            </h1>
            <p className="font-departureMono uppercase text-[11px] text-textSecondary">
              @{profile.username}
            </p>
            {profile.bio && (
              <p className="mt-1 text-sm text-textSecondary line-clamp-2">
                {profile.bio}
              </p>
            )}
          </div>

          {isOwner && (
            <a
              href="/account"
              className="shrink-0 h-8 px-3 flex items-center font-departureMono uppercase text-[10px] text-textSecondary rounded-[8px] border border-border hover:bg-[#f4f4f4] transition-colors"
            >
              Edit Profile
            </a>
          )}
        </div>
      </div>

      {/* Shelf tab navigation */}
      <div className="px-5 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <nav className="flex gap-1 overflow-x-auto no-scrollbar -mb-px">
            {tabs.map((tab) => (
              <a
                key={tab.slug}
                href={`/u/${encodeURIComponent(profile.username)}/${tab.slug}`}
                className={cn(
                  "px-3 py-2 font-departureMono uppercase text-[11px] whitespace-nowrap border-b-2 transition-colors",
                  activeSlug === tab.slug
                    ? "border-textPrimary text-textPrimary"
                    : "border-transparent text-textSecondary hover:text-textPrimary hover:border-[#ddd]"
                )}
              >
                {tab.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Shelf content */}
      <div>{children}</div>
    </div>
  );
}
