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

/**
 * Extracts the book ID from a slug that might contain ID at the end
 * or searches the database for a book with matching title and author
 */
export async function getBookFromSlug(slug, supabase) {
  // First, try to find by exact slug match if we store slugs
  // Otherwise, we'll need to search by reconstructing title and author

  // For now, we'll fetch all books and find the matching one
  const { data: books } = await supabase.from("books").select("*");

  if (!books) return null;

  // Find book where slug matches
  const book = books.find((b) => {
    const bookSlug = generateBookSlug(b.title, b.authors?.[0]);
    return bookSlug === slug;
  });

  return book;
}
