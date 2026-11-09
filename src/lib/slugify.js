import { selectAllBooks } from "@/lib/books/selectAllBooks";

/**
 * Generates a URL-safe slug from book title and author
 * Example: "The Great Gatsby" by "F. Scott Fitzgerald" -> "the-great-gatsby-f-scott-fitzgerald"
 */
export function generateBookSlug(title, author) {
  const combined = `${title} ${author}`;
  return combined
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .trim();
}

// slug → book id for the whole catalogue, kept for a few minutes so a page's
// metadata and body (and a build's pages) share one read. Only ids and
// titles are held; the book itself is read fresh.
const INDEX_TTL = 10 * 60 * 1000;
const MISS_RETRY = 60 * 1000;
let slugIndex = null;

async function bookIdForSlug(slug, supabase) {
  const age = slugIndex ? Date.now() - slugIndex.at : Infinity;
  // A slug it doesn't know may be a book added since: look again, but at
  // most once a minute, so links to books that don't exist stay cheap.
  if (age > INDEX_TTL || (!slugIndex.map.has(slug) && age > MISS_RETRY)) {
    // Oldest first: when two books share a slug, the one that had it first keeps it.
    const { data, error } = await selectAllBooks(supabase, "id, title, authors", { order: "created_at" });
    if (data && !error) {
      const map = new Map();
      for (const b of data) {
        const key = generateBookSlug(b.title, b.authors?.[0]);
        if (!map.has(key)) map.set(key, b.id);
      }
      slugIndex = { at: Date.now(), map };
    } else if (!slugIndex) {
      return null;
    }
  }
  return slugIndex.map.get(slug) ?? null;
}

/** The book whose title and first author make this slug, or null. */
export async function getBookFromSlug(slug, supabase) {
  const id = await bookIdForSlug(slug, supabase);
  if (!id) return null;
  const { data } = await supabase.from("books").select("*").eq("id", id).maybeSingle();
  return data || null;
}
