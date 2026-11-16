// The bar a book has to clear before it's shown as a new release. Retail
// and catalogue data for unpublished books is often half-done: "Untitled",
// "The Bone Season #7", a one-line blurb, a "cover to be revealed" mock-up.
// None of that goes on the page.
import { assessCover, cardShares, COVER_GOOD, COVER_WEAK } from "@/lib/books/coverQuality";
import { readCover, placeholderPhrase } from "@/lib/books/coverText";
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
 * `mustMention` asks the same of any image: for one that came from a source
 * nobody has checked against the book.
 * `book`: { title, authors } and, when known, `year` (first published) or
 * `releaseDate`.
 */
export async function verifyCover(buffer, book, { mustMention = false } = {}) {
  const a = await assessCover(buffer);
  if (a.tier !== COVER_GOOD && a.tier !== COVER_WEAK) return { ok: false, reason: a.reason, fatal: true };
  if (a.height < MIN_COVER_HEIGHT) return { ok: false, reason: `too small (${a.width}×${a.height})` };

  // What a publisher puts up before a cover is revealed: the title and the
  // author's name in one colour on a flat ground, nothing drawn. Only for a
  // book that's new or not out yet: older books do have covers like that
  // (type on plain cloth), and theirs are the real thing.
  if (isNew(book)) {
    const card = await cardShares(buffer);
    if (card.ground >= CARD.ground && card.ink >= CARD.ink && card.body <= CARD.body) {
      return { ok: false, reason: "only type on a flat ground (a stand-in for a new book's cover)", fatal: true };
    }
  }

  let read;
  try {
    read = await readCover(buffer);
  } catch (e) {
    // Unread is unchecked: a cover we couldn't read for "cover to be
    // revealed" isn't shown (not fatal, so a cover already on file stays).
    return { ok: false, reason: `couldn't read the text on it (${e.message})` };
  }
  const phrase = placeholderPhrase(read.text);
  if (phrase) return { ok: false, reason: `placeholder (“${phrase}”)`, fatal: true };

  const other = otherBook(read, book);
  if (other) return { ok: false, reason: `reads as another book (“${other}”)`, fatal: true };

  if (a.tier === COVER_WEAK || mustMention) {
    if (!mentionsBook(read.text, book)) {
      return { ok: false, reason: a.tier === COVER_WEAK ? a.reason : "can't read the title or author on it" };
    }
  }
  return { ok: true, assessment: a };
}

// How much of a picture is one flat colour, how much of the rest is a single
// ink, and how little of that ink is more than a stroke wide (see cardShares).
const CARD = { ground: 0.8, ink: 0.85, body: 0.05 };

// Published last year, this year, or still to come.
function isNew(book) {
  const year = Number(book.year) || Number(String(book.releaseDate || "").slice(0, 4)) || 0;
  return year >= new Date().getFullYear() - 1;
}

function mentionsBook(text, book) {
  const words = new Set(normalise(text).split(" ").filter((w) => w.length > 3));
  const titleWords = normalise(book.title).split(" ").filter((w) => w.length > 3);
  const surnames = (book.authors || []).map((a) => authorKey(a)).filter(Boolean);
  return titleWords.some((w) => words.has(w)) || surnames.some((s) => s.length > 3 && words.has(s));
}

const SMALL_WORDS = new Set(["the", "and", "for", "from", "with", "that", "this", "book", "novel"]);

// One letter added, dropped or swapped.
function oneApart(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * The big type on the cover, when it names a different book: sources file one
 * book's jacket under another's ISBN ("LOUISE PENNY · STILL LIFE" for a
 * science fiction novel). Null when the cover could be this book's.
 *
 * Needs both: at least two words of display type read with confidence, and no
 * trace of this book's title or its authors' names anywhere on the cover. The
 * search for a trace is generous (a letter out, words run together), since a
 * cover with ornate lettering reads badly and must not be thrown out for it.
 */
export function otherBook({ text, display }, book) {
  if (!display || display.length < 2) return null;
  const names = (book.authors || []).flatMap((a) => normalise(a).split(" "));
  const keys = [...normalise(book.title).split(" "), ...names].filter(
    (w) => w.length >= 3 && /[a-z]/.test(w) && !SMALL_WORDS.has(w)
  );
  if (!keys.length) return null;
  const words = normalise(text).split(" ");
  const have = new Set(words);
  const squashed = words.join("");
  const traced = keys.some(
    (k) =>
      have.has(k) ||
      (k.length >= 4 && squashed.includes(k)) ||
      (k.length >= 5 && words.some((w) => oneApart(w, k)))
  );
  return traced ? null : display.slice(0, 4).join(" ").toUpperCase();
}
