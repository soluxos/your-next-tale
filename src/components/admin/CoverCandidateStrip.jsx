"use client";

export default function CoverCandidateStrip({
  candidates,
  selectedUrl,
  onSelect
}) {
  // Flatten all cover_urls from all candidates into one strip
  const allCovers = candidates
    .flatMap((c) =>
      c.cover_urls.map((url) => ({ url, label: c.isbn_13 || c.title }))
    )
    .filter((c) => c.url);

  if (!allCovers.length) {
    return (
      <p className="font-departureMono uppercase text-[9px] text-textSecondary mt-2">
        No covers found from ISBNdb
      </p>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mt-2 scrollbar-thin">
      {allCovers.map(({ url, label }, i) => (
        <button
          key={i}
          onClick={() => onSelect(url)}
          title={label}
          className={`
              shrink-0 w-14 h-20 rounded-[6px] overflow-hidden border-2 transition-all
              ${
                selectedUrl === url
                  ? "border-[#1f1f1f] scale-105 shadow-md"
                  : "border-transparent hover:border-[#d1d5db]"
              }
            `}
        >
          <img
            src={url}
            alt={label}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.parentElement.style.display = "none";
            }}
          />
        </button>
      ))}
    </div>
  );
}
