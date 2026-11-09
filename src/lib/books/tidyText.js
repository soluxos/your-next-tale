// Last tidy before a book is saved. Scraped sources send titles with line
// breaks and trailing junk ("Scourge of the Betrayer\r\n   Bloodsounders ARC")
// and author names with padding and role tags (" Naomi Novik (Author) "),
// which break sorting, matching and slugs.

/** First line only, whitespace collapsed. */
export function tidyTitle(raw) {
  if (typeof raw !== "string") return raw;
  const first = raw.split(/[\r\n]+/).map((s) => s.trim()).find(Boolean) || "";
  return first.replace(/\s+/g, " ");
}

/** Trimmed, "(Author)" dropped, duplicates removed. Other roles are kept. */
export function tidyAuthors(list) {
  if (!Array.isArray(list)) return list;
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const name = String(raw || "")
      .replace(/\s+/g, " ")
      .replace(/\s*\(author\)\s*$/i, "")
      .trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
