"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  const router = useRouter();
  const supabase = createClient();

  const isAdmin = role === "admin";

  const navItems = [
    { id: "discover", label: "Discover", href: "/" },
    {
      id: "profile",
      label: "My Profile",
      href: username ? `/u/${encodeURIComponent(username)}` : "/account"
    },
    { id: "community", label: "Community", href: "/community" },
    { id: "admin", label: "Admin", href: "/admin", adminOnly: true }
  ];

  useEffect(() => {
    setMounted(true);
    const path = window.location.pathname;
    const match = navItems.find((item) => item.href === path);
    if (match) setActiveItem(match.id);
    if (path.startsWith("/u/")) setActiveItem("profile");
    if (path.startsWith("/admin")) setActiveItem("admin");
  }, [username]);

  useEffect(() => {
    if (!user?.id) return;

    async function loadProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url, role")
        .eq("id", user.id)
        .single();

      if (data) {
        setFullName(data.full_name || "");
        setUsername(data.username || "");
        setRole(data.role || "");
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
      className="z-50 px-6 py-4 bg-white"
    >
      <div className="max-w-full w-full px-5 mx-auto flex items-center justify-between md:grid md:grid-cols-3">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3">
          <span className="font-ppMondwest text-[18px] text-textPrimary">
            Your next tale
          </span>
        </a>

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center justify-center gap-1">
          {navItems
            .filter((item) => {
              if (item.adminOnly) return isLoggedIn && isAdmin;
              return isLoggedIn || item.id === "discover";
            })
            .map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  if (item.id === "profile") {
                    e.preventDefault();
                    router.push(item.href);
                  }
                  setActiveItem(item.id);
                }}
                className={cn(
                  "px-4 py-2 font-departureMono uppercase text-[11px] rounded-[8px] transition-colors",
                  activeItem === item.id
                    ? "bg-[#f4f4f4] text-textPrimary"
                    : "text-textSecondary hover:bg-[#f4f4f4] hover:text-textPrimary"
                )}
              >
                {item.label}
              </a>
            ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center justify-end gap-3">
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
                  {username && (
                    <DropdownMenuItem
                      className="font-departureMono uppercase text-[11px] cursor-pointer"
                      onClick={() => {
                        window.location.href = `/u/${encodeURIComponent(username)}`;
                      }}
                    >
                      My Profile
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem
                      className="font-departureMono uppercase text-[11px] cursor-pointer"
                      onClick={() => {
                        window.location.href = "/admin";
                      }}
                    >
                      Admin Dashboard
                    </DropdownMenuItem>
                  )}
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
                  className="hidden md:flex h-9 px-4 items-center justify-center font-departureMono uppercase text-[11px] text-textSecondary rounded-[8px] bg-white border border-border hover:bg-[#f4f4f4] transition-colors"
                >
                  Sign In
                </a>
                <a
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
              {navItems
                .filter((item) => {
                  if (item.adminOnly) return isLoggedIn && isAdmin;
                  return isLoggedIn || item.id === "discover";
                })
                .map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={(e) => {
                      if (item.id === "profile") {
                        e.preventDefault();
                        router.push(item.href);
                      }
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
                        <a
                          href={`/u/${encodeURIComponent(username)}`}
                          className="px-4 py-3 font-departureMono uppercase text-[11px] text-textSecondary rounded-[6px] hover:bg-[#f4f4f4] hover:text-textPrimary transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          My Profile
                        </a>
                      )}
                      {isAdmin && (
                        <a
                          href="/admin"
                          className="px-4 py-3 font-departureMono uppercase text-[11px] text-textSecondary rounded-[6px] hover:bg-[#f4f4f4] hover:text-textPrimary transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Admin Dashboard
                        </a>
                      )}
                      <a
                        href="/account"
                        className="px-4 py-3 font-departureMono uppercase text-[11px] text-textSecondary rounded-[6px] hover:bg-[#f4f4f4] hover:text-textPrimary transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Account Settings
                      </a>
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
                      <a
                        href="/login"
                        className="w-full h-10 flex items-center justify-center font-departureMono uppercase text-[11px] text-textPrimary rounded-[8px] bg-[#f4f4f4] hover:bg-[#eaeaea] transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Sign In
                      </a>
                      <a
                        href="/get-started"
                        className="w-full h-10 flex items-center justify-center gap-2 font-departureMono uppercase text-[11px] text-white rounded-[8px] bg-[#1f1f1f] hover:bg-[#353535] transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
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
                      </a>
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
