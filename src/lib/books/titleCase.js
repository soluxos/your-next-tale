// Publisher casing for book titles.
//
// Library records write titles in sentence case ("The rose and the thorn"):
// Open Library does, and so do the library records ISBNdb carries for older
// editions. Covers, publishers and bookshops write "The Rose and the Thorn".
// A catalogue that mixes the two looks careless, so a title is put into
// title case before it is saved.
//
// The pass only ever adds capitals, and only to words written entirely in
// lower case. It never lowers a letter and never touches a word that already
// has a capital anywhere in it, so "iPhone", "eXistenZ", "McDonald's", "DNA"
// and "II" come through as they are. A title with no capitals at all ("milk
// and honey") is styled that way on purpose and is left alone; so is a lower
// case first word ("xkcd: Volume 0"), which sentence case never produces.
//
// No imports, so scripts can load this file directly.

// Lower case in the middle of a title.
const SMALL = new Set([
  "a", "an", "the",
  "and", "but", "or", "nor",
  "as", "at", "by", "for", "in", "of", "on", "to", "per", "via", "vs",
  "from", "into", "onto", "with",
  "n", "x"
]);

// Longer prepositions, and the short words that are as often adverbs. Most
// publishers capitalise them ("The Cat Who Walks Through Walls", "To Sail
// Beyond the Sunset") and some don't ("Moon over Soho"). In a sentence-case
// title they get a capital with everything else; a title that is otherwise
// in title case keeps whichever its publisher chose.
const EITHER = new Set([
  "about", "above", "across", "after", "against", "along", "amid", "among",
  "around", "before", "behind", "below", "beneath", "beside", "between",
  "beyond", "down", "during", "inside", "like", "near", "off", "out",
  "outside", "over", "past", "than", "through", "toward", "towards", "under",
  "until", "up", "upon", "within", "without"
]);

// Part of a name when a capitalised name follows: "Ludwig van Beethoven",
// "Don Quixote de la Mancha". Otherwise an ordinary word ("The white van").
const PARTICLES = new Set([
  "de", "del", "della", "di", "da", "du", "la", "le", "las", "los",
  "von", "van", "der", "den", "des", "el", "al", "y", "zu", "ter", "af"
]);

const ROMAN = /^(?:ii|iii|iv|vi|vii|viii|ix|xi|xii|xiii|xiv|xv)$/;

// A word: letters and digits, with apostrophes inside ("valor's", "o'clock").
// Hyphens split words, so each part of "enemies-to-lovers" is cased on its own.
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

