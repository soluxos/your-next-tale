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
    .from("Books")
    .select("id, title, author")
    .order("created_at", { ascending: false });

  if (error || !books) {
    console.error("Error fetching books for static params:", error);
    return [];
  }

  return books.map((book) => ({
    slug: generateBookSlug(book.title, book.author)
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
    title: `${book.title} by ${book.author} | Your Next Tale`,
    description: book.description || `Discover ${book.title} by ${book.author}`,
    openGraph: {
      title: `${book.title} by ${book.author}`,
      description:
        book.description || `Discover ${book.title} by ${book.author}`,
      type: "book",
      book: {
        author: book.author
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
