/**
 * Reading statuses as readers see them. Shelf names come from the database
 * ("Currently Reading"); these are the sentence-case and short forms used in
 * prose, chips and buttons, plus one icon per status so they're told apart
 * at a glance rather than all reading as "✓ done".
 */
export const STATUS = {
  "currently-reading": { name: "Currently reading", short: "Reading" },
  "want-to-read": { name: "Want to read", short: "Want to read" },
  read: { name: "Read", short: "Read" },
  "did-not-finish": { name: "Did not finish", short: "Did not finish" }
};

/** Sentence-case name for a shelf, falling back to its own name. */
export function statusName(shelf) {
  return STATUS[shelf?.slug]?.name || shelf?.name || "";
}

const PATHS = {
  // Open book
  "currently-reading": (
    <>
      <path d="M8 4.2C6.6 3.2 4.6 2.8 2 2.8v9.6c2.6 0 4.6.4 6 1.4 1.4-1 3.4-1.4 6-1.4V2.8c-2.6 0-4.6.4-6 1.4z" />
      <path d="M8 4.2v9.6" />
    </>
  ),
  // Bookmark
  "want-to-read": <path d="M4 2.2h8v11.6l-4-3-4 3z" />,
  // Check
  read: <path d="M3 8.5l3 3 7-7" />,
  // Cross
  "did-not-finish": <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />,
  // Books on a shelf — a custom shelf, or no status yet
  shelf: (
    <>
      <path d="M2 13.8h12" />
      <path d="M3.6 13.8V4.2h2.6v9.6M6.2 13.8V2.6h2.6v11.2" />
      <path d="M9.8 4.6l2.4-.6 2 9.2-2.4.6z" />
    </>
  ),
  // Bookmark with a plus — one tap adds to Want to read
  "add-want": (
    <>
      <path d="M4 2.2h8v11.6l-4-3-4 3z" />
      <path d="M8 4.8v3.8M6.1 6.7h3.8" />
    </>
  ),
  // Plus on a shelf — opens the "which shelf?" menu
  add: <path d="M8 2.5v11M2.5 8h11" />
};

export default function StatusIcon({ slug, size = 14, className, strokeWidth }) {
  const paths = PATHS[slug] || PATHS.shelf;
  const heavy = slug === "read" || slug === "add" || slug === "did-not-finish";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? (heavy ? 2.2 : 1.6)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}
