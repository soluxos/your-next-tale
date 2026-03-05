"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function TopNavigation({ user }) {
  const isLoggedIn = !!user;
  const [activeItem, setActiveItem] = useState("discover");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [fullName, setFullName] = useState("");
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    async function loadProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (data) {
        setFullName(data.full_name || "");
        if (data.avatar_url) {
          const { data: blob, error } = await supabase.storage
            .from("avatars")
            .download(data.avatar_url);
          if (!error) {
            setAvatarUrl(URL.createObjectURL(blob));
          }
        }
      }
    }

    loadProfile();
  }, [user?.id]);

  const getInitials = (name) => {
    if (!name) return user?.email?.[0]?.toUpperCase() ?? "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const navItems = [
    { id: "discover", label: "Discover", href: "/" },
    { id: "bookshelves", label: "My Shelves", href: "/bookshelves" },
    { id: "community", label: "Community", href: "/community" }
  ];

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
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
    >
      <div className="max-w-full px-5 mx-auto flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3">
          <span className="font-ppMondwest text-[18px] text-textPrimary">
            Your next tale
          </span>
        </a>

        {/* Center Navigation */}
        <nav
          className="hidden md:flex items-center relative"
          ref={searchContainerRef}
        >
          <div className="bg-white border border-border rounded-[8px] flex items-center p-1 shadow-sm">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveItem(item.id);
                }}
                className={cn(
                  "relative px-4 py-2 font-departureMono uppercase text-[11px] transition-colors rounded-[6px]",
                  activeItem === item.id
                    ? "text-textPrimary"
                    : "text-textSecondary hover:text-textPrimary"
                )}
              >
                {activeItem === item.id && (
                  <motion.div
                    layoutId="activeNavBg"
                    className="absolute inset-0 bg-[#f4f4f4] rounded-[6px]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </a>
            ))}
            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1" />
            {/* Search Button */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className={cn(
                "relative px-3 py-2 font-departureMono uppercase text-[11px] transition-colors rounded-[6px] flex items-center gap-1.5",
                searchOpen
                  ? "text-textPrimary bg-[#f4f4f4]"
                  : "text-textSecondary hover:text-textPrimary"
              )}
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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span>Search</span>
            </button>
          </div>

          {/* Search Dropdown */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[400px]"
              >
                <div className="bg-white border border-border rounded-[8px] shadow-lg p-3">
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9fb] rounded-[6px] border border-border">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-textSecondary shrink-0"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search books, authors, shelves..."
                      className="w-full bg-transparent border-none outline-none font-ppMondwest text-[14px] text-textPrimary placeholder:text-textSecondary"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setSearchOpen(false);
                          setSearchQuery("");
                        }
                      }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white transition-colors"
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
                          className="text-textSecondary"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Quick suggestions */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="font-departureMono uppercase text-[10px] text-textSecondary mb-2 px-1">
                      Quick searches
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {["Fantasy", "Sci-Fi", "New Releases", "Popular"].map(
                        (tag) => (
                          <button
                            key={tag}
                            onClick={() => setSearchQuery(tag)}
                            className="px-3 py-1.5 font-departureMono uppercase text-[10px] text-textSecondary bg-[#f4f4f4] hover:bg-[#eaeaea] rounded-[6px] transition-colors"
                          >
                            {tag}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
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

          {mounted &&
            (isLoggedIn ? (
              /* Logged-in: avatar dropdown */
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-border">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={avatarUrl} alt={fullName} />
                    <AvatarFallback className="text-[11px] font-departureMono bg-[#f4f4f4] text-textPrimary">
                      {getInitials(fullName)}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="font-departureMono uppercase text-[10px] text-textSecondary truncate">
                      {fullName || user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="font-departureMono uppercase text-[11px] cursor-pointer"
                    onClick={() => {
                      window.location.href = "/account";
                    }}
                  >
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="font-departureMono uppercase text-[11px] text-red-500 focus:text-red-500 cursor-pointer"
                  >
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* Logged-out: sign in + get started */
              <>
                <a
                  href="/login"
                  className="hidden sm:flex h-9 px-4 items-center justify-center font-departureMono uppercase text-[11px] text-textSecondary rounded-[8px] bg-white border border-border hover:bg-[#f4f4f4] transition-colors"
                >
                  Sign In
                </a>
                <a
                  href="/login"
                  className="h-9 px-4 flex items-center justify-center gap-2 font-departureMono uppercase text-[11px] text-white rounded-[8px] bg-[#1f1f1f] hover:bg-[#353535] transition-colors"
                >
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Start</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" />
                  </svg>
                </a>
              </>
            ))}
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
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveItem(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "px-4 py-3 font-departureMono uppercase text-[11px] rounded-[6px] transition-colors",
                    activeItem === item.id
                      ? "bg-[#f4f4f4] text-textPrimary"
                      : "text-textSecondary hover:bg-[#f4f4f4] hover:text-textPrimary"
                  )}
                >
                  {item.label}
                </a>
              ))}
              <div className="h-px bg-border my-1" />
              <a
                href="/search"
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
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
