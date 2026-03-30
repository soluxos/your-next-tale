export default function ComponentsPage() {
  return (
    <div className="space-y-12 max-w-4xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-ppMondwest text-white text-[32px]">
          Component Library
        </h1>
        <p className="font-departureMono uppercase text-[11px] text-white/40 mt-2">
          Design system reference — all UI patterns in one place
        </p>
      </div>

      {/* ────────────────────────────────────────────
          SECTION 1 — Typography
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">Typography</h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            All fonts and sizes in active use
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6 space-y-6">
          {/* ppMondwest sizes */}
          <div className="space-y-3">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              font-ppMondwest
            </p>
            {[
              {
                size: "text-[40px]",
                label: "text-[40px]",
                text: "The fantasy shelf"
              },
              {
                size: "text-[32px]",
                label: "text-[32px]",
                text: "Your Next Tale"
              },
              {
                size: "text-[24px]",
                label: "text-[24px]",
                text: "Page Heading"
              },
              {
                size: "text-[18px]",
                label: "text-[18px]",
                text: "Section Heading"
              }
            ].map(({ size, label, text }) => (
              <div key={label} className="flex items-baseline gap-4">
                <span
                  className={`font-ppMondwest ${size} text-textPrimary leading-none`}
                >
                  {text}
                </span>
                <span className="font-departureMono text-[10px] text-textSecondary shrink-0">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="h-px bg-border" />
          {/* departureMono sizes */}
          <div className="space-y-3">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              font-departureMono uppercase
            </p>
            {[
              { size: "text-[12px]", label: "text-[12px]" },
              { size: "text-[11px]", label: "text-[11px]" },
              { size: "text-[10px]", label: "text-[10px]" },
              { size: "text-[9px]", label: "text-[9px]" }
            ].map(({ size, label }) => (
              <div key={label} className="flex items-center gap-4">
                <span
                  className={`font-departureMono uppercase ${size} text-textPrimary`}
                >
                  UI Label / Button Text / Nav Item
                </span>
                <span className="font-departureMono text-[10px] text-textSecondary shrink-0">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="h-px bg-border" />
          {/* Inter body */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              font-inter — body only
            </p>
            <p className="font-inter text-[16px] text-textPrimary leading-relaxed">
              Body text at 16px. Used only for long-form paragraphs,
              descriptions, and editorial content.
            </p>
            <p className="font-inter text-[14px] text-textSecondary leading-relaxed">
              Smaller body text at 14px. Profile bios, secondary descriptions.
            </p>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 2 — Buttons
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">Buttons</h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Four canonical variants — full (h-44px) and compact (h-36px)
          </p>
        </div>

        {/* On white card */}
        <div className="bg-white rounded-[8px] p-6 space-y-6">
          {/* Primary */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              Primary — dark filled
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <button className="bg-[#1f1f1f] text-white hover:bg-[#353535] font-departureMono uppercase text-[11px] rounded-[8px] px-4 h-[44px] transition-colors">
                Full size
              </button>
              <button className="bg-[#1f1f1f] text-white hover:bg-[#353535] font-departureMono uppercase text-[11px] rounded-[8px] px-4 h-[36px] transition-colors">
                Compact
              </button>
            </div>
          </div>
          {/* Secondary */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              Secondary — outlined
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <button className="bg-white text-textPrimary border border-border hover:bg-[#f4f4f4] font-departureMono uppercase text-[11px] rounded-[8px] px-4 h-[44px] transition-colors">
                Full size
              </button>
              <button className="bg-white text-textPrimary border border-border hover:bg-[#f4f4f4] font-departureMono uppercase text-[11px] rounded-[8px] px-4 h-[36px] transition-colors">
                Compact
              </button>
            </div>
          </div>
          {/* Tertiary */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              Tertiary — ghost
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <button className="bg-transparent text-textSecondary hover:text-textPrimary font-departureMono uppercase text-[11px] rounded-[8px] px-3 h-[36px] transition-colors">
                Ghost button
              </button>
            </div>
          </div>
          {/* Destructive */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              Destructive — delete actions
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <button className="bg-transparent text-red-500 hover:bg-red-50 border border-red-200 font-departureMono uppercase text-[11px] rounded-[8px] px-4 h-[36px] transition-colors">
                Delete
              </button>
            </div>
          </div>
          {/* Icon-only */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              Icon-only — w-8/w-7
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <button
                className="w-8 h-8 rounded-[6px] hover:bg-[#f4f4f4] flex items-center justify-center transition-colors"
                aria-label="Edit"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-textSecondary"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                className="w-7 h-7 rounded-[6px] hover:bg-[#f4f4f4] flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-textSecondary"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* On blue background */}
        <div className="space-y-2">
          <p className="font-departureMono uppercase text-[10px] text-white/40">
            Admin variants — on blue
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="bg-white text-[#0D00FF] hover:bg-[#e8e8e8] font-departureMono uppercase text-[11px] rounded-[8px] px-4 h-[44px] transition-colors">
              Submit
            </button>
            <button className="border border-white/30 text-white hover:bg-white/5 font-departureMono uppercase text-[11px] rounded-[8px] px-4 h-[36px] transition-colors">
              Secondary
            </button>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 3 — Form Inputs
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">
            Form Inputs
          </h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Text input, textarea, select — all with canonical label above
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6 space-y-5">
          {/* Text input empty */}
          <div className="space-y-1">
            <label className="font-departureMono uppercase text-[10px] text-textSecondary block">
              Book Title
            </label>
            <input
              type="text"
              placeholder="Enter book title..."
              className="w-full border border-border rounded-[8px] px-3 h-9 font-departureMono text-[12px] text-textPrimary bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary"
            />
          </div>
          {/* Text input with value */}
          <div className="space-y-1">
            <label className="font-departureMono uppercase text-[10px] text-textSecondary block">
              Author
            </label>
            <input
              type="text"
              defaultValue="Brandon Sanderson"
              className="w-full border border-border rounded-[8px] px-3 h-9 font-departureMono text-[12px] text-textPrimary bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary"
            />
          </div>
          {/* Textarea */}
          <div className="space-y-1">
            <label className="font-departureMono uppercase text-[10px] text-textSecondary block">
              Description
            </label>
            <textarea
              placeholder="Write a description..."
              rows={3}
              className="w-full border border-border rounded-[8px] px-3 py-2 font-departureMono text-[12px] text-textPrimary bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary resize-none"
            />
          </div>
          {/* Select */}
          <div className="space-y-1">
            <label className="font-departureMono uppercase text-[10px] text-textSecondary block">
              Shelf
            </label>
            <select className="w-full border border-border rounded-[8px] px-3 h-9 font-departureMono text-[12px] text-textPrimary bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary">
              <option>Read</option>
              <option>Currently Reading</option>
              <option>Want to Read</option>
            </select>
          </div>
          <p className="font-departureMono uppercase text-[10px] text-textSecondary">
            Focus: ring-1 ring-textPrimary
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 4 — Badges and Tags
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">
            Badges &amp; Tags
          </h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Four semantic badge variants
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="font-departureMono uppercase text-[10px] px-2 py-0.5 rounded-[6px] bg-[#f4f4f4] text-textSecondary">
              New
            </span>
            <span className="font-departureMono uppercase text-[10px] px-2 py-0.5 rounded-[6px] bg-amber-50 text-amber-600">
              Incomplete
            </span>
            <span className="font-departureMono uppercase text-[10px] px-2 py-0.5 rounded-[6px] bg-red-50 text-red-500">
              Error
            </span>
            <span className="font-departureMono uppercase text-[10px] px-2 py-0.5 rounded-[6px] bg-green-50 text-green-600">
              Saved
            </span>
            <span className="font-departureMono uppercase text-[9px] px-2 py-0.5 rounded-[6px] bg-[#f4f4f4] text-textSecondary">
              Default (9px)
            </span>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 5 — Navigation Patterns
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">
            Navigation Patterns
          </h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Shelf tab bar — active vs inactive state
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6">
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {["Read", "Want to Read", "Did Not Finish"].map((tab, i) => (
              <span
                key={tab}
                className={`px-3 py-2 font-departureMono uppercase text-[11px] whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                  i === 0
                    ? "border-textPrimary text-textPrimary"
                    : "border-transparent text-textSecondary hover:text-textPrimary hover:border-border"
                }`}
              >
                {tab}
              </span>
            ))}
          </nav>
          <div className="h-px bg-border mt-0" />
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 6 — Sheet / Panel Header
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">
            Sheet / Panel Header
          </h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Standard header pattern used in BookDetailPanel and AddBookDrawer
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-ppMondwest text-[20px] text-textPrimary leading-tight">
                The Name of the Wind
              </h3>
              <p className="font-departureMono uppercase text-[10px] text-textSecondary mt-1">
                Patrick Rothfuss · Fantasy
              </p>
            </div>
            <button
              className="w-8 h-8 rounded-[6px] hover:bg-[#f4f4f4] flex items-center justify-center transition-colors shrink-0"
              aria-label="Close panel"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-textSecondary"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 7 — Confirmation / Inline States
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">
            Inline Feedback States
          </h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Saved, warning, and error states
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6 space-y-4">
          {/* Saved */}
          <div className="flex items-center gap-2">
            <label className="font-departureMono uppercase text-[10px] text-textSecondary">
              Rating
            </label>
            <span className="font-departureMono text-[9px] text-green-600">
              Saved ✓
            </span>
          </div>
          {/* Warning */}
          <div className="font-departureMono uppercase text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2">
            Some book details are missing but it has been added to your shelf.
          </div>
          {/* Error */}
          <div className="font-departureMono uppercase text-[10px] text-red-500 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
            Failed to add book. Please try again.
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 8 — Avatar
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">Avatar</h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Three sizes — initials fallback
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6">
          <div className="flex items-end gap-6">
            {[
              { size: "h-8 w-8", label: "h-8 w-8 — nav", text: "11px" },
              { size: "h-10 w-10", label: "h-10 w-10 — list", text: "12px" },
              { size: "h-16 w-16", label: "h-16 w-16 — profile", text: "16px" }
            ].map(({ size, label, text }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div
                  className={`${size} rounded-full border border-border bg-[#f4f4f4] flex items-center justify-center`}
                >
                  <span
                    className={`font-departureMono text-[${text}] text-textPrimary`}
                  >
                    YN
                  </span>
                </div>
                <p className="font-departureMono uppercase text-[9px] text-textSecondary text-center">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 9 — Dividers and Separators
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">
            Dividers &amp; Separators
          </h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Horizontal rules, vertical separators, admin section dividers
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6 space-y-4">
          <div>
            <p className="font-departureMono uppercase text-[10px] text-textSecondary mb-3">
              Horizontal rule
            </p>
            <div className="w-full h-px bg-border" />
          </div>
          <div>
            <p className="font-departureMono uppercase text-[10px] text-textSecondary mb-3">
              Vertical separator (inline)
            </p>
            <div className="flex items-center gap-3">
              <span className="font-departureMono uppercase text-[11px] text-textSecondary">
                Item A
              </span>
              <div className="w-[1px] h-6 bg-border" />
              <span className="font-departureMono uppercase text-[11px] text-textSecondary">
                Item B
              </span>
              <div className="w-[1px] h-6 bg-border" />
              <span className="font-departureMono uppercase text-[11px] text-textSecondary">
                Item C
              </span>
            </div>
          </div>
        </div>
        <div>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mb-3">
            Admin section divider — on blue
          </p>
          <div className="border-b border-white/10 pb-3">
            <p className="font-ppMondwest text-white text-[18px]">
              Section Title
            </p>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 10 — Icon Buttons
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">
            Icon Buttons
          </h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Two sizes — pencil, trash, close
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6 space-y-4">
          {/* w-8 h-8 */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              w-8 h-8 rounded-[6px]
            </p>
            <div className="flex gap-3">
              <button
                className="w-8 h-8 rounded-[6px] hover:bg-[#f4f4f4] flex items-center justify-center transition-colors border border-border"
                aria-label="Edit"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-textSecondary"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>
              <button
                className="w-8 h-8 rounded-[6px] hover:bg-red-50 flex items-center justify-center transition-colors border border-border hover:text-red-500"
                aria-label="Delete"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-textSecondary"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
              <button
                className="w-8 h-8 rounded-[6px] hover:bg-[#f4f4f4] flex items-center justify-center transition-colors border border-border"
                aria-label="Close"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-textSecondary"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          {/* w-7 h-7 */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              w-7 h-7 rounded-[6px]
            </p>
            <div className="flex gap-3">
              <button
                className="w-7 h-7 rounded-[6px] hover:bg-[#f4f4f4] flex items-center justify-center transition-colors border border-border"
                aria-label="Edit"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-textSecondary"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>
              <button
                className="w-7 h-7 rounded-[6px] hover:bg-red-50 flex items-center justify-center transition-colors border border-border"
                aria-label="Delete"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-textSecondary"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
              <button
                className="w-7 h-7 rounded-[6px] hover:bg-[#f4f4f4] flex items-center justify-center transition-colors border border-border"
                aria-label="Close"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-textSecondary"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 11 — Loading and Empty States
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">
            Loading &amp; Empty States
          </h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            Spinner and empty shelf pattern
          </p>
        </div>
        <div className="bg-white rounded-[8px] p-6 space-y-6">
          {/* Spinner */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              Loading spinner
            </p>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-border border-t-textPrimary animate-spin" />
              <span className="font-departureMono uppercase text-[10px] text-textSecondary">
                Loading...
              </span>
            </div>
          </div>
          {/* Empty state */}
          <div className="space-y-2">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">
              Empty state
            </p>
            <div className="flex flex-col items-center justify-center gap-3 bg-[#d5d5d5] rounded-[8px] min-h-[160px] p-8">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#999]"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <p className="font-departureMono uppercase text-[10px] text-[#999] pb-5">
                No books on this shelf yet
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 12 — Colour Palette
      ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-2">
          <h2 className="font-ppMondwest text-white text-[22px]">
            Colour Palette
          </h2>
          <p className="font-departureMono uppercase text-[10px] text-white/40 mt-1">
            All design system colour tokens
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          {[
            { bg: "bg-[#565656]", label: "textPrimary", hex: "#565656" },
            { bg: "bg-[#757190]", label: "textSecondary", hex: "#757190" },
            { bg: "bg-[#DDDDDD]", label: "border", hex: "#DDDDDD" },
            { bg: "bg-[#F0F0F0]", label: "bookLightDark", hex: "#F0F0F0" },
            { bg: "bg-[#F8F8F8]", label: "bookLightLight", hex: "#F8F8F8" },
            { bg: "bg-[#0D00FF]", label: "Admin Blue", hex: "#0D00FF" },
            { bg: "bg-[#1f1f1f]", label: "Btn Primary", hex: "#1f1f1f" },
            { bg: "bg-[#353535]", label: "Btn Hover", hex: "#353535" },
            { bg: "bg-[#f4f4f4]", label: "Hover bg", hex: "#f4f4f4" }
          ].map(({ bg, label, hex }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div
                className={`w-16 h-16 rounded-[8px] ${bg} border border-white/20`}
              />
              <div className="text-center">
                <p className="font-departureMono uppercase text-[10px] text-white/70">
                  {label}
                </p>
                <p className="font-departureMono text-[9px] text-white/40">
                  {hex}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
