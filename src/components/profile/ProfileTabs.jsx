"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// useLayoutEffect warns during the server render; the effect only matters in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The sticky tab strip under a profile header — shelves on the bookcase,
 * Bookcase / Followers / Following on the people pages, so both read alike.
 *
 * tabs: [{ key, href, label, count?, icon? }]. On narrow screens the strip
 * scrolls sideways: the active tab is kept centred and the edges fade where
 * there's more to scroll to.
 */
export default function ProfileTabs({ tabs, activeKey, label }) {
  const navRef = useRef(null);
  const [fade, setFade] = useState({ left: false, right: false });
  const firstCentre = useRef(true);

  // Show a fade on whichever edge has more tabs past it.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => {
      const max = nav.scrollWidth - nav.clientWidth;
      setFade((prev) => {
        const next = { left: nav.scrollLeft > 2, right: nav.scrollLeft < max - 2 };
        return prev.left === next.left && prev.right === next.right ? prev : next;
      });
    };
    update();
    nav.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => {
      nav.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [tabs.length]);

  // Keep the active tab centred (horizontally only, so the page never
  // jumps) — instantly on first paint, smoothly when you switch.
  useIsoLayoutEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector('[aria-current="page"]');
    if (!nav || !el || nav.scrollWidth <= nav.clientWidth) return;
    const left = el.offsetLeft - (nav.clientWidth - el.clientWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({ left, behavior: firstCentre.current || reduce ? "auto" : "smooth" });
    firstCentre.current = false;
  }, [activeKey, tabs.length]);

  return (
    <div className="sticky top-16 z-[30] bg-white border-b border-line">
      <div className="relative">
        <nav ref={navRef} aria-label={label} className="page-x mx-auto max-w-[1600px] flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                prefetch={true}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // The first tab starts on the page gutter, in line with the logo.
                  "relative shrink-0 h-12 px-3 first:pl-0 first:after:left-0 inline-flex items-center gap-2 label whitespace-nowrap transition-colors",
                  "after:absolute after:left-2 after:right-2 after:bottom-0 after:h-[2px] after:rounded-full after:transition-colors",
                  active
                    ? "text-ink after:bg-ink"
                    : "text-textSecondary hover:text-ink after:bg-transparent hover:after:bg-line"
                )}
              >
                {tab.icon}
                {tab.label}
                {typeof tab.count === "number" && (
                  <span
                    className={cn(
                      "min-w-[22px] h-5 px-1.5 rounded-full inline-flex items-center justify-center tabular-nums text-[11px] leading-none",
                      active ? "bg-ink text-white" : "bg-paper-3 text-ink"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent transition-opacity duration-150",
            fade.left ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-white via-white/80 to-transparent transition-opacity duration-150",
            fade.right ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </div>
  );
}
