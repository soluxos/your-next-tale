import { createStaticClient } from "@/utils/supabase/static";
import { generateBookSlug } from "@/lib/slugify";
import { selectAllBooks } from "@/lib/books/selectAllBooks";

export default async function sitemap() {
  const supabase = createStaticClient();

  const { data: books } = await selectAllBooks(supabase, "id, title, authors, created_at", {
    order: "created_at",
    ascending: false
  });

  const bookUrls =
    books?.map((book) => ({
      url: `https://yournexttale.com/books/${generateBookSlug(
        book.title,
        book.authors?.[0]
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
    {
      url: "https://yournexttale.com/discover",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: "https://yournexttale.com/releases",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9
    },
    ...bookUrls
  ];
}
