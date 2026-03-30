"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

export default function HeroNew() {
  return (
    <div className="relative w-full min-h-[520px] overflow-hidden bg-white flex flex-col items-center justify-center pt-32 pb-24 px-6">
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-6 text-center max-w-[800px]">
        {/* Badge */}
        {/* <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-full"
        >
          <span className="w-2 h-2 rounded-full bg-[#2BD26B] animate-pulse" />
          <span className="font-departureMono uppercase text-[10px] text-textSecondary">
            Signups open now
          </span>
        </motion.div> */}

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.1
          }}
          className="text-textPrimary text-[40px] sm:text-[48px] leading-[1.1] font-ppMondwest"
        >
          Discover new books, fill your personal bookcase
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.15
          }}
          className="text-textSecondary text-[16px] leading-[1.5] max-w-[640px] font-ppMondwest"
        >
          Create custom bookshelves, discover hand-curated fantasy and sci-fi
          reads, and share your collection with fellow book lovers.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.2
          }}
          className="flex flex-col sm:flex-row items-center gap-3 mt-2"
        >
          <Button className="h-12 px-6 text-[13px]">
            Start Building
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-1"
            >
              <path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" />
            </svg>
          </Button>
        </motion.div>

        {/* Stats */}
        {/* <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-6 mt-4"
        >
          <div className="flex flex-col items-center">
            <span className="font-departureMono text-[18px] text-textPrimary">
              2,400+
            </span>
            <span className="font-departureMono uppercase text-[9px] text-textSecondary">
              Curated Books
            </span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col items-center">
            <span className="font-departureMono text-[18px] text-textPrimary">
              12k+
            </span>
            <span className="font-departureMono uppercase text-[9px] text-textSecondary">
              Shelves Created
            </span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col items-center">
            <span className="font-departureMono text-[18px] text-textPrimary">
              8k+
            </span>
            <span className="font-departureMono uppercase text-[9px] text-textSecondary">
              Book Lovers
            </span>
          </div>
        </motion.div> */}
      </div>
    </div>
  );
}
