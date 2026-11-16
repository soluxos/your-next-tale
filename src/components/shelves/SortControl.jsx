"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const SORT_OPTIONS = [
  { key: "user", label: "Custom order" },
  { key: "date_added", label: "Recently added" },
  { key: "finished", label: "Recently finished" },
  { key: "rating", label: "Highest rated" },
  { key: "short", label: "Shortest first" },
  { key: "long", label: "Longest first" },
  { key: "author", label: "Author A → Z" },
  { key: "az", label: "Title A → Z" },
  { key: "za", label: "Title Z → A" }
];

/** The sort options a shelf offers ("Custom order" only exists on real shelves). */
export function sortOptionsFor(allowCustomOrder = true) {
  return allowCustomOrder ? SORT_OPTIONS : SORT_OPTIONS.filter((o) => o.key !== "user");
}

/** Desktop sort menu. Phones pick a sort in the "Sort & filter" sheet instead. */
export default function SortControl({ value, onChange, allowCustomOrder = true, className }) {
  const options = sortOptionsFor(allowCustomOrder);
  const current = options.find((o) => o.key === value) || options[0];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={cn("btn btn-secondary btn-sm h-9 data-[state=open]:border-ink", className)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-textSecondary" aria-hidden="true">
          <path d="M3 6h18M7 12h10M11 18h2" />
        </svg>
        <span className="sr-only">Sort: </span>
        {current.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-textSecondary" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-52 p-1.5 rounded-[12px] z-[60]">
        <DropdownMenuLabel className="label !text-[10px] text-textSecondary font-normal">Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current.key} onValueChange={onChange}>
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.key} value={opt.key} className="label h-10 rounded-[6px] cursor-pointer">
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
