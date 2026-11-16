"use client";

import { usePathname } from "next/navigation";
import { FollowListSkeleton } from "@/components/profile/FollowList";

/**
 * Loading state for the page under a profile. It renders inside
 * ProfileLayout (where the header, stats and tabs live), so it must not
 * redraw any of those — that's what made tab switches flash a whole
 * skeleton profile. Shelves draw their own placeholders (ShelfView, sized
 * from the tab's count), so only the people lists need one here.
 */
export default function ProfileLoading() {
  const pathname = usePathname() || "";
  return /\/(followers|following)\/?$/.test(pathname) ? <FollowListSkeleton /> : null;
}
