/**
 * ISBN registration group utilities.
 *
 * The 4th digit of a 13-digit ISBN (immediately after "978" or "979") identifies
 * the language/country registration group. This is a structural property of the
 * number itself — no API call needed.
 *
 * English groups:
 *   978-0 = English-speaking countries (US, AU, NZ, etc.)
 *   978-1 = English-speaking (UK, Ireland, and English publishers)
 *   979-8 = USA (newer prefix)
 */

/**
 * Returns true if an ISBN-13 is from an English-language registration group.
 */
export function isEnglishIsbn(isbn) {
  if (!isbn || typeof isbn !== "string") return false;
  const clean = isbn.replace(/[^0-9]/g, "");
  if (clean.length !== 13) return false;
  if (clean.startsWith("9780") || clean.startsWith("9781")) return true;
  if (clean.startsWith("9798")) return true;
  return false;
}

/**
 * Returns true if an ISBN-13 prefix indicates a known non-English language.
 */
export function isNonEnglishIsbn(isbn) {
  if (!isbn || typeof isbn !== "string") return false;
  const clean = isbn.replace(/[^0-9]/g, "");
  if (clean.length !== 13) return false;
  const knownNonEnglish = [
    "9782", // French
    "9783", // German
    "9784", // Japanese
    "9785", // Russian/CIS
    "9787", // Chinese
    "9791" // French (979 prefix)
  ];
  return knownNonEnglish.some((prefix) => clean.startsWith(prefix));
}

/**
 * Given an array of ISBNs, returns the best English ISBN-13.
 * Prefers 978-0/978-1/979-8 prefixes.
 * Returns null if no English ISBN found.
 */
export function pickEnglishIsbn(isbns) {
  if (!isbns?.length) return null;
  const clean = isbns
    .map((i) => i?.replace(/[^0-9]/g, ""))
    .filter((i) => i?.length === 13);
  return (
    clean.find((i) => i.startsWith("9780")) ||
    clean.find((i) => i.startsWith("9781")) ||
    clean.find((i) => i.startsWith("9798")) ||
    null
  );
}
