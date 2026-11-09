// The bar a book has to clear before it's shown as a new release. Retail
// and catalogue data for unpublished books is often half-done: "Untitled",
// "The Bone Season #7", a one-line blurb, a "cover to be revealed" mock-up.
// None of that goes on the page.
import { assessCover, COVER_GOOD, COVER_WEAK } from "@/lib/books/coverQuality";
import { coverText, placeholderPhrase } from "@/lib/books/coverText";
import { isPlaceholderTitle } from "@/lib/books/fetchAndNormaliseBook";
import { isBundle, normalise, authorKey } from "@/lib/books/sameBook";

export const MIN_DESCRIPTION = 120;
// Tall enough to look sharp in a 200px-wide card on a retina screen.
export const MIN_COVER_HEIGHT = 380;

const NOT_A_NOVEL =
  /\b(box(?:ed)? ?set|collection of \d|omnibus|books? \d+\s*[-–&]\s*\d+|graphic novel|colou?ring book|calendar|diary|journal|activity book|sticker|postcards?|notebook|official companion|the art of)\b/i;
const PLACEHOLDER_BLURB = /^(?:tbc|tba|description (?:to come|coming soon)|no description|coming soon)\.?$/i;

/** What's wrong with a book's text facts; an empty list means nothing. */
export function bookProblems(book) {
  const problems = [];
  const title = String(book.title || "").trim();
  if (!title || isPlaceholderTitle(title)) problems.push("placeholder title");
  else if (isBundle(title) || NOT_A_NOVEL.test(title)) problems.push("not a single novel");
  if (!book.authors?.length) problems.push("no author");
  if (!/^97[89]\d{10}$/.test(book.isbn13 || "")) problems.push("no ISBN");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(book.releaseDate || "")) problems.push("no exact release date");
  const blurb = String(book.description || "").trim();
  if (blurb.length < MIN_DESCRIPTION || PLACEHOLDER_BLURB.test(blurb)) problems.push("no proper description");
  return problems;
}

/**
 * Is this image a finished cover for this book? → { ok, reason, weak }
 * `weak`: a pale or very plain image. Fine as a cover only when we can read
 * the book's own title or author on it (plain covers have big clear type;
 * "coming soon" cards don't say the title).
 */
export async function verifyCover(buffer, book) {
  const a = await assessCover(buffer);
  if (a.tier !== COVER_GOOD && a.tier !== COVER_WEAK) return { ok: false, reason: a.reason, fatal: true };
  if (a.height < MIN_COVER_HEIGHT) return { ok: false, reason: `too small (${a.width}×${a.height})` };

  let text = "";
  try {
    text = await coverText(buffer);
  } catch (e) {
    // Unread is unchecked: a cover we couldn't read for "cover to be
    // revealed" isn't shown (not fatal, so a cover already on file stays).
    return { ok: false, reason: `couldn't read the text on it (${e.message})` };
  }
  const phrase = placeholderPhrase(text);
  if (phrase) return { ok: false, reason: `placeholder (“${phrase}”)`, fatal: true };

  if (a.tier === COVER_WEAK) {
    if (text === null || !mentionsBook(text, book)) return { ok: false, reason: a.reason };
  }
  return { ok: true, assessment: a };
}

function mentionsBook(text, book) {
  const words = new Set(normalise(text).split(" ").filter((w) => w.length > 3));
  const titleWords = normalise(book.title).split(" ").filter((w) => w.length > 3);
  const surnames = (book.authors || []).map((a) => authorKey(a)).filter(Boolean);
  return titleWords.some((w) => words.has(w)) || surnames.some((s) => s.length > 3 && words.has(s));
}
