import { useState } from "react";
import BookSimple from "@/components/book/BookSimple";

/* Book Structure
{
  "total": 0,
  "books": [
    {
      "title": "string",
      "title_long": "string",
      "isbn": "string",
      "isbn13": "string",
      "dewey_decimal": ["string"],
      "binding": "string",
      "publisher": "string",
      "language": "en",
      "date_published": "2025-07-28",
      "edition": "string",
      "pages": 0,
      "dimensions": "string",
      "dimensions_structured": {
        "length": { "unit": "string", "value": 0 },
        "width": { "unit": "string", "value": 0 },
        "height": { "unit": "string", "value": 0 },
        "weight": { "unit": "string", "value": 0 }
      },
      "overview": "string",
      "image": "string",
      "image_original": "string",
      "msrp": 0,
      "excerpt": "string",
      "synopsis": "string",
      "authors": ["string"],
      "subjects": ["string"],
      "reviews": ["string"],
      "prices": [
        {
          "condition": "string",
          "merchant": "string",
          "merchant_logo": "string",
          "merchant_logo_offset": { "x": "string", "y": "string" },
          "shipping": "string",
          "price": "string",
          "total": "string",
          "link": "string"
        }
      ],
      "related": { "type": "string" },
      "other_isbns": [
        { "isbn": "string", "binding": "string" }
      ]
    }
  ]
}
*/

const BookSearch = ({ onBookSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Route through server-side proxy to keep API key secret
      const url = `/api/books/isbndb?q=${encodeURIComponent(query)}&page=1&pageSize=10`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Fetched book:", data); // Log the entire response data for debugging

      // Filter results: English only, must have image, authors, and a description
      const filteredResults = (data.books || []).filter((book) => {
        const isEnglish = !book.language || book.language === "en";
        const hasImage = !!(book.image_original || book.image);
        const hasAuthors = book.authors?.length > 0;
        const hasDescription = book.synopsis || book.overview || book.excerpt;
        return (
          isEnglish &&
          hasImage &&
          hasAuthors &&
          hasDescription &&
          hasDescription.trim().length > 0
        );
      });

      setResults(filteredResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="book-search">
      <h2 className="text-primary font-departureMono uppercase text-[12px] text-white mb-2">
        Search for a Book
      </h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px] flex-grow"
          placeholder="Enter book title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button
          className="bg-white text-[#0D00FF] font-departureMono uppercase text-[12px] px-4 py-2 transition duration-200 border border-solid border-white hover:bg-gray-200 disabled:opacity-50"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "..." : "Search"}
        </button>
      </div>
      {error && (
        <p className="text-red-300 font-departureMono text-[12px]">{error}</p>
      )}
      <div className="results grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
        {results.length > 0 ? (
          <>
            {console.log("Results:", results)}{" "}
            {/* Log the results array once */}
            {results.map((book) => (
              <div
                key={book.isbn13}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setSelectedBook(book)}
                title="Click to view details"
              >
                <BookSimple
                  book={{
                    title: book.title,
                    cover_url: book.image_original
                  }}
                />
              </div>
            ))}
          </>
        ) : (
          !loading && (
            <p className="text-white font-departureMono text-[12px]">
              No results found.
            </p>
          )
        )}
      </div>

      {/* Book detail modal */}
      {selectedBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setSelectedBook(null)}
        >
          <div
            className="relative bg-[#0a0a0a] border border-white/20 max-w-xl w-full mx-4 flex gap-5 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedBook(null)}
              className="absolute top-3 right-3 text-white/40 hover:text-white font-departureMono text-[11px] uppercase"
            >
              ✕
            </button>

            {/* Cover */}
            <div className="w-28 flex-shrink-0">
              {selectedBook.image_original ? (
                <img
                  src={selectedBook.image_original}
                  alt={selectedBook.title}
                  className="w-full object-cover"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-white/10" />
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              <div>
                <p className="text-white font-departureMono text-[13px] leading-snug">
                  {selectedBook.title}
                </p>
                {selectedBook.authors?.length > 0 && (
                  <p className="text-white/70 font-departureMono text-[11px] mt-1">
                    {selectedBook.authors.join(", ")}
                  </p>
                )}
                {selectedBook.date_published && (
                  <p className="text-white/40 font-departureMono text-[10px] mt-0.5">
                    {selectedBook.date_published}
                  </p>
                )}
                {selectedBook.publisher && (
                  <p className="text-white/40 font-departureMono text-[10px]">
                    {selectedBook.publisher}
                  </p>
                )}
                {selectedBook.pages && (
                  <p className="text-white/40 font-departureMono text-[10px]">
                    {selectedBook.pages} pages
                  </p>
                )}
                {(selectedBook.isbn13 || selectedBook.isbn) && (
                  <p className="text-white/30 font-departureMono text-[9px] mt-0.5">
                    ISBN: {selectedBook.isbn13 || selectedBook.isbn}
                  </p>
                )}
              </div>

              {selectedBook.synopsis ||
              selectedBook.overview ||
              selectedBook.excerpt ? (
                <p className="text-white/60 font-departureMono text-[10px] leading-relaxed overflow-y-auto max-h-32 whitespace-pre-wrap">
                  {selectedBook.synopsis ||
                    selectedBook.overview ||
                    selectedBook.excerpt}
                </p>
              ) : (
                <p className="text-white/30 font-departureMono text-[10px] italic">
                  No description available
                </p>
              )}

              {selectedBook.subjects?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedBook.subjects.slice(0, 6).map((s, i) => (
                    <span
                      key={i}
                      className="font-departureMono text-[8px] text-white/40 border border-white/20 px-1 py-0.5"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  if (onBookSelect) {
                    onBookSelect(selectedBook);
                    setResults([]);
                    setQuery("");
                  }
                  setSelectedBook(null);
                }}
                className="mt-auto font-departureMono uppercase text-[10px] px-3 py-1.5 border border-white text-white hover:bg-white hover:text-[#0D00FF] transition-colors w-fit"
              >
                Populate Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookSearch;
