"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Preview() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full bg-[#0c0c0c] flex flex-col items-center justify-center px-4 relative overflow-hidden rounded-none">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)"
        }}
      />

      {/* Subtle vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          background:
            "radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.4) 100%)"
        }}
      />

      {/* Floating sparkles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-[10px] pointer-events-none z-10"
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            color: [
              "#FFC700",
              "#15E3FF",
              "#FD4873",
              "#00E7B9",
              "#348DFC",
              "#9B5DE5"
            ][i]
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.6, 0],
            scale: [0.5, 1, 0.5],
            y: [0, -20, 0]
          }}
          transition={{
            duration: 3,
            delay: i * 0.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          ✦
        </motion.div>
      ))}

      {/* Animated bookshelf at the bottom - full width */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        {/* Shelf */}
        <div className="absolute bottom-0 left-0 right-0 h-[12px] bg-[#1a1a1a] z-10" />
        <div className="absolute bottom-[12px] left-0 right-0 h-[4px] bg-[#2a2a2a] z-10" />

        {/* Books container - aligned to bottom */}
        <div className="flex items-end gap-[6px] w-full pb-[16px]">
          {[...Array(60)].map((_, i) => {
            const heights = [
              70, 55, 85, 50, 65, 78, 58, 72, 62, 80, 68, 54, 76, 60, 82, 56,
              74, 64, 88, 52
            ];
            const colors = [
              "#15E3FF",
              "#348DFC",
              "#FD4873",
              "#FFC700",
              "#00E7B9",
              "#9B5DE5",
              "#F15BB5",
              "#00BBF9",
              "#00F5D4",
              "#FEE440"
            ];
            return (
              <motion.div
                key={i}
                className="rounded-t-sm flex-1 min-w-0"
                style={{
                  backgroundColor: colors[i % colors.length],
                  height: `${heights[i % heights.length]}px`,
                  boxShadow: `0 0 15px ${colors[i % colors.length]}30`
                }}
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                  delay: 0.2 + i * 0.015
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <motion.div
        className="w-full max-w-[480px] flex flex-col items-center text-center z-10 -mt-32"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Logo with glow */}
        <motion.div
          className="mb-8 relative"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.1
          }}
        >
          <div className="absolute inset-0 blur-2xl opacity-40 bg-gradient-to-r from-[#15E3FF] via-[#FFC700] to-[#FD4873] rounded-full scale-150" />
          <img
            src="/icons/logo.svg"
            alt="Your Next Tale"
            className="w-16 h-16 relative z-10"
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center w-full"
            >
              {/* Headline */}
              <h1 className="text-white text-[36px] leading-[1.2] font-ppMondwest mb-3">
                Your next great read
                <br />
                <span className="text-[#757190]">is almost here</span>
              </h1>

              {/* Tagline with color accents */}
              <p className="text-[#757190] text-[15px] leading-[1.6] font-sans mb-8 flex items-center gap-2 flex-wrap justify-center">
                <span className="text-[#FFC700]">✦</span>
                Hand-curated fantasy & sci-fi
                <span className="text-[#FD4873]">♥</span>
                Updated weekly
                <span className="text-[#15E3FF]">♦</span>
              </p>

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="w-full flex flex-col gap-3"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 px-5 text-[15px] bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-[#555] focus:border-[#FFC700] focus:ring-[#FFC700] rounded-lg"
                  required
                />
                <Button
                  type="submit"
                  className="h-14 w-full text-[13px] rounded-lg bg-white text-black hover:bg-[#f0f0f0]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      JOINING...
                    </motion.span>
                  ) : (
                    "JOIN THE WAITLIST"
                  )}
                </Button>
              </form>

              {/* Trust text */}
              <p className="text-[#555] text-[12px] mt-5 font-departureMono uppercase tracking-wide">
                No spam. Just good books.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="flex flex-col items-center"
            >
              {/* Success checkmark */}
              <motion.div
                className="w-20 h-20 rounded-full bg-[#00E7B9] flex items-center justify-center mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 15,
                  delay: 0.1
                }}
              >
                <motion.svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0c0c0c"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </motion.svg>
              </motion.div>

              <h1 className="text-white text-[36px] leading-[1.2] font-ppMondwest mb-3">
                You're on the list
                <span className="text-[#FFC700]"> ✦</span>
              </h1>

              <p className="text-[#757190] text-[15px] leading-[1.6] font-sans max-w-[360px]">
                We'll send updates to{" "}
                <span className="text-[#15E3FF]">{email}</span> when we're ready
                to launch.
              </p>

              <motion.div
                className="mt-8 px-5 py-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-[#555] text-[11px] font-departureMono uppercase tracking-wide">
                  In the meantime
                </p>
                <p className="text-white text-[13px] font-departureMono uppercase mt-1">
                  Tell your bookworm friends
                  <span className="text-[#FD4873]"> ♥</span>
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
