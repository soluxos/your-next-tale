// NOTE: This component is unused. Nav items are rendered in TopNavigation.jsx.
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

export default function CenterNav() {
  {
    /* Search Dropdown */
  }
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
              {["Fantasy", "Sci-Fi", "New Releases", "Popular"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(tag)}
                  className="px-3 py-1.5 font-departureMono uppercase text-[10px] text-textSecondary bg-[#f4f4f4] hover:bg-[#eaeaea] rounded-[6px] transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>;
}
