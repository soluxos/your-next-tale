/**
 * Strip HTML tags and decode common HTML entities from a description string.
 * Returns null for falsy input or non-Latin-script text (e.g. Cyrillic, Arabic, CJK).
 */
export function sanitiseDescription(raw) {
  if (!raw) return null;

  const cleaned =
    raw
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null;

  if (!cleaned) return null;

  // Reject descriptions where >20% of letters are outside the Latin Unicode block
  // (catches Cyrillic, Arabic, CJK, Hangul, etc.)
  const letters = cleaned.match(/\p{L}/gu) || [];
  if (letters.length > 0) {
    const nonLatin = letters.filter((c) => /[^\u0000-\u024F]/u.test(c)).length;
    if (nonLatin / letters.length >= 0.2) return null;
  }

  return cleaned;
}
