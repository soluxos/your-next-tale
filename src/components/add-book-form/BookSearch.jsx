import { useState } from "react"
import BookSimple from "@/components/book/BookSimple"

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
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const apiKey = process.env.NEXT_PUBLIC_ISBNDB_API_KEY // Access the API key from environment variables
  const baseURL = "https://api2.isbndb.com" // Default base URL for basic plan

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      // Construct the URL with query parameters
      const url = `${baseURL}/books/${encodeURIComponent(query)}?page=1&pageSize=10&column=title&shouldMatchAll=0`

      const response = await fetch(url, {
        headers: {
          Authorization: apiKey, // Pass the API key in the Authorization header
          Accept: "application/json" // Ensure the response is JSON
        }
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Fetched book:", data) // Log the entire response data for debugging

      // Filter results to only include books with description data
      const filteredResults = (data.books || []).filter((book) => {
        const hasDescription = book.synopsis || book.overview || book.excerpt
        return hasDescription && hasDescription.trim().length > 0
      })

      setResults(filteredResults)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="book-search">
      <h2 className="text-primary font-departureMono uppercase text-[12px] text-white mb-2">Search for a Book</h2>
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
      {error && <p className="text-red-300 font-departureMono text-[12px]">{error}</p>}
      <div className="results grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
        {results.length > 0 ? (
          <>
            {console.log("Results:", results)} {/* Log the results array once */}
            {results.map((book) => (
              <div
                key={book.isbn13}
                className="cursor-pointer hover:opacity-80 transition-opacity border border-transparent hover:border-white/30 p-2 rounded"
                onClick={() => {
                  if (onBookSelect) {
                    onBookSelect(book)
                    // Clear search results after selection
                    setResults([])
                    setQuery("")
                  }
                }}
                title="Click to populate form fields"
              >
                <BookSimple
                  book={{
                    title: book.title, // Pass the title
                    cover_url: book.image_original // Pass the cover image URL
                  }}
                />
              </div>
            ))}
          </>
        ) : (
          !loading && <p className="text-white font-departureMono text-[12px]">No results found.</p>
        )}
      </div>
    </div>
  )
}

export default BookSearch
