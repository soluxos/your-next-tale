"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

export default function HeroNew() {
  return (
    <div className="HeroNew relative w-full bg-white flex flex-col items-center justify-center pt-36 pb-24 px-6">
      <div className="flex flex-col items-center gap-5 text-center max-w-[680px]">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="font-departureMono uppercase text-[10px] text-textSecondary tracking-widest"
        >
          Create your personal bookcase
        </motion.p>

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
          <Button
            asChild
            className="h-11 px-6 text-[12px] font-departureMono uppercase tracking-wider"
          >
            <Link href="/register-interest">Get started</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 px-6 text-[12px] font-departureMono uppercase tracking-wider"
          >
            <Link href="/books">Browse books</Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
