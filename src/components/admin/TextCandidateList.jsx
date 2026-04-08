"use client";

export default function TextCandidateList({
  candidates,
  field,
  currentValue,
  onSelect
}) {
  // Only show candidates that have a value for this field
  const relevant = candidates
    .map((c, i) => ({ candidate: c, index: i, value: c[field] }))
    .filter(({ value }) => value && value !== currentValue);

  if (!relevant.length) {
    return (
      <p className="font-departureMono uppercase text-[9px] text-textSecondary mt-1">
        No alternative values found
      </p>
    );
  }

  return (
    <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
      {relevant.map(({ candidate, index, value }) => (
        <button
          key={index}
          onClick={() =>
            onSelect(Array.isArray(value) ? value.join(", ") : String(value))
          }
          className="w-full text-left px-3 py-2 rounded-[6px] border border-border
                     hover:border-[#1f1f1f] hover:bg-[#fafafa] transition-all"
        >
          <p
            className="font-departureMono text-[10px] text-textPrimary line-clamp-2
                        leading-relaxed"
          >
            {Array.isArray(value) ? value.join(", ") : String(value)}
          </p>
          <p className="font-departureMono uppercase text-[8px] text-textSecondary mt-0.5">
            {candidate.source} · {candidate.isbn_13 || candidate.isbn_10 || ""}
          </p>
        </button>
      ))}
    </div>
  );
}
