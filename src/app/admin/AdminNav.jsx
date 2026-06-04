"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Dashboard", href: "/admin" },
  { label: "Books", href: "/admin/books" },
  { label: "Components", href: "/admin/components" },
  { label: "Seed Books", href: "/admin/seed-books" },
  { label: "Add Book", href: "/admin/add-new-book" },
  { label: "Fix Dupes", href: "/admin/dedupe" },
  { label: "Scrape Test", href: "/admin/scrape-testing" }
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="AdminNav flex flex-col gap-1">
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "font-departureMono uppercase text-[11px] rounded-[8px] px-3 py-2 transition-colors",
            pathname === link.href
              ? "bg-[#f0f0f0] text-textPrimary"
              : "text-textSecondary hover:text-textPrimary hover:bg-[#f8f8f8]"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
