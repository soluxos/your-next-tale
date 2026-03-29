/**
 * Strip HTML tags and decode common HTML entities from a description string.
 * Returns null for falsy input.
 */
export function sanitiseDescription(raw) {
  if (!raw) return null;

  return (
    raw
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}
