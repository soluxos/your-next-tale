"use client";
import TextCandidateList from "./TextCandidateList";

export default function AdminFieldRow({
  label,
  field,
  value,
  onChange,
  candidates,
  multiline = false,
  type = "text"
}) {
  return (
    <div className="mb-4">
      <label className="block font-departureMono uppercase text-[9px] text-textSecondary mb-1">
        {label}
      </label>

      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full font-departureMono text-[11px] text-textPrimary
                     border border-border rounded-[6px] px-3 py-2 resize-none
                     focus:outline-none focus:border-[#1f1f1f] bg-white
                     leading-relaxed"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full font-departureMono text-[11px] text-textPrimary
                     border border-border rounded-[6px] px-3 py-2
                     focus:outline-none focus:border-[#1f1f1f] bg-white"
        />
      )}

      {/* Show candidates inline below field whenever they're loaded */}
      {candidates?.length > 0 && (
        <TextCandidateList
          candidates={candidates}
          field={field}
          currentValue={value}
          onSelect={onChange}
        />
      )}
    </div>
  );
}