// Punctuation that starts a new part of the title: a subtitle, a question, a
// bracketed note, the second book of a bundle.
const BREAK = /[:?!([{]|\s[-–—/]\s|[–—]/;
const CLOSE = /[:?!)\]}]|\s[-–—/]\s|[–—]/;
// Symbols inside one word, with no space either side.
const GLUE = /^[*._@&+#]+$/;

const hasUpper = (s) => s !== s.toLowerCase();
const hasLower = (s) => s !== s.toUpperCase();
const capitalise = (w) => w.charAt(0).toUpperCase() + w.slice(1);

function words(title) {
  const out = [];
  let last = 0;
  for (const m of title.matchAll(WORD)) {
    out.push({ text: m[0], at: m.index, before: title.slice(last, m.index) });
    last = m.index + m[0].length;
  }
  out.forEach((w, i) => {
    w.after = i + 1 < out.length ? out[i + 1].before : title.slice(w.at + w.text.length);
  });
  return out;
}

/**
 * "The rose and the thorn" → "The Rose and the Thorn". Small words stay lower
 * case except at the start of the title or a subtitle and at the end; words
 * that carry their own capitals are never changed.
 */
export function toTitleCase(title) {
  if (typeof title !== "string") return title;
  const list = words(title);
  // No capitals at all is a style ("milk and honey"), unless the title opens
  // with a number, where sentence case has none either ("2001: a space odyssey").
  if (!list.length || (!hasUpper(title) && /^\p{Ll}/u.test(list[0].text))) return title;
  const cased = list.map((w, i) => casedWord(w, i, list));
  // Nothing but an either-way preposition in lower case: already title case.
  if (!cased.some((c, i) => c.sure && c.text !== list[i].text)) return title;
  let out = "";
  let pos = 0;
  list.forEach((w, i) => {
    out += title.slice(pos, w.at) + cased[i].text;
    pos = w.at + w.text.length;
  });
  return out + title.slice(pos);
}

// → { text, sure }: the word as title case writes it, and whether every
// publisher would (false for an either-way preposition mid-title).
function casedWord(w, i, list) {
  const word = w.text;
  const same = { text: word, sure: true };
  const capital = { text: capitalise(word), sure: true };
  // Its own capitals, a number ("2nd", "1920s"), or the title's first word.
  if (hasUpper(word) || !/^\p{Ll}/u.test(word) || i === 0) return same;
  // The rest of a word broken by a symbol: "Sh*t", "example.com". Initials
  // are the exception: "U.s." → "U.S.".
  if (GLUE.test(w.before)) {
    const initials = w.before === "." && word.length === 1 && list[i - 1].text.length === 1;
    return initials ? { text: word.toUpperCase(), sure: true } : same;
  }
  if (ROMAN.test(word)) return { text: word.toUpperCase(), sure: true };
  const next = list[i + 1];
  const opens = BREAK.test(w.before);
  const closes = !next || CLOSE.test(w.after);
  if (opens || closes) return capital;
  if (SMALL.has(word)) {
    // The first part of a compound: "The In-Between Bookstore".
    const startsCompound = w.after.startsWith("-") && !w.before.endsWith("-");
    return startsCompound ? capital : same;
  }
  if (EITHER.has(word)) return { text: capitalise(word), sure: false };
  if (PARTICLES.has(word) && (/^\p{Lu}/u.test(next.text) || PARTICLES.has(next.text))) return same;
  return capital;
}

/** True when the title has a word the title-case pass would capitalise. */
export function needsTitleCase(title) {
  return typeof title === "string" && toTitleCase(title) !== title;
}

/**
 * The same words as another source writes them, where that source is in
 * publisher casing: "The dna of you" + "The DNA of You (Rose Hill, #1)" →
 * "The DNA of You". Only lower-case words are replaced, small words keep the
 * title's own case, and a source that is all capitals or all lower case
 * says nothing about casing. Returns the title unchanged when the other
 * title doesn't begin with the same words.
 */
export function borrowCasing(title, other) {
  if (typeof title !== "string" || typeof other !== "string") return title;
  if (!hasUpper(other) || !hasLower(other)) return title;
  const mine = words(title);
  const theirs = words(other);
  if (!mine.length || theirs.length < mine.length) return title;
  const same = mine.every((w, i) => w.text.toLowerCase() === theirs[i].text.toLowerCase());
  if (!same) return title;
  let out = "";
  let pos = 0;
  mine.forEach((w, i) => {
    const lower = !hasUpper(w.text) && /^\p{Ll}/u.test(w.text);
    const keep = !lower || i === 0 || SMALL.has(w.text) || PARTICLES.has(w.text);
    out += title.slice(pos, w.at) + (keep ? w.text : theirs[i].text);
    pos = w.at + w.text.length;
  });
  return out + title.slice(pos);
}

/**
 * A title in publisher casing. A title already in title case comes back
 * untouched. A sentence-case one takes its capitals from whichever of the
 * other sources' titles has the same words (they know "DNA" from "Dna"),
 * then from the title-case rules.
 */
export function publisherCasing(title, others = []) {
  if (!needsTitleCase(title)) return title;
  let out = title;
  for (const other of others) {
    if (other && other !== title && !needsTitleCase(other)) out = borrowCasing(out, other);
  }
  return toTitleCase(out);
}
