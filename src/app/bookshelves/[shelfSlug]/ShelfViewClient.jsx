"use client";

import { useState } from "react";
import BookDetailPanel from "@/components/shelves/BookDetailPanel";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ShelfViewClient({
  shelf,
  books: initialBooks,
  userId
}) {
  const [books, setBooks] = useState(initialBooks);
  const [selectedBook, setSelectedBook] = useState(null);

  const handleBookUpdate = (userBookId, updatedFields) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.userBook?.id === userBookId
          ? { ...b, userBook: { ...b.userBook, ...updatedFields } }
          : b
      )
    );
  };

  return (
    <div className="ShelfViewClient min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 pt-28 space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/bookshelves">← Back</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {shelf.name}
            </h1>
            {shelf.description && (
              <p className="text-muted-foreground mt-1">{shelf.description}</p>
            )}
          </div>
        </div>

        {books.length > 0 ? (
          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {books.map((book) => (
              <div
                key={book.id}
                className="cursor-pointer group"
                onClick={() => setSelectedBook(book)}
              >
                {book.cover_url ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${book.cover_url}`}
                    alt={book.title}
                    className="w-full h-auto rounded-sm shadow-sm group-hover:-translate-y-1 transition-transform"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-muted rounded-sm" />
                )}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {book.title}
                </p>
                <p className="text-xs text-muted-foreground/60 line-clamp-1">
                  {book.authors?.[0]}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-textPrimary text-center py-12">
            No books on this shelf yet.
          </p>
        )}
      </div>

      {selectedBook && (
        <BookDetailPanel
          book={selectedBook}
          userBook={selectedBook.userBook}
          userId={userId}
          onClose={() => setSelectedBook(null)}
          onUpdate={handleBookUpdate}
        />
      )}
    </div>
  );
}
