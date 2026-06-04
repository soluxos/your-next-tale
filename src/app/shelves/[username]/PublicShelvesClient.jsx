"use client";

import { useState } from "react";
import BookDetailPanel from "@/components/shelves/BookDetailPanel";

export default function PublicShelvesClient({ username, shelves }) {
  const [selectedBook, setSelectedBook] = useState(null);

  return (
    <div className="PublicShelvesClient min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 pt-28 space-y-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {username}&apos;s Bookshelves
        </h1>

        {shelves.length === 0 && (
          <p className="text-textPrimary text-center py-12">
            No bookshelves to show.
          </p>
        )}

        {shelves.map((shelf) => (
          <div key={shelf.id} className="space-y-3">
            <h2 className="text-lg font-medium">{shelf.name}</h2>
            {shelf.books.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {shelf.books.map((book) => (
                  <div
                    key={book.id}
                    className="flex-shrink-0 w-20 cursor-pointer group"
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
                    <p className="text-xs text-textPrimary mt-1 line-clamp-2">
                      {book.title}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-textPrimary">
                No books on this shelf.
              </p>
            )}
          </div>
        ))}
      </div>

      {selectedBook && (
        <BookDetailPanel
          book={selectedBook}
          userBook={selectedBook.userBook}
          userId={null}
          onClose={() => setSelectedBook(null)}
          readOnly
        />
      )}
    </div>
  );
}
