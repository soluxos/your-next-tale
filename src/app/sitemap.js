import { createStaticClient } from "@/utils/supabase/static";

export default async function sitemap() {
  const supabase = createStaticClient();

  // Fetch all books
  const { data: books } = await supabase
    .from("Books")
    .select("id, created_at")
    .order("created_at", { ascending: false });

  const bookUrls =
    books?.map((book) => ({
      url: `https://yournexttale.com/books/${book.id}`,
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
