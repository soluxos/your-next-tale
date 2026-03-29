import { createStaticClient } from "@/utils/supabase/static";
import { notFound } from "next/navigation";
import BookDetailPage from "@/components/pages/book/BookDetailPage";
import { generateBookSlug, getBookFromSlug } from "@/lib/slugify";

// Enable static generation
export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour

// Generate static params for all books at build time
export async function generateStaticParams() {
  const supabase = createStaticClient();

  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, authors")
    .order("created_at", { ascending: false });

  if (error || !books) {
    console.error("Error fetching books for static params:", error);
    return [];
  }

  return books.map((book) => ({
    slug: generateBookSlug(book.title, book.authors?.[0])
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = createStaticClient();

  const book = await getBookFromSlug(slug, supabase);

  if (!book) {
    return {
      title: "Book Not Found | Your Next Tale"
    };
  }

  return {
    title: `${book.title} by ${book.authors?.[0]} | Your Next Tale`,
    description: book.description || `Discover ${book.title} by ${book.authors?.[0]}`,
    openGraph: {
      title: `${book.title} by ${book.authors?.[0]}`,
      description:
        book.description || `Discover ${book.title} by ${book.authors?.[0]}`,
      type: "book",
      book: {
        author: book.authors?.[0]
      }
    }
  };
}

// Main page component
export default async function BookPage({ params }) {
  const { slug } = await params;
  const supabase = createStaticClient();

  const book = await getBookFromSlug(slug, supabase);

  if (!book) {
    notFound();
  }

  return <BookDetailPage book={book} />;
}
