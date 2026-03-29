/**
 * Generates a Bookshop.org affiliate link for a book.
 * Returns null if isbn_13 is not available.
 */
export function getBookshopLink(isbn_13) {
  if (!isbn_13) return null;
  const affiliateId =
    typeof window === "undefined"
      ? process.env.BOOKSHOP_AFFILIATE_ID
      : process.env.NEXT_PUBLIC_BOOKSHOP_AFFILIATE_ID;
  if (!affiliateId) return null;
  return `https://bookshop.org/a/${affiliateId}/${isbn_13}`;
}

/**
 * Returns a Bookshop.org search URL as a fallback when no ISBN is available.
 * Less precise but still useful.
 */
export function getBookshopSearchLink(title, author) {
  const affiliateId =
    typeof window === "undefined"
      ? process.env.BOOKSHOP_AFFILIATE_ID
      : process.env.NEXT_PUBLIC_BOOKSHOP_AFFILIATE_ID;
  if (!affiliateId || !title) return null;
  const q = encodeURIComponent(`${title} ${author || ""}`.trim());
  return `https://bookshop.org/search?keywords=${q}&affiliate=${affiliateId}`;
}
