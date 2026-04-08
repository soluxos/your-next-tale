"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Facehash } from "facehash";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function TopNavigation() {
  const { user, profile, loading, updateUISettings } = useAuth();
  const isLoggedIn = !!user;
  const isAdmin = profile?.role === "admin";
  const fullName = profile?.full_name || "";
  const username = profile?.username || "";
  const facehashColor = profile?.facehash_color;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch pending follow request count for private profiles
  useEffect(() => {
    if (!user || !profile?.is_private) return;
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", user.id)
      .eq("status", "pending")
      .then(({ count }) => setPendingRequestCount(count || 0));
  }, [user, profile]);

  const navItems = [
    { id: "discover", label: "Discover", href: "/" },
    {
      id: "my-bookcase",
      label: "My Bookcase",
      href: username ? `/u/${encodeURIComponent(username)}` : "/account",
      authOnly: true
    },
    { id: "feed", label: "Feed", href: "/feed", authOnly: true },
    { id: "admin", label: "Admin", href: "/admin", adminOnly: true }
  ];

  function getActiveItem() {
    if (pathname.startsWith("/admin")) return "admin";
    if (pathname.startsWith("/feed")) return "feed";
    if (pathname.startsWith("/u/")) return "profile";
    if (pathname === "/") return "discover";
    return "";
  }
  const activeItem = getActiveItem();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly) return isLoggedIn && isAdmin;
    if (item.authOnly) return isLoggedIn;
    return true;
  });

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        duration: 0.6
      }}
      className="z-[99] py-4 border-b border-border fixed top-0 left-0 right-0 bg-white"
    >
      <div className="max-w-full w-full px-10 mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <span className="font-ppMondwest text-[18px] text-textPrimary">
            Your next tale
          </span>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center justify-end gap-3">
          <nav className="hidden md:flex items-center justify-center gap-1">
            {visibleNavItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-4 py-2 font-departureMono uppercase text-[12px] rounded-[8px] transition-colors",
                  activeItem === item.id
                    ? "text-textPrimary"
                    : "text-textSecondary hover:underline hover:text-textPrimary"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-[8px] bg-white border border-border hover:bg-[#f4f4f4] transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-textSecondary"
            >
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="8" x2="20" y2="8" />
                  <line x1="4" y1="16" x2="20" y2="16" />
                </>
              )}
            </svg>
          </button>

          {/* Avatar / sign-in buttons */}
          {loading ? (
            <div className="w-9 h-9 rounded-full bg-[#f4f4f4] animate-pulse" />
          ) : mounted && isLoggedIn ? (
            /* Logged-in: avatar dropdown */
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-border">
                <Facehash
                  name={fullName || user?.email || "user"}
                  size={36}
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
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-[101]">
                <div className="px-2 py-1.5">
                  <p className="font-departureMono uppercase text-[10px] text-textSecondary truncate">
                    {fullName || user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                {username && (
                  <DropdownMenuItem
                    className="font-departureMono uppercase text-[11px] cursor-pointer"
                    onClick={() =>
                      router.push(`/u/${encodeURIComponent(username)}`)
                    }
                  >
                    My Profile
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem
                    className="font-departureMono uppercase text-[11px] cursor-pointer"
                    onClick={() => router.push("/admin")}
                  >
                    Admin Dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="font-departureMono uppercase text-[11px] cursor-pointer"
                  onClick={() => router.push("/account")}
                >
                  Account Settings
                </DropdownMenuItem>
                {pendingRequestCount > 0 && (
                  <DropdownMenuItem
                    onClick={() => router.push("/account/follow-requests")}
                    className="font-departureMono uppercase text-[11px] cursor-pointer"
                  >
                    Follow Requests
                    <span
                      className="ml-auto bg-[#1f1f1f] text-white text-[9px]
                                     rounded-full w-5 h-5 flex items-center justify-center"
                    >
                      {pendingRequestCount}
                    </span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {/* Visual effects toggles */}
                <div className="px-2 py-1.5">
                  <p className="font-departureMono uppercase text-[9px] text-textSecondary mb-1.5 px-1">
                    Effects
                  </p>
                  {[
                    { key: "crt", label: "CRT Filter" },
                    { key: "noise", label: "Noise" }
                  ].map(({ key, label }) => {
                    const on = profile?.ui_settings?.[key] ?? true;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between px-1 py-1.5 rounded-[6px] hover:bg-[#f4f4f4] cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateUISettings({ [key]: !on });
                        }}
                      >
                        <span className="font-departureMono uppercase text-[11px]">
                          {label}
                        </span>
                        <div
                          className={`relative w-8 h-4 rounded-full transition-colors ${on ? "bg-[#1f1f1f]" : "bg-[#d0d0d0]"}`}
                        >
                          <div
                            className={`absolute top-[1px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-[1px]"}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="font-departureMono uppercase text-[11px] text-red-500 focus:text-red-500 cursor-pointer"
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : mounted ? (
            /* Logged-out: sign in + get started */
            <>
              <Link
                href="/login"
                className="hidden md:flex h-9 px-4 items-center justify-center font-departureMono uppercase text-[11px] text-textSecondary rounded-[8px] bg-white border border-border hover:bg-[#f4f4f4] transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/get-started"
                className="hidden md:flex h-9 px-4 items-center justify-center gap-2 font-departureMono uppercase text-[11px] text-white rounded-[8px] bg-[#1f1f1f] hover:bg-[#353535] transition-colors"
              >
                Get Started
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" />
                </svg>
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="md:hidden absolute top-full left-0 right-0 mt-2 mx-6"
          >
            <div className="bg-white border border-border rounded-[8px] shadow-lg p-2 flex flex-col gap-1">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-3 font-departureMono uppercase text-[11px] rounded-[6px] transition-colors",
                    activeItem === item.id
                      ? "bg-[#f4f4f4] text-textPrimary"
                      : "text-textSecondary hover:bg-[#f4f4f4] hover:text-textPrimary"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="h-px bg-border my-1" />
              <Link
                href="/search"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 font-departureMono uppercase text-[11px] text-textSecondary rounded-[6px] hover:bg-[#f4f4f4] hover:text-textPrimary transition-colors flex items-center gap-2"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                Search
              </Link>
              {mounted && (
                <>
                  <div className="h-px bg-border my-1" />
                  {isLoggedIn ? (
                    <>
                      <div className="px-4 py-2">
                        <p className="font-departureMono uppercase text-[10px] text-textSecondary truncate">
                          {fullName || user?.email}
                        </p>
                      </div>
                      {username && (
                        <Link
                          href={`/u/${encodeURIComponent(username)}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="px-4 py-3 font-departureMono uppercase text-[11px] text-textSecondary rounded-[6px] hover:bg-[#f4f4f4] hover:text-textPrimary transition-colors"
                        >
                          My Profile
                        </Link>
                      )}
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setMobileMenuOpen(false)}
                          className="px-4 py-3 font-departureMono uppercase text-[11px] text-textSecondary rounded-[6px] hover:bg-[#f4f4f4] hover:text-textPrimary transition-colors"
                        >
                          Admin Dashboard
                        </Link>
                      )}
                      <Link
                        href="/account"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-4 py-3 font-departureMono uppercase text-[11px] text-textSecondary rounded-[6px] hover:bg-[#f4f4f4] hover:text-textPrimary transition-colors"
                      >
                        Account Settings
                      </Link>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOut();
                        }}
                        className="px-4 py-3 font-departureMono uppercase text-[11px] text-red-500 rounded-[6px] hover:bg-[#f4f4f4] transition-colors text-left"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 p-2 pt-1">
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full h-10 flex items-center justify-center font-departureMono uppercase text-[11px] text-textPrimary rounded-[8px] bg-[#f4f4f4] hover:bg-[#eaeaea] transition-colors"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/get-started"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full h-10 flex items-center justify-center gap-2 font-departureMono uppercase text-[11px] text-white rounded-[8px] bg-[#1f1f1f] hover:bg-[#353535] transition-colors"
                      >
                        Get Started
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
