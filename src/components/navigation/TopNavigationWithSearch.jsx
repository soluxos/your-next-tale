"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export default function TopNavigation() {
  const [activeItem, setActiveItem] = useState("discover");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Close search when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setSearchOpen(false);
      }
    }

    if (searchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [searchOpen]);

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
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13.0964 20.3536L17.6262 22.4473L17.046 27.6527L8.94876 36.8282C4.2486 33.8023 0.898178 28.8615 0 23.108L13.0964 20.3536Z"
                fill="#15E3FF"
              />
              <path
                d="M25.183 25.94L31.2414 36.3789C27.992 38.6605 24.0331 40 19.7612 40C18.3744 40 17.0206 39.8587 15.7133 39.59L17.046 27.6527L20.4765 23.7656L25.183 25.94Z"
                fill="#348DFC"
              />
              <path
                d="M39.1022 14.881C39.5332 16.5143 39.763 18.2294 39.763 19.9982C39.763 24.1145 38.5192 27.9403 36.3874 31.1207L25.184 25.9405L22.5551 21.4123L25.8574 17.6692L39.1022 14.881Z"
                fill="#FD4873"
              />
              <path
                d="M17.046 27.6524L17.0458 27.6527L17.1686 26.552L17.046 27.6524Z"
                fill="#FFC700"
              />
              <path
                d="M20.132 0C26.1505 0.109415 31.5194 2.877 35.1148 7.17842L25.8561 17.6694L20.9792 18.6959L18.519 14.4574L20.132 0Z"
                fill="#FFC700"
              />
              <path
                d="M18.519 14.4574L17.9745 19.3269L13.0991 20.353L0.514709 14.5347C2.09964 8.94044 6.05794 4.3436 11.2327 1.9007L18.519 14.4574Z"
                fill="#00E7B9"
              />
            </svg>
          </div>
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
                      className="w-full bg-transparent border-none outline-none font-departureMono text-[12px] text-textPrimary placeholder:text-textSecondary"
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
                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded-[6px] hover:bg-white transition-colors"
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

          {/* Sign In Button */}
          <button className="hidden sm:flex h-9 px-4 items-center justify-center font-departureMono uppercase text-[11px] text-textSecondary rounded-[8px] bg-white border border-border hover:bg-[#f4f4f4] transition-colors">
            Sign In
          </button>

          {/* Get Started Button */}
          <button className="h-9 px-4 flex items-center justify-center gap-2 font-departureMono uppercase text-[11px] text-white rounded-[8px] bg-[#1f1f1f] hover:bg-[#353535] transition-colors">
            <span className="hidden sm:inline">Get Started</span>
            <span className="sm:hidden">Start</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" />
            </svg>
          </button>
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
