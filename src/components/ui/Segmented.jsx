import { cn } from "@/lib/utils";

/**
 * A short either/or switch: "Popular | Newest". `options` are
 * { value, label }; the chosen one sits on a white tile.
 */
export default function Segmented({ label, options, value, onChange, className }) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex p-1 rounded-[10px] bg-paper-3", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 h-9 sm:h-8 px-3.5 rounded-[7px] label whitespace-nowrap transition-colors focus-ring",
            value === o.value ? "bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-textPrimary hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
