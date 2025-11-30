import { createStaticClient } from "@/utils/supabase/static";
import { generateBookSlug } from "@/lib/slugify";

export default async function sitemap() {
  const supabase = createStaticClient();

  // Fetch all books
  const { data: books } = await supabase
    .from("Books")
    .select("id, title, author, created_at")
    .order("created_at", { ascending: false });

  const bookUrls =
    books?.map((book) => ({
      url: `https://yournexttale.com/books/${generateBookSlug(
        book.title,
        book.author
      )}`,
      lastModified: book.created_at,
      changeFrequency: "monthly",
      priority: 0.8
    })) || [];

  return [
    {
      url: "https://yournexttale.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1
    },
    ...bookUrls
  ];
}
