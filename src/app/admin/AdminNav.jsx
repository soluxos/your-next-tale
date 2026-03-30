"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Dashboard", href: "/admin" },
  { label: "Components", href: "/admin/components" },
  { label: "Seed Books", href: "/admin/seed-books" },
  { label: "Add Book", href: "/admin/add-new-book" },
  { label: "Scrape Test", href: "/admin/scrape-testing" }
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navLinks.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={cn(
            "font-departureMono uppercase text-[11px] rounded-[8px] px-3 py-2 transition-colors",
            pathname === link.href
              ? "bg-white/10 text-white"
              : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
