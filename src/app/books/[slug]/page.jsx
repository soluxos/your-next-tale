import { createStaticClient } from "@/utils/supabase/static";
import { notFound } from "next/navigation";
import BookView from "@/components/pages/book/BookPage";
import { generateBookSlug, getBookFromSlug } from "@/lib/slugify";

// Enable ISR — regenerate on request after this many seconds
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
      title: "Book not found | Your Next Tale"
    };
  }

  return {
    title: `${book.title} by ${book.authors?.[0]} | Your Next Tale`,
    description:
      book.description || `Discover ${book.title} by ${book.authors?.[0]}`,
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

async function getMoreByAuthor(supabase, book) {
  const author = book.authors?.[0];
  if (!author) return [];
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .contains("authors", [author])
    .neq("id", book.id)
    .order("published_date", { ascending: false, nullsFirst: false })
    .limit(9);
  if (error) {
    console.error("Error fetching more by author:", error);
    return [];
  }
  return data || [];
}

export default async function BookRoute({ params }) {
  const { slug } = await params;
  const supabase = createStaticClient();

  const book = await getBookFromSlug(slug, supabase);

  if (!book) {
    notFound();
  }

  const moreByAuthor = await getMoreByAuthor(supabase, book);

  return <BookView book={book} moreByAuthor={moreByAuthor} />;
}
