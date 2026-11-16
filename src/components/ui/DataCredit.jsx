import { cn } from "@/lib/utils";

const SOURCES = [
  { label: "Hardcover", href: "https://hardcover.app" },
  { label: "Open Library", href: "https://openlibrary.org" },
  { label: "Bookshop.org", href: "https://bookshop.org" },
  { label: "Seattle Public Library", href: "https://data.seattle.gov/d/tmmm-ytt6" }
];

/**
 * Where the popularity rankings come from. Hardcover's terms ask for the
 * credit wherever its data shows; the others get one too.
 */
export default function DataCredit({ className }) {
  return (
    <p className={cn("text-[13px] leading-5 text-textSecondary", className)}>
      Rankings draw on reader data from{" "}
      {SOURCES.map((s, i) => (
        <span key={s.label}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-line underline-offset-[3px] hover:text-ink hover:decoration-ink rounded-[2px] focus-ring"
          >
            {s.label}
          </a>
          {i < SOURCES.length - 2 ? ", " : i === SOURCES.length - 2 ? " and " : "."}
        </span>
      ))}
    </p>
  );
}
