"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";

export default function HeroNew() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!user;
  const username = profile?.username;
  return (
    <div className="HeroNew relative w-full bg-white flex flex-col items-center justify-center pt-36 pb-24 px-6">
      <div className="flex flex-col items-center gap-5 text-center max-w-[680px]">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <svg
            width="24"
            height="20"
            viewBox="0 0 24 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect y="2" width="2" height="15" fill="#565656" />
            <rect x="11" y="4" width="2" height="15" fill="#565656" />
            <rect x="22" y="2" width="2" height="15" fill="#565656" />
            <rect x="1" y="1" width="2" height="2" fill="#565656" />
            <rect x="21" y="1" width="2" height="2" fill="#565656" />
            <rect x="8" y="1" width="2" height="2" fill="#565656" />
            <rect x="8" y="17" width="2" height="2" fill="#565656" />
            <rect x="14" y="1" width="2" height="2" fill="#565656" />
            <rect x="14" y="17" width="2" height="2" fill="#565656" />
            <rect x="9" y="2" width="2" height="2" fill="#565656" />
            <rect x="10" y="17" width="1" height="3" fill="#565656" />
            <rect x="11" y="3" width="1" height="2" fill="#565656" />
            <rect x="12" y="3" width="1" height="2" fill="#565656" />
            <rect x="12" y="19" width="1" height="1" fill="#565656" />
            <rect x="11" y="19" width="1" height="1" fill="#565656" />
            <rect x="13" y="2" width="2" height="2" fill="#565656" />
            <rect x="13" y="17" width="1" height="3" fill="#565656" />
            <rect x="2" width="6" height="2" fill="#565656" />
            <rect x="2" y="16" width="7" height="2" fill="#565656" />
            <rect x="16" width="6" height="2" fill="#565656" />
            <rect x="15" y="16" width="7" height="2" fill="#565656" />
            <rect x="2" y="15" width="1" height="1" fill="#565656" />
            <rect x="21" y="15" width="1" height="1" fill="#565656" />
            <rect x="14" y="8" width="1" height="1" fill="#565656" />
            <rect x="15" y="7" width="1" height="1" fill="#565656" />
            <rect x="20" y="7" width="1" height="1" fill="#565656" />
            <rect x="16" y="6" width="4" height="1" fill="#565656" />
            <rect x="14" y="7" width="1" height="1" fill="#565656" />
            <rect x="15" y="6" width="1" height="1" fill="#565656" />
            <rect x="20" y="6" width="1" height="1" fill="#565656" />
            <rect x="16" y="5" width="4" height="1" fill="#565656" />
            <rect
              width="1"
              height="1"
              transform="matrix(-1 0 0 1 10 8)"
              fill="#565656"
            />
            <rect
              width="1"
              height="1"
              transform="matrix(-1 0 0 1 9 7)"
              fill="#565656"
            />
            <rect
              width="1"
              height="1"
              transform="matrix(-1 0 0 1 4 7)"
              fill="#565656"
            />
            <rect
              width="4"
              height="1"
              transform="matrix(-1 0 0 1 8 6)"
              fill="#565656"
            />
            <rect
              width="1"
              height="1"
              transform="matrix(-1 0 0 1 10 7)"
              fill="#565656"
            />
            <rect
              width="1"
              height="1"
              transform="matrix(-1 0 0 1 9 6)"
              fill="#565656"
            />
            <rect
              width="1"
              height="1"
              transform="matrix(-1 0 0 1 4 6)"
              fill="#565656"
            />
            <rect
              width="4"
              height="1"
              transform="matrix(-1 0 0 1 8 5)"
              fill="#565656"
            />
            <rect x="17" y="9" width="2" height="2" fill="#565656" />
            <rect x="5" y="9" width="2" height="2" fill="#565656" />
          </svg>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.08
          }}
          className="text-textPrimary text-[40px] sm:text-[52px] leading-[1.1] font-ppMondwest"
        >
          Discover books, build your personal bookcase
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.14
          }}
          className="text-textSecondary text-[15px] leading-[1.6] max-w-[520px] font-ppMondwest"
        >
          Create custom bookshelves, explore hand-curated reads, and share your
          collection with fellow book lovers.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.2
          }}
          className="flex flex-col sm:flex-row items-center gap-3 mt-1"
        >
          {isLoggedIn ? (
            <>
              <Button
                asChild
                className="h-11 px-6 text-[12px] font-departureMono uppercase tracking-wider"
              >
                <Link href={username ? `/u/${encodeURIComponent(username)}` : "/account"}>My Bookcase</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 px-6 text-[12px] font-departureMono uppercase tracking-wider"
              >
                <Link href="/feed">Feed</Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                asChild
                className="h-11 px-6 text-[12px] font-departureMono uppercase tracking-wider"
              >
                <Link href="/get-started">Get Started</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 px-6 text-[12px] font-departureMono uppercase tracking-wider"
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
