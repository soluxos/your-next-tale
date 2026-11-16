import Link from "next/link";
import { cn } from "@/lib/utils";

const TITLE = "font-ppMondwest text-ink text-[28px] sm:text-[34px] leading-[1.05]";
// One line on what the section is: a sentence, so it reads as one (mono
// capitals are for labels and controls).
export const DESCRIPTION = "font-ppMondwest text-[16px] sm:text-[17px] leading-snug text-textSecondary";

/**
 * Home's section headings, so every section opens the same way: a title, one
 * line on what it is, and its action on the right.
 *
 * stackUntil:
 *   "none"  a short link, kept on the title's line at every size, with the
 *           description running full width beneath
 *   "sm"    the action drops below the title on phones
 *   "lg"    wide actions (a segmented control) go beside it only on large screens
 */
export default function SectionHeading({ id, title, description, action, stackUntil = "sm", className }) {
  if (stackUntil === "none") {
    return (
      <div className={cn("mb-8 sm:mb-10", className)}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 id={id} className={TITLE}>
            {title}
          </h2>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {description && <p className={cn("mt-3", DESCRIPTION)}>{description}</p>}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "mb-8 sm:mb-10 flex flex-col gap-5 lg:gap-10",
        stackUntil === "lg"
          ? "lg:flex-row lg:items-end lg:justify-between"
          : "sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h2 id={id} className={TITLE}>
          {title}
        </h2>
        {description && <p className={cn("mt-3", DESCRIPTION)}>{description}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

/** "See shelf ›": a quiet link to the full list, with room for a thumb. */
export function SectionLink({ href, children, className }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 min-h-10 label text-textPrimary hover:text-ink underline-offset-4 hover:underline",
        className
      )}
    >
      {children}
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
